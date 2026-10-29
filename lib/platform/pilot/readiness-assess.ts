import { isAnalyticsBackendEnabled, isAnalyticsIngestionEnabled } from '@/config/analytics-backend'
import {
  isChatwootApiEnabled,
  isCommsBackendEnabled,
  isCommunicationsOutboundEnabled,
  isSmsSendEnabled,
} from '@/config/comms-backend'
import { isCrmBackendEnabled } from '@/config/crm-backend'
import {
  isMktAiGenerationEnabled,
  isMktBackendEnabled,
} from '@/config/mkt-backend'
import {
  isSeoBackendEnabled,
  isSeoCrawlerEnabled,
  isSeoGscApiEnabled,
  isSeoGoogleOauthEnabled,
} from '@/config/seo-backend'
import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  isSocialMarketingEnabled,
} from '@/config/social-marketing'
import {
  isResendTransportEnabled,
  isTwilioAdapterEnabled,
  isWalletSettlementEnabled,
} from '@/config/wallet-backend'
import { isWorkflowWorkerEnabled } from '@/config/workflow-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { allPilotMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import type { PilotCheckResult, PilotReadinessReport } from '@/lib/platform/pilot/types'

function check(
  id: string,
  label: string,
  evidenceKind: PilotCheckResult['evidenceKind'],
  status: PilotCheckResult['status'],
  summary: string,
  detail?: string,
): PilotCheckResult {
  return { id, label, evidenceKind, status, summary, detail }
}

function entitlementCheck(entitlementKey: string, moduleLabel: string): PilotCheckResult {
  const ent = getServiceEntitlement(entitlementKey)
  if (!ent) {
    return check(
      `entitlement.${entitlementKey}`,
      `${moduleLabel} OPEN-001`,
      'ENTITLEMENT_POLICY',
      'FAIL',
      'Entitlement definition missing in source',
    )
  }
  const access = evaluateEntitlementAccess(ent)
  if (access.access === 'POLICY_UNRESOLVED') {
    return check(
      `entitlement.${entitlementKey}`,
      `${moduleLabel} OPEN-001`,
      'ENTITLEMENT_POLICY',
      'UNVERIFIED',
      'POLICY_UNRESOLVED — owner must resolve OPEN-001 before activation',
      'Included-free cohort remains UNRESOLVED; APIs may return 503 even when backend flags are enabled.',
    )
  }
  return check(
    `entitlement.${entitlementKey}`,
    `${moduleLabel} OPEN-001`,
    'ENTITLEMENT_POLICY',
    'PASS',
    `Entitlement access: ${access.access}`,
  )
}

export type MigrationProbeResult =
  | { state: 'BLOCKED'; reason: string }
  | { state: 'UNVERIFIED'; applied: string[]; missing: string[]; error?: string }
  | { state: 'PASS'; applied: string[] }
  | { state: 'FAIL'; applied: string[]; missing: string[] }

export function assessMigrationProbe(probe: MigrationProbeResult): PilotCheckResult {
  const expected = allPilotMigrationFolders()
  switch (probe.state) {
    case 'BLOCKED':
      return check(
        'migrations.pilot_modules',
        'Pilot module migrations',
        'DATABASE_MIGRATION',
        'BLOCKED',
        probe.reason,
        `Expected folders when probed: ${expected.join(', ')}`,
      )
    case 'UNVERIFIED':
      return check(
        'migrations.pilot_modules',
        'Pilot module migrations',
        'DATABASE_MIGRATION',
        'UNVERIFIED',
        'Database not probed — migration apply state unknown',
        probe.missing.length ? `Missing if DB matches repo: ${probe.missing.join(', ')}` : undefined,
      )
    case 'PASS':
      return check(
        'migrations.pilot_modules',
        'Pilot module migrations',
        'DATABASE_MIGRATION',
        'PASS',
        'All pilot module migrations reported applied',
        probe.applied.join(', '),
      )
    case 'FAIL':
      return check(
        'migrations.pilot_modules',
        'Pilot module migrations',
        'DATABASE_MIGRATION',
        'FAIL',
        'Pilot module migrations missing in target database',
        `Missing: ${probe.missing.join(', ')}`,
      )
  }
}

