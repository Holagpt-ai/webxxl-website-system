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
import { isSiteLeadIntakeEnabled } from '@/config/site-lead-intake'
import { isWorkflowWorkerEnabled } from '@/config/workflow-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { getOpen001FreeSoftwareCohort, isOpen001PolicyResolved } from '@/lib/platform/open001/policy'
import {
  analyzeMigrationCoverage,
  formatMigrationCoverageDetail,
  type MigrationCoverageSummary,
} from '@/lib/platform/pilot/migration-probe-analyze'
import { allPilotMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'
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
  if (!isOpen001PolicyResolved()) {
    return check(
      `entitlement.${entitlementKey}`,
      `${moduleLabel} OPEN-001`,
      'ENTITLEMENT_POLICY',
      'UNVERIFIED',
      'OPEN-001 cohort UNRESOLVED in this environment',
    )
  }
  const access = evaluateEntitlementAccess(ent)
  if (access.access === 'POLICY_UNRESOLVED') {
    return check(
      `entitlement.${entitlementKey}`,
      `${moduleLabel} OPEN-001`,
      'ENTITLEMENT_POLICY',
      'FAIL',
      'Policy source inconsistent — cohort configured but entitlement unresolved',
    )
  }
  return check(
    `entitlement.${entitlementKey}`,
    `${moduleLabel} OPEN-001`,
    'ENTITLEMENT_POLICY',
    'PASS',
    `OPEN-001 resolved — cohort ${getOpen001FreeSoftwareCohort()}; account-level website subscription proof required at API gates`,
  )
}

export type MigrationProbeResult =
  | { state: 'BLOCKED'; reason: string }
  | { state: 'UNVERIFIED'; reason: string; error?: string }
  | {
      state: 'PROBED'
      pilotModules: MigrationCoverageSummary
      fullSchemaChain: MigrationCoverageSummary
      /** Migration history match does not prove schema integrity, data correctness, or authenticated functionality. */
      disclaimer: string
    }

function assessMigrationCoverageCheck(
  id: string,
  label: string,
  summary: MigrationCoverageSummary,
  blockedReason?: string,
): PilotCheckResult {
  if (blockedReason) {
    return check(
      id,
      label,
      'DATABASE_MIGRATION',
      'BLOCKED',
      blockedReason,
      `Expected folders when probed: ${summary.expected.join(', ')}`,
    )
  }
  if (summary.status === 'PASS') {
    return check(
      id,
      label,
      'DATABASE_MIGRATION',
      'PASS',
      'All expected migrations successfully completed (finished_at set, not rolled back)',
      formatMigrationCoverageDetail(summary),
    )
  }
  return check(
    id,
    label,
    'DATABASE_MIGRATION',
    'FAIL',
    'Migration chain incomplete or not successfully completed in target database',
    formatMigrationCoverageDetail(summary),
  )
}

export function assessMigrationProbeChecks(probe: MigrationProbeResult): PilotCheckResult[] {
  const pilotExpected = allPilotMigrationFolders()
  const fullExpected = allRepositoryMigrationFolders()
  const emptyFullSummary = analyzeMigrationCoverage(fullExpected, [])

  switch (probe.state) {
    case 'BLOCKED':
      return [
        assessMigrationCoverageCheck(
          'migrations.pilot_modules',
          'Pilot module migrations',
          analyzeMigrationCoverage(pilotExpected, []),
          probe.reason,
        ),
        assessMigrationCoverageCheck(
          'migrations.full_schema_chain',
          'Full repository migration chain',
          emptyFullSummary,
          probe.reason,
        ),
      ]
    case 'UNVERIFIED':
      return [
        check(
          'migrations.pilot_modules',
          'Pilot module migrations',
          'DATABASE_MIGRATION',
          'UNVERIFIED',
          probe.reason,
          probe.error,
        ),
        check(
          'migrations.full_schema_chain',
          'Full repository migration chain',
          'DATABASE_MIGRATION',
          'UNVERIFIED',
          probe.reason,
          probe.error,
        ),
      ]
    case 'PROBED':
      return [
        assessMigrationCoverageCheck(
          'migrations.pilot_modules',
          'Pilot module migrations',
          probe.pilotModules,
        ),
        assessMigrationCoverageCheck(
          'migrations.full_schema_chain',
          'Full repository migration chain',
          probe.fullSchemaChain,
          undefined,
        ),
      ]
  }
}

/** @deprecated Use assessMigrationProbeChecks — returns pilot-module check only for legacy callers. */
export function assessMigrationProbe(probe: MigrationProbeResult): PilotCheckResult {
  return assessMigrationProbeChecks(probe)[0]!
}

export { analyzeMigrationCoverage, formatMigrationCoverageDetail }

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
    ...assessMigrationProbeChecks(input.migrationProbe),
  )

  checks.push(
    entitlementCheck('core.crm', 'CRM'),
    entitlementCheck('core.marketing-studio', 'Marketing Studio'),
    entitlementCheck('core.local-seo', 'Local SEO'),
    entitlementCheck('core.communications', 'Communications'),
  )

  const flagRows: Array<{ id: string; label: string; enabled: boolean; provider?: boolean }> = [
    { id: 'flag.crm_backend', label: 'CRM_BACKEND_ENABLED', enabled: isCrmBackendEnabled() },
    { id: 'flag.site_lead_intake', label: 'SITE_LEAD_INTAKE_ENABLED', enabled: isSiteLeadIntakeEnabled() },
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
    'OPEN-001 recorded (SUBSCRIBER_ONLY). Provision qualifying website subscription evidence per pilot CustomerAccount before expecting INCLUDED API access.',
    'Authorize target-environment `prisma migrate deploy` for the full repository migration chain (see `prisma/migrations` and PILOT-21A module table) — production apply is separate owner action.',
    'Explicitly enable per-module backend flags (CRM, MKT, SEO, COMMS, ANALYTICS) only after migrations and OPEN-001 decisions.',
    'Do not enable Chatwoot, Twilio, Resend, Postiz live publish, Google live ingestion, workflow workers, wallet settlement, or outbound comms without separate owner authorization.',
    'Provision or designate two non-production CustomerAccounts and memberships for internal pilot (synthetic ABMED accounts are test fixtures only).',
    'Run authenticated EN/ES dashboard smoke on Vercel preview or staging with real session — not inferred from CI build.',
    'Batch 31: apply Batch 28A site-lead migrations on staging before live intake pilot; keep SITE_LEAD_INTAKE_ENABLED OFF in production until owner authorization.',
    'Batch 31: designate staging-only CustomerAccounts (do not mutate ABMED synthetic fixture IDs used in Vitest).',
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
