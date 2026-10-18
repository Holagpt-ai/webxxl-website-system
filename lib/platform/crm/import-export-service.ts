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
import { escapeCsvCell, normalizeEmail } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CsvPreviewRow = Record<string, string>

const MAX_CELL_LENGTH = 512

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
  const fields = Object.keys(input.mapping)
  const valid = validateImportPayload(input.rows, fields)
  if (!valid.ok) return valid
  const duplicates: { rowNumber: number; email: string }[] = []
  for (const [index, row] of input.rows.entries()) {
    const emailCol = input.mapping.email
    const email = emailCol ? row[emailCol] : undefined
    if (!email) continue
    const matches = await prisma.crmContactChannelIdentity.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        identityType: 'EMAIL',
        normalizedValue: normalizeEmail(email),
      },
    })
    if (matches) duplicates.push({ rowNumber: index + 1, email })
  }
  const job = await prisma.crmImportJob.create({
    data: {
      customerAccountId: input.customerAccountId,
      fileName: input.fileName,
      rowLimit: CRM_IMPORT_MAX_ROWS,
      mapping: input.mapping,
      createdByUserId: input.createdByUserId,
      previewReport: { duplicates, rowCount: input.rows.length, consentGranted: false },
      rows: {
        create: input.rows.map((rawData, idx) => ({
          customerAccountId: input.customerAccountId,
          rowNumber: idx + 1,
          rawData,
          duplicateCandidateId: duplicates.some((d) => d.rowNumber === idx + 1) ? 'preview-duplicate' : undefined,
        })),
      },
    },
  })
  await recordCrmDataAccessAudit({
    customerAccountId: input.customerAccountId,
    actorUserId: input.createdByUserId,
    operation: 'import.preview',
    resourceRef: job.id,
    detail: { rowCount: input.rows.length, duplicateCount: duplicates.length },
  })
  return { ok: true, value: { jobId: job.id, previewReport: job.previewReport as Prisma.JsonObject } }
}

export async function commitCrmImport(input: {
  customerAccountId: string
  jobId: string
  commitIdempotencyKey: string
  actorUserId: string
}): Promise<CrmResult<{ committed: number; jobId: string }>> {
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
      return {
        ok: true,
        value: { committed: priorByKey.committedContactCount ?? 0, jobId: priorByKey.id },
      }
    }
  }

  let committed = 0
  try {
    await prisma.$transaction(async (tx) => {
      const job = await tx.crmImportJob.findFirst({
        where: { id: input.jobId, customerAccountId: input.customerAccountId },
        include: { rows: true },
      })
      if (!job) throw new Error('NOT_FOUND')
      if (job.status === 'COMMITTED') {
        committed = job.committedContactCount ?? 0
        return
      }
      if (job.status !== 'PREVIEW') throw new Error('INVALID_STATE')

      for (const row of job.rows) {
        if (row.committedContactId) continue
        if (row.duplicateCandidateId) continue
        const raw = row.rawData as Record<string, string>
        const mapping = job.mapping as Record<string, string>
        const email = mapping.email ? raw[mapping.email] : undefined
        const givenName = mapping.givenName ? raw[mapping.givenName] : undefined
        if (email) {
          const existingIdentity = await tx.crmContactChannelIdentity.findFirst({
            where: {
              customerAccountId: input.customerAccountId,
              identityType: 'EMAIL',
              normalizedValue: normalizeEmail(email),
            },
          })
          if (existingIdentity) continue
        }
        const contact = await tx.crmContact.create({
          data: {
            customerAccountId: input.customerAccountId,
            givenName,
            leadSource: 'csv.import',
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
        await tx.crmImportRow.update({ where: { id: row.id }, data: { committedContactId: contact.id } })
        committed += 1
      }
      await tx.crmImportJob.update({
        where: { id: job.id },
        data: {
          status: 'COMMITTED',
          commitIdempotencyKey: input.commitIdempotencyKey,
          committedContactCount: committed,
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
    throw error
  }

  await recordCrmDataAccessAudit({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    operation: 'import.commit',
    resourceRef: input.jobId,
    detail: { committed, idempotencyKey: input.commitIdempotencyKey },
  })

  return { ok: true, value: { committed, jobId: input.jobId } }
}

export async function exportContactsCsvPage(input: {
  customerAccountId: string
  actorUserId: string
  cursor?: string
  take?: number
}): Promise<CrmResult<{ csv: string; nextCursor?: string }>> {
  if (!isCrmExportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM export disabled' }
  }
  const take = Math.min(Math.max(input.take ?? 100, 1), CRM_EXPORT_PAGE_SIZE)
  if (input.cursor) {
    const cursorContact = await prisma.crmContact.findFirst({
      where: { id: input.cursor, customerAccountId: input.customerAccountId },
    })
    if (!cursorContact) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Export cursor out of account scope' }
    }
  }
  const contacts = await prisma.crmContact.findMany({
    where: { customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    orderBy: { id: 'asc' },
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    include: { channelIdentities: true },
  })
  const page = contacts.slice(0, take)
  const nextCursor = contacts.length > take ? contacts[take]?.id : undefined
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
  return { ok: true, value: { csv: lines.join('\n'), nextCursor } }
}
