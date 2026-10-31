import type { CrmImportCommitOutcome } from '@/lib/platform/crm/import-export-service'

/** Legacy preview fields consumed by `components/crm/import-export.tsx`. */
export type LegacyImportPreviewReport = {
  duplicates: { rowNumber: number; email: string }[]
  rowCount: number
  consentGranted: false
}

export function previewCrmImportResponseShape(previewReport: LegacyImportPreviewReport): boolean {
  if (!Array.isArray(previewReport.duplicates)) return false
  if (typeof previewReport.rowCount !== 'number') return false
  if (previewReport.consentGranted !== false) return false
  return previewReport.duplicates.every(
    (entry) => typeof entry.rowNumber === 'number' && typeof entry.email === 'string',
  )
}

/** Legacy commit fields consumed by `components/crm/import-export.tsx`. */
export function commitCrmImportResponseShape(body: CrmImportCommitOutcome): boolean {
  return typeof body.importedCount === 'number' && typeof body.jobId === 'string'
}
