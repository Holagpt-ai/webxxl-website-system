import type { Prisma } from '@prisma/client'
import {
  CRM_EXPORT_PAGE_SIZE,
  CRM_IMPORT_MAX_FIELDS,
  CRM_IMPORT_MAX_ROWS,
  isCrmExportEnabled,
  isCrmImportEnabled,
} from '@/config/crm-backend'
import { prisma } from '@/lib/db'
import { recordCrmDataAccessAudit } from '@/lib/platform/crm/audit-service'
import { buildExportIdCursorWhere } from '@/lib/platform/crm/export-pagination'
import {
  analyzeImportRows,
  summarizeImportAnalysis,
  validateImportFieldMapping,
  type ImportRowAnalysis,
} from '@/lib/platform/crm/import-analysis'
import { escapeCsvCell, normalizeEmail } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CsvPreviewRow = Record<string, string>

const MAX_CELL_LENGTH = 512

export type CrmImportCommitOutcome = {
  committed: number
  skipped: number
  rejected: number
  duplicates: number
  jobId: string
}

export function validateImportPayload(rows: CsvPreviewRow[], fields: string[]): CrmResult<{ rowCount: number }> {
  if (rows.length > CRM_IMPORT_MAX_ROWS) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Import row limit exceeded' }
  }
  if (fields.length > CRM_IMPORT_MAX_FIELDS) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Import field limit exceeded' }
  }
  for (const row of rows) {
    for (const value of Object.values(row)) {
      if (value.length > MAX_CELL_LENGTH) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Import cell exceeds maximum length' }
      }
    }
  }
  return { ok: true, value: { rowCount: rows.length } }
}

function dispositionToDuplicateCandidateId(disposition: ImportRowAnalysis['disposition']): string | undefined {
  if (disposition.kind === 'duplicate_existing') return disposition.contactId
  if (disposition.kind === 'duplicate_in_file') return `in-file:${disposition.firstRowNumber}`
  return undefined
}

export async function previewCrmImport(input: {
  customerAccountId: string
  createdByUserId: string
  fileName: string
  rows: CsvPreviewRow[]
  mapping: Record<string, string>
}): Promise<CrmResult<{ jobId: string; previewReport: Prisma.JsonObject }>> {
  if (!isCrmImportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM import disabled' }
  }
  const mappingValid = validateImportFieldMapping(input.mapping)
  if (!mappingValid.ok) return mappingValid
  const fields = Object.keys(input.mapping)
  const valid = validateImportPayload(input.rows, fields)
  if (!valid.ok) return valid

  const normalizedEmails = new Set<string>()
  for (const row of input.rows) {
    const emailCol = Object.entries(input.mapping).find(([, target]) => target === 'email')?.[0]
    const email = emailCol ? row[emailCol] : undefined
    if (email?.trim()) normalizedEmails.add(normalizeEmail(email))
  }
  const existingIdentities =
    normalizedEmails.size > 0
      ? await prisma.crmContactChannelIdentity.findMany({
          where: {
            customerAccountId: input.customerAccountId,
            identityType: 'EMAIL',
            normalizedValue: { in: [...normalizedEmails] },
          },
          select: { normalizedValue: true, contactId: true },
        })
      : []
  const existingEmailToContactId = new Map(existingIdentities.map((row) => [row.normalizedValue, row.contactId]))

  const analyses = analyzeImportRows({
    rows: input.rows,
    mapping: input.mapping,
    existingEmailToContactId,
  })
  const summary = summarizeImportAnalysis(analyses)

  const previewReport: Prisma.JsonObject = {
    rowCount: input.rows.length,
    consentGranted: false,
    summary,
    rows: analyses.map((row) => ({
      rowNumber: row.rowNumber,
      disposition: row.disposition,
      normalized: row.normalized,
    })),
  }

  const job = await prisma.crmImportJob.create({
    data: {
      customerAccountId: input.customerAccountId,
      fileName: input.fileName,
      rowLimit: CRM_IMPORT_MAX_ROWS,
      mapping: input.mapping,
      createdByUserId: input.createdByUserId,
      previewReport,
      rows: {
        create: input.rows.map((rawData, idx) => {
          const analysis = analyses[idx]
          return {
            customerAccountId: input.customerAccountId,
            rowNumber: idx + 1,
            rawData,
            normalizedData: analysis?.normalized ?? undefined,
            duplicateCandidateId: analysis ? dispositionToDuplicateCandidateId(analysis.disposition) : undefined,
            validationErrors:
              analysis?.disposition.kind === 'rejected' ? analysis.disposition.errors : undefined,
          }
        }),
      },
    },
  })
  await recordCrmDataAccessAudit({
    customerAccountId: input.customerAccountId,
    actorUserId: input.createdByUserId,
    operation: 'import.preview',
    resourceRef: job.id,
    detail: summary,
  })
  return { ok: true, value: { jobId: job.id, previewReport: job.previewReport as Prisma.JsonObject } }
}

