import { CRM_SEGMENT_EVAL_MAX_CONTACTS } from '@/config/crm-backend'
import { prisma } from '@/lib/db'
import {
  evaluateSegmentGroup,
  summarizeSegmentPopulation,
  validateSegmentFilterGroup,
  type SegmentContactView,
  type SegmentFilterGroup,
} from '@/lib/platform/crm/segment-engine'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function createDynamicSegment(input: {
  customerAccountId: string
  name: string
  filterDefinition: SegmentFilterGroup
}): Promise<CrmResult<{ id: string }>> {
  const valid = validateSegmentFilterGroup(input.filterDefinition)
  if (!valid.ok) return { ok: false, code: 'VALIDATION_ERROR', message: valid.message }
  const row = await prisma.crmSegment.create({
    data: {
      customerAccountId: input.customerAccountId,
      name: input.name,
      kind: 'DYNAMIC',
      filterDefinition: input.filterDefinition,
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function evaluateSegmentForAccount(
  customerAccountId: string,
  filterDefinition: SegmentFilterGroup,
): Promise<CrmResult<{ contactIds: string[]; summary: ReturnType<typeof summarizeSegmentPopulation> }>> {
  const valid = validateSegmentFilterGroup(filterDefinition)
  if (!valid.ok) return { ok: false, code: 'VALIDATION_ERROR', message: valid.message }
  const total = await prisma.crmContact.count({ where: { customerAccountId, status: 'ACTIVE' } })
  if (total > CRM_SEGMENT_EVAL_MAX_CONTACTS) {
    return {
      ok: false,
      code: 'QUOTA_EXCEEDED',
      message: 'Segment evaluation contact population exceeds synchronous limit',
    }
  }
  const contacts = await prisma.crmContact.findMany({
    where: { customerAccountId, status: 'ACTIVE' },
    include: {
      contactTags: { include: { tag: true } },
      consents: true,
      suppressions: true,
      deals: { where: { status: 'OPEN' }, take: 1 },
    },
  })
  const views: SegmentContactView[] = contacts.map((c) => ({
    id: c.id,
    customerAccountId: c.customerAccountId,
    managedSiteId: c.managedSiteId,
    leadSource: c.leadSource,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    tagLabels: c.contactTags.map((t) => t.tag.label),
    hasOpenDeal: c.deals.length > 0,
    consents: c.consents.map((row) => ({ channel: row.channel, purpose: row.purpose, status: row.status })),
    suppressions: c.suppressions.map((row) => ({ channel: row.channel, purpose: row.purpose, active: row.active })),
  }))
  const contactIds = views.filter((view) => evaluateSegmentGroup(view, filterDefinition)).map((view) => view.id)
  return { ok: true, value: { contactIds, summary: summarizeSegmentPopulation(views) } }
}
