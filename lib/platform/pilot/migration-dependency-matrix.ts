import fs from 'node:fs'
import path from 'node:path'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

export type MigrationRiskLevel = 'additive' | 'data_transform' | 'destructive_hint' | 'unknown'

export type MigrationPlanEntry = {
  folder: string
  phase: string
  module: string
  summary: string
  risk: MigrationRiskLevel
  dependsOn: string[]
  rollbackNotes: string
}

/** Ordered phases for controlled staging rehearsal (full repository chain). */
export const BATCH31_MIGRATION_PHASES = [
  'portal_core',
  'platform_identity',
  'crm_comms_seo_mkt',
  'wallet_analytics_workflow',
  'portal_batches',
  'site_leads_pilot',
  'audience_planning',
] as const

const ENTRY_META: Record<string, Omit<MigrationPlanEntry, 'folder' | 'dependsOn'>> = {
  '20251008120000_customer_portal_core': {
    phase: 'portal_core',
    module: 'portal',
    summary: 'Customer portal core tables',
    risk: 'additive',
    rollbackNotes: 'Restore DB snapshot; do not partial-drop portal tables with live FKs.',
  },
  '20261017220000_found01_platform_identity': {
    phase: 'platform_identity',
    module: 'open001_platform',
    summary: 'BillingGroup, wallet, entitlements foundation (OPEN-001 platform)',
    risk: 'additive',
    rollbackNotes: 'Restore snapshot; billing group rows may reference live commerce data.',
  },
  '20261018190000_crm05_foundation': {
    phase: 'crm_comms_seo_mkt',
    module: 'crm',
    summary: 'Native CRM foundation',
    risk: 'additive',
    rollbackNotes: 'CRM data loss if rolled back after use; prefer forward-fix.',
  },
  '20261018200000_crm05a_integrity': {
    phase: 'crm_comms_seo_mkt',
    module: 'crm',
    summary: 'CRM integrity constraints',
    risk: 'data_transform',
    rollbackNotes: 'May fail if CRM rows violate new constraints.',
  },
  '20261018240000_mkt08_foundation': {
    phase: 'crm_comms_seo_mkt',
    module: 'marketing',
    summary: 'Marketing Studio foundation',
    risk: 'additive',
    rollbackNotes: 'Restore snapshot if no marketing artifacts created.',
  },
  '20261021120000_analytics14_foundation': {
    phase: 'wallet_analytics_workflow',
    module: 'analytics',
    summary: 'Analytics dashboard storage',
    risk: 'additive',
    rollbackNotes: 'Analytics snapshots discarded on rollback.',
  },
  '20261025120000_analytics15_ingestion': {
    phase: 'wallet_analytics_workflow',
    module: 'analytics',
    summary: 'Analytics ingestion pipeline tables',
    risk: 'additive',
    rollbackNotes: 'In-flight ingestion jobs lost on rollback.',
  },
  '20261031120000_batch28a_managed_site_leads': {
    phase: 'site_leads_pilot',
    module: 'site_leads',
    summary: 'ManagedSiteLead intake + inbox (Batch 28A)',
    risk: 'additive',
    rollbackNotes: 'Lead rows lost if tables dropped; required for Lead Inbox / Funnel pilot.',
  },
  '20261031140000_batch28a_2_intake_payload_fingerprint': {
    phase: 'site_leads_pilot',
    module: 'site_leads',
    summary: 'Intake payload fingerprint column (28A.2)',
    risk: 'data_transform',
    rollbackNotes: 'Apply only after 28A base migration.',
  },
  '20261031120000_mkt25_crm_audience_planning': {
    phase: 'audience_planning',
    module: 'marketing',
    summary: 'CRM audience planning link (MKT-25)',
    risk: 'additive',
    rollbackNotes: 'Audience planning drafts invalid if rolled back.',
  },
}

function scanSqlRisk(folder: string, cwd = process.cwd()): MigrationRiskLevel {
  const sqlPath = path.join(cwd, 'prisma', 'migrations', folder, 'migration.sql')
  if (!fs.existsSync(sqlPath)) return 'unknown'
  const sql = fs.readFileSync(sqlPath, 'utf8').toUpperCase()
  if (/\bDROP\s+(TABLE|COLUMN|TYPE)\b/.test(sql)) return 'destructive_hint'
  if (/\bTRUNCATE\b/.test(sql) || /\bDELETE\s+FROM\b/.test(sql)) return 'destructive_hint'
  if (/\bALTER\s+TABLE\b/.test(sql) && /\bDROP\b/.test(sql)) return 'destructive_hint'
  if (/\bUPDATE\b/.test(sql) || /\bALTER\b/.test(sql)) return 'data_transform'
  return 'additive'
}

function defaultMeta(folder: string): Omit<MigrationPlanEntry, 'folder' | 'dependsOn'> {
  const risk = scanSqlRisk(folder)
  return {
    phase: 'portal_batches',
    module: 'other',
    summary: 'Repository migration (see migration.sql)',
    risk,
    rollbackNotes: 'Restore isolated staging snapshot before re-run; never rehearse on production.',
  }
}

/** Full chain in folder sort order with dependency = all prior folders in chain. */
export function buildMigrationDependencyPlan(cwd = process.cwd()): MigrationPlanEntry[] {
  const chain = allRepositoryMigrationFolders(cwd)
  const plan: MigrationPlanEntry[] = []
  for (let i = 0; i < chain.length; i++) {
    const folder = chain[i]!
    const meta = ENTRY_META[folder] ?? defaultMeta(folder)
    const dependsOn = i === 0 ? [] : [chain[i - 1]!]
    plan.push({
      folder,
      dependsOn,
      ...meta,
      risk: ENTRY_META[folder] ? meta.risk : scanSqlRisk(folder, cwd),
    })
  }
  return plan
}

export function migrationPlanForModules(modules: string[], cwd = process.cwd()): MigrationPlanEntry[] {
  const want = new Set(modules.map((m) => m.toLowerCase()))
  return buildMigrationDependencyPlan(cwd).filter((e) => want.has(e.module.toLowerCase()) || want.has(e.phase))
}

export function formatMigrationPlanMarkdown(plan: MigrationPlanEntry[]): string {
  const lines = ['| Order | Folder | Phase | Module | Risk | Summary |', '|---:|---|---|---|---|---|']
  plan.forEach((e, i) => {
    lines.push(`| ${i + 1} | \`${e.folder}\` | ${e.phase} | ${e.module} | ${e.risk} | ${e.summary} |`)
  })
  return lines.join('\n')
}