function rowIsCommittable(row: {
  duplicateCandidateId: string | null
  validationErrors: Prisma.JsonValue
}): boolean {
  if (row.validationErrors) return false
  if (row.duplicateCandidateId) return false
  return true
}

export async function commitCrmImport(input: {
  customerAccountId: string
  jobId: string
  commitIdempotencyKey: string
  actorUserId: string
}): Promise<CrmResult<CrmImportCommitOutcome>> {
  if (!isCrmImportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM import disabled' }
  }

  const priorByKey = await prisma.crmImportJob.findFirst({
    where: { commitIdempotencyKey: input.commitIdempotencyKey },
  })
  if (priorByKey) {
    if (priorByKey.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Import commit idempotency key conflict' }
    }
    if (priorByKey.id !== input.jobId) {
      return { ok: false, code: 'CONFLICT', message: 'Import commit idempotency key bound to another job' }
    }
    if (priorByKey.status === 'COMMITTED') {
      const report = (priorByKey.previewReport ?? {}) as { outcome?: CrmImportCommitOutcome }
      if (report.outcome) {
        return { ok: true, value: report.outcome }
      }
      return {
        ok: true,
        value: {
          committed: priorByKey.committedContactCount ?? 0,
          skipped: 0,
          rejected: 0,
          duplicates: 0,
          jobId: priorByKey.id,
        },
      }
    }
    if (priorByKey.commitIdempotencyKey === input.commitIdempotencyKey) {
      return { ok: false, code: 'CONFLICT', message: 'Import commit already in progress' }
    }
  }

  let outcome: CrmImportCommitOutcome = {
    committed: 0,
    skipped: 0,
    rejected: 0,
    duplicates: 0,
    jobId: input.jobId,
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.crmImportJob.updateMany({
        where: {
          id: input.jobId,
          customerAccountId: input.customerAccountId,
          status: 'PREVIEW',
          commitIdempotencyKey: null,
        },
        data: { commitIdempotencyKey: input.commitIdempotencyKey },
      })
      if (claimed.count === 0) {
        const current = await tx.crmImportJob.findFirst({
          where: { id: input.jobId, customerAccountId: input.customerAccountId },
        })
        if (!current) throw new Error('NOT_FOUND')
        if (current.status === 'COMMITTED' && current.commitIdempotencyKey === input.commitIdempotencyKey) {
          outcome = {
            committed: current.committedContactCount ?? 0,
            skipped: 0,
            rejected: 0,
            duplicates: 0,
            jobId: current.id,
          }
          return
        }
        throw new Error('COMMIT_CONFLICT')
      }

      const job = await tx.crmImportJob.findFirst({
        where: { id: input.jobId, customerAccountId: input.customerAccountId },
        include: { rows: { orderBy: { rowNumber: 'asc' } } },
      })
      if (!job) throw new Error('NOT_FOUND')
      if (job.status !== 'PREVIEW') throw new Error('INVALID_STATE')

      let committed = 0
      let skipped = 0
      let rejected = 0
      let duplicates = 0

      for (const row of job.rows) {
        if (row.committedContactId) {
          committed += 1
          continue
        }
        if (row.validationErrors) {
          rejected += 1
          continue
        }
        if (row.duplicateCandidateId) {
          duplicates += 1
          continue
        }
        if (!rowIsCommittable(row)) {
          skipped += 1
          continue
        }

        const raw = row.rawData as Record<string, string>
        const mapping = job.mapping as Record<string, string>
        const normalized = (row.normalizedData ?? {}) as Record<string, string | undefined>
        const email = normalized.email ?? (mapping.email ? raw[mapping.email] : undefined)
        const givenName = normalized.givenName ?? (mapping.givenName ? raw[mapping.givenName] : undefined)
        const familyName = normalized.familyName ?? (mapping.familyName ? raw[mapping.familyName] : undefined)
        const phoneNormalized = normalized.phoneNormalized
        const leadSource = normalized.leadSource ?? 'csv.import'

        if (email) {
          const existingIdentity = await tx.crmContactChannelIdentity.findFirst({
            where: {
              customerAccountId: input.customerAccountId,
              identityType: 'EMAIL',
              normalizedValue: normalizeEmail(email),
            },
          })
          if (existingIdentity) {
            duplicates += 1
            continue
          }
        }

        const contact = await tx.crmContact.create({
          data: {
            customerAccountId: input.customerAccountId,
            givenName,
            familyName,
            leadSource,
            sourceReference: `import:${job.id}:row:${row.rowNumber}`,
          },
        })
        if (email) {
          await tx.crmContactChannelIdentity.create({
            data: {
              customerAccountId: input.customerAccountId,
              contactId: contact.id,
              identityType: 'EMAIL',
              normalizedValue: normalizeEmail(email),
              displayValue: email,
              sourceSystem: 'csv.import',
            },
          })
        }
        if (phoneNormalized) {
          await tx.crmContactChannelIdentity.create({
            data: {
              customerAccountId: input.customerAccountId,
              contactId: contact.id,
              identityType: 'PHONE',
              normalizedValue: phoneNormalized,
              displayValue: phoneNormalized,
              sourceSystem: 'csv.import',
            },
          })
        }
        await tx.crmImportRow.update({ where: { id: row.id }, data: { committedContactId: contact.id } })
        committed += 1
      }

      outcome = { committed, skipped, rejected, duplicates, jobId: job.id }
      const previewReport = (job.previewReport ?? {}) as Prisma.JsonObject
      await tx.crmImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMMITTED',
          committedContactCount: committed,
          previewReport: { ...previewReport, outcome },
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return { ok: false, code: 'NOT_FOUND', message: 'Import job not found' }
    }
    if (error instanceof Error && error.message === 'INVALID_STATE') {
      return { ok: false, code: 'CONFLICT', message: 'Import job is not in preview state' }
    }
    if (error instanceof Error && error.message === 'COMMIT_CONFLICT') {
      return { ok: false, code: 'CONFLICT', message: 'Import commit conflict or in progress' }
    }
    await prisma.crmImportJob.updateMany({
      where: {
        id: input.jobId,
        customerAccountId: input.customerAccountId,
        status: 'PREVIEW',
        commitIdempotencyKey: input.commitIdempotencyKey,
      },
      data: { commitIdempotencyKey: null },
    })
    throw error
  }

  await recordCrmDataAccessAudit({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    operation: 'import.commit',
    resourceRef: input.jobId,
    detail: { ...outcome, idempotencyKey: input.commitIdempotencyKey },
  })

  return { ok: true, value: outcome }
}

