import type { Prisma } from '@prisma/client'
import { CRM_IMPORT_MAX_FIELDS, CRM_IMPORT_MAX_ROWS, isCrmExportEnabled, isCrmImportEnabled } from '@/config/crm-backend'
import { prisma } from '@/lib/db'
import { escapeCsvCell, normalizeEmail } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CsvPreviewRow = Record<string, string>

export function validateImportPayload(rows: CsvPreviewRow[], fields: string[]): CrmResult<{ rowCount: number }> {
  if (rows.length > CRM_IMPORT_MAX_ROWS) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Import row limit exceeded' }
  }
  if (fields.length > CRM_IMPORT_MAX_FIELDS) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Import field limit exceeded' }
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
        })),
      },
    },
  })
  return { ok: true, value: { jobId: job.id, previewReport: job.previewReport as Prisma.JsonObject } }
}

export async function commitCrmImport(input: {
  customerAccountId: string
  jobId: string
  commitIdempotencyKey: string
}): Promise<CrmResult<{ committed: number }>> {
  if (!isCrmImportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM import disabled' }
  }
  const prior = await prisma.crmImportJob.findFirst({
    where: { commitIdempotencyKey: input.commitIdempotencyKey, customerAccountId: input.customerAccountId },
  })
  if (prior?.status === 'COMMITTED') return { ok: true, value: { committed: prior.previewReport ? 0 : 0 } }

  const job = await prisma.crmImportJob.findFirst({
    where: { id: input.jobId, customerAccountId: input.customerAccountId },
    include: { rows: true },
  })
  if (!job) return { ok: false, code: 'NOT_FOUND', message: 'Import job not found' }

  let committed = 0
  await prisma.$transaction(async (tx) => {
    for (const row of job.rows) {
      if (row.committedContactId) continue
      const raw = row.rawData as Record<string, string>
      const mapping = job.mapping as Record<string, string>
      const email = mapping.email ? raw[mapping.email] : undefined
      const givenName = mapping.givenName ? raw[mapping.givenName] : undefined
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
      data: { status: 'COMMITTED', commitIdempotencyKey: input.commitIdempotencyKey },
    })
  })
  return { ok: true, value: { committed } }
}

export async function exportContactsCsvPage(input: {
  customerAccountId: string
  cursor?: string
  take?: number
}): Promise<CrmResult<{ csv: string; nextCursor?: string }>> {
  if (!isCrmExportEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'CRM export disabled' }
  }
  const take = Math.min(input.take ?? 100, 500)
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
  return { ok: true, value: { csv: lines.join('\n'), nextCursor } }
}
