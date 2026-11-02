/** Prisma migration folders required for controlled customer pilot modules (source inventory only). */
export const PILOT_MODULE_MIGRATIONS = {
  open001Platform: ['20261017220000_found01_platform_identity'],
  crm: ['20261018190000_crm05_foundation', '20261018200000_crm05a_integrity'],
  comms: ['20261018210000_comms06_foundation', '20261018220000_comms06a_integrity'],
  seo: ['20261018230000_seo07_foundation'],
  marketing: ['20261018240000_mkt08_foundation'],
  analytics: [
    '20261021120000_analytics14_foundation',
    '20261025120000_analytics15_ingestion',
    '20261025180000_analytics151_rate_limit',
  ],
  siteLeads: [
    '20261031120000_batch28a_managed_site_leads',
    '20261031140000_batch28a_2_intake_payload_fingerprint',
  ],
  crmAudience: ['20261031120000_mkt25_crm_audience_planning'],
  customerAi: ['20261020140000_ai_customer_13_foundation'],
  customerAiPilot: ['20261102130000_batch37_customer_ai_pilot_persistence'],
  workflowAuto10: [
    '20261018280000_auto10_workflow_foundation',
    '20261018290000_auto10c_outbox_dispatch_lease',
  ],
} as const

/** Batch 31 customer pilot foundation — CRM, leads, analytics, platform identity (not full chain). */
export const BATCH31_PILOT_FOUNDATION_MODULES = [
  'open001Platform',
  'crm',
  'siteLeads',
  'analytics',
  'marketing',
  'seo',
  'comms',
] as const satisfies readonly (keyof typeof PILOT_MODULE_MIGRATIONS)[]

export function allPilotMigrationFolders(): string[] {
  return [
    ...PILOT_MODULE_MIGRATIONS.open001Platform,
    ...PILOT_MODULE_MIGRATIONS.crm,
    ...PILOT_MODULE_MIGRATIONS.comms,
    ...PILOT_MODULE_MIGRATIONS.seo,
    ...PILOT_MODULE_MIGRATIONS.marketing,
    ...PILOT_MODULE_MIGRATIONS.analytics,
    ...PILOT_MODULE_MIGRATIONS.siteLeads,
    ...PILOT_MODULE_MIGRATIONS.crmAudience,
  ]
}

export function batch31FoundationMigrationFolders(): string[] {
  return BATCH31_PILOT_FOUNDATION_MODULES.flatMap((key) => [...PILOT_MODULE_MIGRATIONS[key]])
}

/** Batch 38 staging acceptance — foundation pilot modules plus AI pilot + AUTO-10 (inventory only). */
export function batch38ReleaseMigrationFolders(): string[] {
  return [
    ...batch31FoundationMigrationFolders(),
    ...PILOT_MODULE_MIGRATIONS.customerAi,
    ...PILOT_MODULE_MIGRATIONS.customerAiPilot,
    ...PILOT_MODULE_MIGRATIONS.workflowAuto10,
  ]
}
