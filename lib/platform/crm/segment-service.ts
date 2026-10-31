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

function mapContactToSegmentView(
  c: Awaited<ReturnType<typeof loadSegmentEvaluationContacts>>[number],
): SegmentContactView {
  const latestFollowUp = c.marketingLeadFollowUpEvaluations[0]
  return {
    id: c.id,
    customerAccountId: c.customerAccountId,
    managedSiteId: c.managedSiteId,
    leadSource: c.leadSource,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    tagLabels: c.contactTags.map((t) => t.tag.label),
    hasOpenDeal: c.deals.length > 0,
    followUpCoverage: latestFollowUp?.coverageState,
    consents: c.consents.map((row) => ({
      channel: row.channel,
      purpose: row.purpose,
      status: row.status,
      capturedAt: row.capturedAt,
      revokedAt: row.revokedAt,
    })),
    suppressions: c.suppressions.map((row) => ({ channel: row.channel, purpose: row.purpose, active: row.active })),
  }
}

async function loadSegmentEvaluationContacts(customerAccountId: string) {
  return prisma.crmContact.findMany({
    where: { customerAccountId, status: 'ACTIVE' },
    include: {
      contactTags: { include: { tag: true } },
      consents: true,
      suppressions: true,
      deals: { where: { status: 'OPEN' }, take: 1 },
      marketingLeadFollowUpEvaluations: {
        orderBy: { lastEvaluatedAt: 'desc' },
        take: 1,
      },
    },
  })
}

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

export async function updateDynamicSegment(input: {
  customerAccountId: string
  segmentId: string
  name?: string
  filterDefinition?: SegmentFilterGroup
}): Promise<CrmResult<{ id: string }>> {
  const existing = await prisma.crmSegment.findFirst({
    where: { id: input.segmentId, customerAccountId: input.customerAccountId },
  })
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'Segment not found' }
  if (input.filterDefinition) {
    const valid = validateSegmentFilterGroup(input.filterDefinition)
    if (!valid.ok) return { ok: false, code: 'VALIDATION_ERROR', message: valid.message }
  }
  const row = await prisma.crmSegment.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.filterDefinition ? { filterDefinition: input.filterDefinition } : {}),
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function deleteDynamicSegment(customerAccountId: string, segmentId: string): Promise<CrmResult<true>> {
  const existing = await prisma.crmSegment.findFirst({
    where: { id: segmentId, customerAccountId },
  })
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'Segment not found' }
  await prisma.$transaction([
    prisma.crmSegmentMember.deleteMany({ where: { segmentId, customerAccountId } }),
    prisma.crmSegment.delete({ where: { id: segmentId } }),
  ])
  return { ok: true, value: true }
}

export async function evaluateSegmentForAccount(
  customerAccountId: string,
  filterDefinition: SegmentFilterGroup,
): Promise<
  CrmResult<{
    contactIds: string[]
    matchedContacts: number
    accountContactCount: number
    summary: ReturnType<typeof summarizeSegmentPopulation>
    accountSummary: ReturnType<typeof summarizeSegmentPopulation>
  }>
> {
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
  const contacts = await loadSegmentEvaluationContacts(customerAccountId)
  const views = contacts.map(mapContactToSegmentView)
  const matched = views.filter((view) => evaluateSegmentGroup(view, filterDefinition))
  return {
    ok: true,
    value: {
      contactIds: matched.map((view) => view.id),
      matchedContacts: matched.length,
      accountContactCount: views.length,
      summary: summarizeSegmentPopulation(matched),
      accountSummary: summarizeSegmentPopulation(views),
    },
  }
}

export async function evaluateSavedSegment(
  customerAccountId: string,
  segmentId: string,
): Promise<
  CrmResult<{
    segmentId: string
    contactIds: string[]
    matchedContacts: number
    accountContactCount: number
    summary: ReturnType<typeof summarizeSegmentPopulation>
    accountSummary: ReturnType<typeof summarizeSegmentPopulation>
  }>
> {
  const segment = await prisma.crmSegment.findFirst({
    where: { id: segmentId, customerAccountId },
  })
  if (!segment) return { ok: false, code: 'NOT_FOUND', message: 'Segment not found' }
  if (!segment.filterDefinition) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Segment has no filter definition' }
  }
  const evaluated = await evaluateSegmentForAccount(customerAccountId, segment.filterDefinition as SegmentFilterGroup)
  if (!evaluated.ok) return evaluated
  return { ok: true, value: { segmentId, ...evaluated.value } }
}