export function buildPilotReadinessReport(input: {
  repositorySha: string
  migrationProbe: MigrationProbeResult
  authenticatedPilotSmoke?: 'BLOCKED' | 'PASS' | 'FAIL'
}): PilotReadinessReport {
  const checks: PilotCheckResult[] = []

  checks.push(
    check(
      'code.customer_dashboard',
      'Customer dashboard workspaces',
      'APPLICATION_CODE',
      'PASS',
      'CRM, Marketing, SEO, Communications UI and APIs present in repository',
    ),
    check(
      'code.project_messages',
      'Project messages (separate from Communications)',
      'APPLICATION_CODE',
      'PASS',
      '/dashboard/messages remains project-scoped; /dashboard/communications is business inbox',
    ),
    assessMigrationProbe(input.migrationProbe),
  )

  checks.push(
    entitlementCheck('core.crm', 'CRM'),
    entitlementCheck('core.marketing-studio', 'Marketing Studio'),
    entitlementCheck('core.local-seo', 'Local SEO'),
    entitlementCheck('core.communications', 'Communications'),
  )

  const flagRows: Array<{ id: string; label: string; enabled: boolean; provider?: boolean }> = [
    { id: 'flag.crm_backend', label: 'CRM_BACKEND_ENABLED', enabled: isCrmBackendEnabled() },
    { id: 'flag.mkt_backend', label: 'MKT_BACKEND_ENABLED', enabled: isMktBackendEnabled() },
    { id: 'flag.seo_backend', label: 'SEO_BACKEND_ENABLED', enabled: isSeoBackendEnabled() },
    { id: 'flag.comms_backend', label: 'COMMS_BACKEND_ENABLED', enabled: isCommsBackendEnabled() },
    { id: 'flag.analytics_backend', label: 'ANALYTICS_BACKEND_ENABLED', enabled: isAnalyticsBackendEnabled() },
    { id: 'flag.chatwoot_api', label: 'CHATWOOT_API_ENABLED', enabled: isChatwootApiEnabled(), provider: true },
    { id: 'flag.comms_outbound', label: 'COMMUNICATIONS_OUTBOUND_ENABLED', enabled: isCommunicationsOutboundEnabled(), provider: true },
    { id: 'flag.sms_send', label: 'SMS_SEND_ENABLED', enabled: isSmsSendEnabled(), provider: true },
    { id: 'flag.postiz_api', label: 'POSTIZ_API_ENABLED', enabled: isPostizApiEnabled(), provider: true },
    { id: 'flag.postiz_publish', label: 'POSTIZ_LIVE_PUBLISHING_ENABLED', enabled: isPostizLivePublishingEnabled(), provider: true },
    { id: 'flag.seo_gsc_live', label: 'SEO GSC live API', enabled: isSeoGscApiEnabled(), provider: true },
    { id: 'flag.seo_crawler', label: 'SEO crawler execution', enabled: isSeoCrawlerEnabled(), provider: true },
    { id: 'flag.seo_google_oauth', label: 'Google OAuth ingestion', enabled: isSeoGoogleOauthEnabled(), provider: true },
    { id: 'flag.mkt_ai_gen', label: 'MKT AI generation', enabled: isMktAiGenerationEnabled(), provider: true },
    { id: 'flag.twilio', label: 'Twilio adapter', enabled: isTwilioAdapterEnabled(), provider: true },
    { id: 'flag.resend', label: 'Resend transport', enabled: isResendTransportEnabled(), provider: true },
    { id: 'flag.wallet_settle', label: 'Wallet settlement', enabled: isWalletSettlementEnabled(), provider: true },
    { id: 'flag.workflow_worker', label: 'Workflow worker', enabled: isWorkflowWorkerEnabled(), provider: true },
    { id: 'flag.analytics_ingest', label: 'Analytics ingestion worker', enabled: isAnalyticsIngestionEnabled(), provider: true },
    { id: 'flag.social_marketing', label: 'Social marketing backend', enabled: isSocialMarketingEnabled() },
  ]

  for (const row of flagRows) {
    checks.push(
      check(
        row.id,
        row.label,
        row.provider ? 'PROVIDER_CONFIG' : 'BACKEND_FLAG',
        row.enabled ? 'FAIL' : 'PASS',
        row.enabled ? 'Enabled in this environment — not allowed for default controlled pilot' : 'Source-default OFF in this process environment',
      ),
    )
  }

  checks.push(
    check(
      'accounts.synthetic_fixtures',
      'Synthetic pilot CustomerAccounts',
      'AUTHORIZED_ACCOUNT',
      'PASS',
      'Two independent synthetic accounts defined for isolation tests (ABMED aesthetics + physicians)',
    ),
  )

  const auth = input.authenticatedPilotSmoke ?? 'BLOCKED'
  checks.push(
    check(
      'test.authenticated_smoke',
      'Authenticated customer pilot smoke',
      'AUTHENTICATED_TEST',
      auth === 'BLOCKED' ? 'BLOCKED' : auth === 'PASS' ? 'PASS' : 'FAIL',
      auth === 'BLOCKED'
        ? 'No authorized signed-in staging session in this run — manual owner smoke required'
        : auth === 'PASS'
          ? 'Authenticated smoke recorded'
          : 'Authenticated smoke failed',
    ),
  )

  checks.push(
    check(
      'ops.controlled_pilot',
      'Operational pilot capability',
      'OPERATIONAL_CAPABILITY',
      'UNVERIFIED',
      'UI routes exist; module APIs remain gated by OPEN-001 and backend flags until owner activation',
      'Controlled pilot is useful for navigation, honest disabled states, and read-only stored data where flags permit — not live providers.',
    ),
  )

  const ownerDecisionsRequired = [
    'Resolve OPEN-001 included-free eligibility cohort for core.crm, core.marketing-studio, core.local-seo, core.communications (no silent enrollment change).',
    'Authorize target-environment `prisma migrate deploy` for pilot module migrations (see PILOT-21A migration table) — production apply is separate owner action.',
    'Explicitly enable per-module backend flags (CRM, MKT, SEO, COMMS, ANALYTICS) only after migrations and OPEN-001 decisions.',
    'Do not enable Chatwoot, Twilio, Resend, Postiz live publish, Google live ingestion, workflow workers, wallet settlement, or outbound comms without separate owner authorization.',
    'Provision or designate two non-production CustomerAccounts and memberships for internal pilot (synthetic ABMED accounts are test fixtures only).',
    'Run authenticated EN/ES dashboard smoke on Vercel preview or staging with real session — not inferred from CI build.',
  ]

  return {
    generatedAt: new Date().toISOString(),
    repositorySha: input.repositorySha,
    overallReadyForControlledPilot: false,
    checks,
    ownerDecisionsRequired,
  }
}

export function summarizePilotReport(report: PilotReadinessReport): string {
  const lines = [
    `WebXXL controlled pilot readiness @ ${report.repositorySha.slice(0, 7)}`,
    `Generated: ${report.generatedAt}`,
    `Overall ready for controlled pilot: ${report.overallReadyForControlledPilot}`,
    '',
    'Checks:',
  ]
  for (const c of report.checks) {
    lines.push(`  [${c.status}] ${c.label} (${c.evidenceKind}) — ${c.summary}`)
  }
  lines.push('', 'Owner decisions required:')
  for (const o of report.ownerDecisionsRequired) {
    lines.push(`  - ${o}`)
  }
  return lines.join('\n')
}
