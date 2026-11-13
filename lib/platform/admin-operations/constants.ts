/** Batch 7 — Platform Admin & Unified Experience (read-only staff composition). ADR not required. */

export const ADMIN_OPERATIONS_BATCH_VERSION = 'batch7-platform-admin-operations-v1' as const

export const ADMIN_OPERATIONS_DISCLOSURE =
  'Staff read-only operations composition. No mutations, provider activation, cross-tenant data access, or subscriber eligibility bypass.'

export const ADMIN_OPERATIONS_MAX_QUEUE_SAMPLES = 25 as const
