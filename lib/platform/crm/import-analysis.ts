import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export const CRM_IMPORT_FIELD_TARGETS = ['email', 'givenName', 'familyName', 'phone', 'leadSource'] as const
export type CrmImportFieldTarget = (typeof CRM_IMPORT_FIELD_TARGETS)[number]

const TARGET_SET = new Set<string>(CRM_IMPORT_FIELD_TARGETS)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type NormalizedImportRow = {
  email?: string
  emailNormalized?: string
  givenName?: string
  familyName?: string
  phoneNormalized?: string
  leadSource?: string
}

export type ImportRowDisposition =
  | { kind: 'ready' }
  | { kind: 'duplicate_existing'; contactId: string; normalizedEmail: string }
  | { kind: 'duplicate_in_file'; firstRowNumber: number; normalizedEmail: string }
  | { kind: 'rejected'; errors: string[] }
  | { kind: 'skipped'; reason: string }

export type ImportRowAnalysis = {
  rowNumber: number
  disposition: ImportRowDisposition
  normalized: NormalizedImportRow
}

export function validateImportFieldMapping(mapping: Record<string, string>): CrmResult<{ targets: CrmImportFieldTarget[] }> {
  const targets: CrmImportFieldTarget[] = []
  const seen = new Set<string>()
  for (const target of Object.values(mapping)) {
    if (!TARGET_SET.has(target)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: `Unsupported import field mapping: ${target}` }
    }
    if (seen.has(target)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: `Duplicate import mapping for field: ${target}` }
    }
    seen.add(target)
    targets.push(target as CrmImportFieldTarget)
  }
  if (!targets.includes('email') && !targets.includes('phone')) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Import mapping must include email or phone' }
  }
  return { ok: true, value: { targets } }
}

export function normalizeImportRow(raw: Record<string, string>, mapping: Record<string, string>): NormalizedImportRow {
  const normalized: NormalizedImportRow = {}
  for (const [column, target] of Object.entries(mapping)) {
    const rawValue = raw[column]?.trim()
    if (!rawValue) continue
    switch (target as CrmImportFieldTarget) {
      case 'email':
        normalized.email = rawValue
        normalized.emailNormalized = normalizeEmail(rawValue)
        break
      case 'givenName':
        normalized.givenName = rawValue
        break
      case 'familyName':
        normalized.familyName = rawValue
        break
      case 'phone':
        normalized.phoneNormalized = normalizePhone(rawValue)
        break
      case 'leadSource':
        normalized.leadSource = rawValue.slice(0, 120)
        break
      default:
        break
    }
  }
  return normalized
}

function validateNormalizedRow(normalized: NormalizedImportRow): string[] {
  const errors: string[] = []
  if (normalized.email && !EMAIL_PATTERN.test(normalized.emailNormalized ?? '')) {
    errors.push('Invalid email format')
  }
  if (normalized.phoneNormalized && normalized.phoneNormalized.replace(/\D/g, '').length < 7) {
    errors.push('Invalid phone number')
  }
  const hasIdentity = Boolean(normalized.emailNormalized || normalized.phoneNormalized)
  const hasName = Boolean(normalized.givenName || normalized.familyName)
  if (!hasIdentity && !hasName) {
    errors.push('Row must include email, phone, or a name')
  }
  return errors
}

function isEmptyRawRow(raw: Record<string, string>, mapping: Record<string, string>): boolean {
  for (const column of Object.keys(mapping)) {
    if (raw[column]?.trim()) return false
  }
  return true
}

export function analyzeImportRows(input: {
  rows: Record<string, string>[]
  mapping: Record<string, string>
  existingEmailToContactId: Map<string, string>
}): ImportRowAnalysis[] {
  const inFileFirstRow = new Map<string, number>()
  const analyses: ImportRowAnalysis[] = []

  for (const [index, raw] of input.rows.entries()) {
    const rowNumber = index + 1
    if (isEmptyRawRow(raw, input.mapping)) {
      analyses.push({ rowNumber, disposition: { kind: 'skipped', reason: 'empty_row' }, normalized: {} })
      continue
    }
    const normalized = normalizeImportRow(raw, input.mapping)
    const errors = validateNormalizedRow(normalized)
    if (errors.length > 0) {
      analyses.push({ rowNumber, disposition: { kind: 'rejected', errors }, normalized })
      continue
    }
    if (normalized.emailNormalized) {
      const existingId = input.existingEmailToContactId.get(normalized.emailNormalized)
      if (existingId) {
        analyses.push({
          rowNumber,
          disposition: { kind: 'duplicate_existing', contactId: existingId, normalizedEmail: normalized.emailNormalized },
          normalized,
        })
        continue
      }
      const firstRow = inFileFirstRow.get(normalized.emailNormalized)
      if (firstRow !== undefined) {
        analyses.push({
          rowNumber,
          disposition: {
            kind: 'duplicate_in_file',
            firstRowNumber: firstRow,
            normalizedEmail: normalized.emailNormalized,
          },
          normalized,
        })
        continue
      }
      inFileFirstRow.set(normalized.emailNormalized, rowNumber)
    }
    analyses.push({ rowNumber, disposition: { kind: 'ready' }, normalized })
  }
  return analyses
}

export function summarizeImportAnalysis(analyses: ImportRowAnalysis[]) {
  let ready = 0
  let duplicateExisting = 0
  let duplicateInFile = 0
  let rejected = 0
  let skipped = 0
  for (const row of analyses) {
    switch (row.disposition.kind) {
      case 'ready':
        ready += 1
        break
      case 'duplicate_existing':
        duplicateExisting += 1
        break
      case 'duplicate_in_file':
        duplicateInFile += 1
        break
      case 'rejected':
        rejected += 1
        break
      case 'skipped':
        skipped += 1
        break
      default:
        break
    }
  }
  return { ready, duplicateExisting, duplicateInFile, rejected, skipped, rowCount: analyses.length }
}
