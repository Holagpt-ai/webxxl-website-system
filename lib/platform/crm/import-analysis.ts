import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export const CRM_IMPORT_FIELD_TARGETS = ['email', 'givenName', 'familyName', 'phone', 'leadSource'] as const
export type CrmImportFieldTarget = (typeof CRM_IMPORT_FIELD_TARGETS)[number]

const TARGET_SET = new Set<string>(CRM_IMPORT_FIELD_TARGETS)

export const IMPORT_ROW_SKIPPED_PREFIX = '__skipped:'
export const IMPORT_ROW_DISPOSITION_KEY = '_importDisposition'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Accept legacy `{ email: "Email" }` (target→column) and `{ Email: "email" }` (column→target). */
export function normalizeImportMapping(raw: Record<string, string>): Record<string, string> {
  if (Object.keys(raw).length === 0) return raw
  const keysAreTargets = Object.keys(raw).every((key) => TARGET_SET.has(key))
  const valuesAreTargets = Object.values(raw).every((value) => TARGET_SET.has(value))
  if (keysAreTargets && !valuesAreTargets) {
    const columnToTarget: Record<string, string> = {}
    for (const [target, column] of Object.entries(raw)) {
      columnToTarget[column] = target
    }
    return columnToTarget
  }
  return raw
}

export function isTargetToColumnImportMapping(raw: Record<string, string>): boolean {
  return Object.keys(raw).some((key) => TARGET_SET.has(key))
}

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
  | { kind: 'duplicate_existing'; contactId: string; normalizedEmail?: string; normalizedPhone?: string }
  | { kind: 'duplicate_in_file'; firstRowNumber: number; normalizedEmail?: string; normalizedPhone?: string }
  | { kind: 'rejected'; errors: string[] }
  | { kind: 'skipped'; reason: string }

export type ImportRowAnalysis = {
  rowNumber: number
  disposition: ImportRowDisposition
  normalized: NormalizedImportRow
}

export function validateImportFieldMapping(mapping: Record<string, string>): CrmResult<{ targets: CrmImportFieldTarget[] }> {
  const normalizedMapping = normalizeImportMapping(mapping)
  const targets: CrmImportFieldTarget[] = []
  const seen = new Set<string>()
  for (const target of Object.values(normalizedMapping)) {
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
  existingPhoneToContactId?: Map<string, string>
}): ImportRowAnalysis[] {
  const mapping = normalizeImportMapping(input.mapping)
  const inFileFirstRow = new Map<string, number>()
  const inFileFirstPhoneRow = new Map<string, number>()
  const existingPhoneToContactId = input.existingPhoneToContactId ?? new Map<string, string>()
  const analyses: ImportRowAnalysis[] = []

  for (const [index, raw] of input.rows.entries()) {
    const rowNumber = index + 1
    if (isEmptyRawRow(raw, mapping)) {
      analyses.push({ rowNumber, disposition: { kind: 'skipped', reason: 'empty_row' }, normalized: {} })
      continue
    }
    const normalized = normalizeImportRow(raw, mapping)
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
    if (normalized.phoneNormalized) {
      const existingPhoneId = existingPhoneToContactId.get(normalized.phoneNormalized)
      if (existingPhoneId) {
        analyses.push({
          rowNumber,
          disposition: {
            kind: 'duplicate_existing',
            contactId: existingPhoneId,
            normalizedPhone: normalized.phoneNormalized,
          },
          normalized,
        })
        continue
      }
      const firstPhoneRow = inFileFirstPhoneRow.get(normalized.phoneNormalized)
      if (firstPhoneRow !== undefined) {
        analyses.push({
          rowNumber,
          disposition: {
            kind: 'duplicate_in_file',
            firstRowNumber: firstPhoneRow,
            normalizedPhone: normalized.phoneNormalized,
          },
          normalized,
        })
        continue
      }
      inFileFirstPhoneRow.set(normalized.phoneNormalized, rowNumber)
    }
    analyses.push({ rowNumber, disposition: { kind: 'ready' }, normalized })
  }
  return analyses
}

export function buildLegacyImportDuplicates(analyses: ImportRowAnalysis[]): { rowNumber: number; email: string }[] {
  return analyses
    .filter((row) => row.disposition.kind === 'duplicate_existing' || row.disposition.kind === 'duplicate_in_file')
    .map((row) => ({
      rowNumber: row.rowNumber,
      email:
        row.normalized.email ??
        row.normalized.emailNormalized ??
        (row.disposition.kind === 'duplicate_existing' || row.disposition.kind === 'duplicate_in_file'
          ? row.disposition.normalizedEmail ?? row.disposition.normalizedPhone ?? ''
          : ''),
    }))
}

export function importRowPersistenceFromAnalysis(analysis: ImportRowAnalysis): {
  duplicateCandidateId?: string
  validationErrors?: string[]
  normalizedData: NormalizedImportRow & { [IMPORT_ROW_DISPOSITION_KEY]?: ImportRowDisposition }
} {
  const normalizedData = {
    ...analysis.normalized,
    [IMPORT_ROW_DISPOSITION_KEY]: analysis.disposition,
  }
  switch (analysis.disposition.kind) {
    case 'skipped':
      return {
        normalizedData,
        validationErrors: [`${IMPORT_ROW_SKIPPED_PREFIX}${analysis.disposition.reason}`],
      }
    case 'rejected':
      return { normalizedData, validationErrors: analysis.disposition.errors }
    case 'duplicate_existing':
      return { normalizedData, duplicateCandidateId: analysis.disposition.contactId }
    case 'duplicate_in_file':
      return {
        normalizedData,
        duplicateCandidateId: `in-file:${analysis.disposition.firstRowNumber}`,
      }
    case 'ready':
      return { normalizedData }
    default:
      return { normalizedData }
  }
}

export type ImportRowCommitAction = 'commit' | 'skip' | 'reject' | 'duplicate'

export function classifyImportRowForCommit(row: {
  duplicateCandidateId: string | null
  validationErrors: unknown
  normalizedData: unknown
  rawData: unknown
}, mapping: Record<string, string>): ImportRowCommitAction {
  const errors = row.validationErrors
  if (Array.isArray(errors) && errors.length > 0) {
    if (errors.every((entry) => typeof entry === 'string' && entry.startsWith(IMPORT_ROW_SKIPPED_PREFIX))) {
      return 'skip'
    }
    return 'reject'
  }
  if (row.duplicateCandidateId) return 'duplicate'
  const storedDisposition = (row.normalizedData as Record<string, unknown> | null)?.[IMPORT_ROW_DISPOSITION_KEY] as
    | ImportRowDisposition
    | undefined
  if (storedDisposition?.kind === 'skipped') return 'skip'
  if (storedDisposition?.kind === 'rejected') return 'reject'
  if (storedDisposition?.kind === 'duplicate_existing' || storedDisposition?.kind === 'duplicate_in_file') {
    return 'duplicate'
  }
  const raw = row.rawData as Record<string, string>
  const canonicalMapping = normalizeImportMapping(mapping)
  if (isEmptyRawRow(raw, canonicalMapping)) return 'skip'
  const normalized = normalizeImportRow(raw, canonicalMapping)
  const validation = validateNormalizedRow(normalized)
  if (validation.length > 0) return 'reject'
  return 'commit'
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
