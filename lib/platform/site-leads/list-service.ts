import type { ManagedSiteLeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  SITE_LEAD_INBOX_SAMPLE_LIMIT,
  SITE_LEAD_LIST_DEFAULT_TAKE,
  SITE_LEAD_LIST_MAX_TAKE,
} from '@/config/site-lead-intake'
import { decodeSiteLeadListCursor, encodeSiteLeadListCursor } from '@/lib/platform/site-leads/cursor'
import type { SiteLeadInboxRow, SiteLeadResult } from '@/lib/platform/site-leads/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

const STATUS_SET = new Set<string>([
  'RECEIVED',
  'PENDING_REVIEW',
  'QUALIFIED',
  'REJECTED',
  'CONVERTED',
  'DUPLICATE_REVIEW',
])

export function parseSiteLeadStatusFilter(raw: string | null): ManagedSiteLeadStatus[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is ManagedSiteLeadStatus => STATUS_SET.has(s))
}

function toRow(lead: {
  id: string
  managedSiteId: string
  status: ManagedSiteLeadStatus
  locale: string
  formReference: string | null
  submittedAt: Date
  contactName: string | null
  contactEmail: string
  contactPhone: string | null
  message: string | null
  duplicateOfLeadId: string | null
  crmContactId: string | null
  convertedAt: Date | null
  createdAt: Date
}): SiteLeadInboxRow {
  return {
    id: lead.id,
    managedSiteId: lead.managedSiteId,
    status: lead.status,
    locale: lead.locale,
    formReference: lead.formReference,
    submittedAt: lead.submittedAt.toISOString(),
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    message: lead.message,
    duplicateOfLeadId: lead.duplicateOfLeadId,
    crmContactId: lead.crmContactId,
    convertedAt: lead.convertedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
  }
}

function buildCursorOr(cursor: { createdAt: Date; id: string }): Prisma.ManagedSiteLeadWhereInput[] {
  return [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ]
}

export async function listManagedSiteLeads(input: {
  customerAccountId: string
  managedSiteId?: string | null
  statuses?: ManagedSiteLeadStatus[]
  createdFrom?: Date | null
  createdTo?: Date | null
  cursor?: string | null
  take?: number
}): Promise<
  SiteLeadResult<{ leads: SiteLeadInboxRow[]; nextCursor?: string; sampleLimit: number }>
> {
  if (input.managedSiteId) {
    const site = await getManagedSiteForAccount(input.managedSiteId, input.customerAccountId)
    if (!site) {
      return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found for account' }
    }
  }
  const take = Math.min(Math.max(input.take ?? SITE_LEAD_LIST_DEFAULT_TAKE, 1), SITE_LEAD_LIST_MAX_TAKE)

  const filters: Prisma.ManagedSiteLeadWhereInput = {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    ...(input.statuses?.length ? { status: { in: input.statuses } } : {}),
    ...(input.createdFrom || input.createdTo
      ? {
          createdAt: {
            ...(input.createdFrom ? { gte: input.createdFrom } : {}),
            ...(input.createdTo ? { lte: input.createdTo } : {}),
          },
        }
      : {}),
  }

  let where: Prisma.ManagedSiteLeadWhereInput = filters
  if (input.cursor?.trim()) {
    const decoded = decodeSiteLeadListCursor(input.cursor.trim())
    if (!decoded) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid pagination cursor' }
    }
    const anchor = await prisma.managedSiteLead.findFirst({
      where: { id: decoded.id, customerAccountId: input.customerAccountId },
      select: { id: true, createdAt: true },
    })
    if (!anchor) {
      return { ok: false, code: 'VALIDATION', message: 'Pagination cursor not found for account' }
    }
    where = {
      AND: [filters, { OR: buildCursorOr({ createdAt: anchor.createdAt, id: anchor.id }) }],
    }
  }

  const rows = await prisma.managedSiteLead.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: {
      id: true,
      managedSiteId: true,
      status: true,
      locale: true,
      formReference: true,
      submittedAt: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      message: true,
      duplicateOfLeadId: true,
      crmContactId: true,
      convertedAt: true,
      createdAt: true,
    },
  })
  const page = rows.slice(0, take)
  const last = page[page.length - 1]
  const nextCursor = rows.length > take && last ? encodeSiteLeadListCursor(last.createdAt, last.id) : undefined
  return {
    ok: true,
    value: {
      leads: page.map(toRow),
      nextCursor,
      sampleLimit: SITE_LEAD_INBOX_SAMPLE_LIMIT,
    },
  }
}

export async function getManagedSiteLeadForAccount(
  leadId: string,
  customerAccountId: string,
): Promise<SiteLeadResult<SiteLeadInboxRow>> {
  const lead = await prisma.managedSiteLead.findFirst({
    where: { id: leadId, customerAccountId },
    select: {
      id: true,
      managedSiteId: true,
      status: true,
      locale: true,
      formReference: true,
      submittedAt: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      message: true,
      duplicateOfLeadId: true,
      crmContactId: true,
      convertedAt: true,
      createdAt: true,
    },
  })
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  return { ok: true, value: toRow(lead) }
}
