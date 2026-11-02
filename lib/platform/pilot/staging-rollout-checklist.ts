export type RolloutLifecycleState = 'MERGED' | 'DEPLOYED' | 'MIGRATED' | 'ACTIVATED' | 'VERIFIED' | 'UNVERIFIED' | 'NOT_APPLICABLE'

export type StagingRolloutRow = {
  id: string
  capability: string
  merged: RolloutLifecycleState
  deployed: RolloutLifecycleState
  migrated: RolloutLifecycleState
  activated: RolloutLifecycleState
  verified: RolloutLifecycleState
  ownerNextAction: string
}

export type StagingRolloutChecklist = {
  repositoryMainSha: string
  generatedAt: string
  stagingDatabaseIdentified: false | 'UNVERIFIED'
  rows: StagingRolloutRow[]
  operationalSequence: string[]
}

/** Actionable staging acceptance view — distinguishes lifecycle dimensions (not production claims). */
export function buildStagingRolloutChecklist(input: { repositoryMainSha: string }): StagingRolloutChecklist {
  const u: RolloutLifecycleState = 'UNVERIFIED'
  const na: RolloutLifecycleState = 'NOT_APPLICABLE'
  const merged: RolloutLifecycleState = 'MERGED'

  const rows: StagingRolloutRow[] = [
    {
      id: 'platform_open001',
      capability: 'OPEN-001 subscriber gates (CRM/MKT/SEO/COMMS)',
      merged,
      deployed: u,
      migrated: u,
      activated: u,
      verified: u,
      ownerNextAction: 'Confirm SUBSCRIBER_ONLY cohort on staging env; seed website subscription proof per pilot account.',
    },
    {
      id: 'crm_leads_funnel',
      capability: 'CRM + managed-site leads + funnel reporting (Batches 28–30)',
      merged,
      deployed: u,
      migrated: u,
      activated: u,
      verified: u,
      ownerNextAction: 'Apply site-lead migrations on isolated staging; keep SITE_LEAD_INTAKE_ENABLED OFF until authorized.',
    },
    {
      id: 'business_overview',
      capability: 'Business Command Center overview (Batch 27)',
      merged,
      deployed: u,
      migrated: na,
      activated: na,
      verified: u,
      ownerNextAction: 'Authenticated EN/ES smoke on `/dashboard/business` against staging or preview.',
    },
    {
      id: 'comms_batch35',
      capability: 'Unified comms integration prep (Batch 35)',
      merged,
      deployed: u,
      migrated: u,
      activated: u,
      verified: u,
      ownerNextAction: 'No live Chatwoot/Twilio/Resend; verify readiness APIs return honest disabled states.',
    },
    {
      id: 'customer_ai_pilot',
      capability: 'Customer AI pilot prep + durable persistence (Batches 36–37)',
      merged,
      deployed: u,
      migrated: u,
      activated: u,
      verified: u,
      ownerNextAction:
        'Apply `20261102130000_batch37_customer_ai_pilot_persistence` on staging before CUSTOMER_AI_PILOT_DURABLE_ENABLED; no LLM execution flags.',
    },
    {
      id: 'auto10_workflow',
      capability: 'AUTO-10 workflow jobs (incl. WORKFORCE_TASK_PREPARE handler)',
      merged,
      deployed: u,
      migrated: u,
      activated: u,
      verified: u,
      ownerNextAction: 'Apply auto10 migration chain on staging; keep WORKFLOW_WORKER_ENABLED OFF until worker cron authorized.',
    },
  ]

  return {
    repositoryMainSha: input.repositoryMainSha,
    generatedAt: new Date().toISOString(),
    stagingDatabaseIdentified: 'UNVERIFIED',
    rows,
    operationalSequence: [
      '1. Owner: designate isolated staging DATABASE_URL + DIRECT_URL (WEBXXL_STAGING_DATABASE_IDENTITY).',
      '2. Run `pnpm release:readiness --verify-ordering` then `pnpm migration:rehearsal --check-files`.',
      '3. Snapshot staging DB; run `pnpm exec prisma migrate deploy` (full pending chain only).',
      '4. PILOT_READINESS_DB_PROBE=1 pnpm pilot:readiness — record migration probe output.',
      '5. Enable module backend flags on staging one module at a time (never production without separate authorization).',
      '6. Authenticated EN/ES customer smoke + synthetic pilot report; record VERIFIED only with dated evidence.',
      '7. Do not enable CUSTOMER_AI_EXECUTION_ENABLED, WORKFLOW_WORKER_ENABLED, outbound comms, or live providers without explicit owner authorization.',
    ],
  }
}

export function formatStagingRolloutMarkdown(checklist: StagingRolloutChecklist): string {
  const lines = [
    `# Staging rollout checklist @ ${checklist.repositoryMainSha.slice(0, 7)}`,
    '',
    `Generated: ${checklist.generatedAt}`,
    `Isolated staging DB identified: ${checklist.stagingDatabaseIdentified}`,
    '',
    '| Capability | Merged | Deployed | Migrated | Activated | Verified | Owner next action |',
    '|---|---|---|---|---|---|---|',
  ]
  for (const row of checklist.rows) {
    lines.push(
      `| ${row.capability} | ${row.merged} | ${row.deployed} | ${row.migrated} | ${row.activated} | ${row.verified} | ${row.ownerNextAction} |`,
    )
  }
  lines.push('', '## Operational sequence', '')
  for (const step of checklist.operationalSequence) lines.push(`- ${step}`)
  return lines.join('\n')
}