export async function exportContactsCsvPage(input: {
  customerAccountId: string
  actorUserId: string
  cursor?: string
  take?: number
}): Promise<CrmResult<{ csv: string; nextCursor?: string; rowCount: number }>> {
  if (!isCrmExportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM export disabled' }
  }
  const take = Math.min(Math.max(input.take ?? 100, 1), CRM_EXPORT_PAGE_SIZE)
  if (input.cursor) {
    const cursorContact = await prisma.crmContact.findFirst({
      where: { id: input.cursor, customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    })
    if (!cursorContact) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Export cursor out of account scope' }
    }
  }
  const contacts = await prisma.crmContact.findMany({
    where: buildExportIdCursorWhere(input.customerAccountId, input.cursor),
    orderBy: { id: 'asc' },
    take: take + 1,
    include: { channelIdentities: true },
  })
  const page = contacts.slice(0, take)
  const nextCursor = contacts.length > take ? page[page.length - 1]?.id : undefined
  const lines = ['id,givenName,familyName,primaryEmail']
  for (const contact of page) {
    const email = contact.channelIdentities.find((i) => i.identityType === 'EMAIL')?.displayValue ?? ''
    lines.push(
      [contact.id, contact.givenName ?? '', contact.familyName ?? '', email].map((cell) => escapeCsvCell(cell)).join(','),
    )
  }
  await recordCrmDataAccessAudit({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    operation: 'export.page',
    resourceRef: nextCursor ?? 'end',
    detail: { rowCount: page.length, cursor: input.cursor ?? null },
  })
  return { ok: true, value: { csv: lines.join('\n'), nextCursor, rowCount: page.length } }
}
