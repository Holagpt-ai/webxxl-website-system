/** Prisma migration folders required for controlled customer pilot modules (source inventory only). */
export const PILOT_MODULE_MIGRATIONS = {
  crm: ['20261018190000_crm05_foundation', '20261018200000_crm05a_integrity'],
  comms: ['20261018210000_comms06_foundation', '20261018220000_comms06a_integrity'],
  seo: ['20261018230000_seo07_foundation'],
  marketing: ['20261018240000_mkt08_foundation'],
  analytics: [
    '20261021120000_analytics14_foundation',
    '20261025120000_analytics15_ingestion',
    '20261025180000_analytics151_rate_limit',
  ],
} as const

export function allPilotMigrationFolders(): string[] {
  return [
    ...PILOT_MODULE_MIGRATIONS.crm,
    ...PILOT_MODULE_MIGRATIONS.comms,
    ...PILOT_MODULE_MIGRATIONS.seo,
    ...PILOT_MODULE_MIGRATIONS.marketing,
    ...PILOT_MODULE_MIGRATIONS.analytics,
  ]
}
