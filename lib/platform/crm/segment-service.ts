import type { CrmSegmentKind } from '@prisma/client'
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

export type SegmentEvaluationContactRow = Awaited<ReturnType<typeof loadSegmentEvaluationContacts>>[number]

export function contactHasUsableEmailIdentity(row: {
  channelIdentities: readonly { identityType: string; normalizedValue: string }[]
}): boolean {
  return row.channelIdentities.some(
    (identity) =>
      identity.identityType === 'EMAIL' &&
      identity.normalizedValue.trim().length > 0 &&
      identity.normalizedValue.includes('@'),
  )
}

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
      expiresAt: row.expiresAt,
    })),
    suppressions: c.suppressions.map((row) => ({ channel: row.channel, purpose: row.purpose, active: row.active })),
  }
}

async function loadSegmentEvaluationContacts(customerAccountId: string) {
  return prisma.crmContact.findMany({
    where: { customerAccountId, status: 'ACTIVE' },
    include: {
      contactTags: { include: { tag: true } },
      channelIdentities: { where: { identityType: 'EMAIL' } },
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

async function assertSegmentEvaluationWithinLimit(customerAccountId: string): Promise<CrmResult<number>> {
  const total = await prisma.crmContact.count({ where: { customerAccountId, status: 'ACTIVE' } })
  if (total > CRM_SEGMENT_EVAL_MAX_CONTACTS) {
    return {
      ok: false,
      code: 'QUOTA_EXCEEDED',
      message: 'Segment evaluation contact population exceeds synchronous limit',
    }
  }
  return { ok: true, value: total }
}

async function matchSavedSegmentContacts(input: {
  customerAccountId: string
  segment: { id: string; kind: CrmSegmentKind; filterDefinition: unknown }
  views: SegmentContactView[]
}): Promise<CrmResult<SegmentContactView[]>> {
  if (input.segment.kind === 'STATIC') {
    const members = await prisma.crmSegmentMember.findMany({
      where: { segmentId: input.segment.id, customerAccountId: input.customerAccountId },
      select: { contactId: true },
    })
    const memberIds = new Set(members.map((row) => row.contactId))
    return { ok: true, value: input.views.filter((view) => memberIds.has(view.id)) }
  }
  if (!input.segment.filterDefinition) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Segment has no filter definition' }
  }
  const filterDefinition = input.segment.filterDefinition as SegmentFilterGroup
  const valid = validateSegmentFilterGroup(filterDefinition)
  if (!valid.ok) return { ok: false, code: 'VALIDATION_ERROR', message: valid.message }
  return {
    ok: true,
    value: input.views.filter((view) => evaluateSegmentGroup(view, filterDefinition)),
  }
}

export async function resolveSavedSegmentMatches(
  customerAccountId: string,
  segmentId: string,
): Promise<
  CrmResult<{
    segment: { id: string; name: string; kind: CrmSegmentKind; updatedAt: Date }
    matchedViews: SegmentContactView[]
    allViews: SegmentContactView[]
    contactRowsById: Map<string, SegmentEvaluationContactRow>
    accountContactCount: number
  }>
> {
  const segment = await prisma.crmSegment.findFirst({
    where: { id: segmentId, customerAccountId },
  })
  if (!segment) return { ok: false, code: 'NOT_FOUND', message: 'Segment not found' }
  const withinLimit = await assertSegmentEvaluationWithinLimit(customerAccountId)
  if (!withinLimit.ok) return withinLimit
  const contacts = await loadSegmentEvaluationContacts(customerAccountId)
  const views = contacts.map(mapContactToSegmentView)
  const matched = await matchSavedSegmentContacts({
    customerAccountId,
    segment,
    views,
  })
  if (!matched.ok) return matched
  const contactRowsById = new Map(contacts.map((row) => [row.id, row]))
  return {
    ok: true,
    value: {
      segment: { id: segment.id, name: segment.name, kind: segment.kind, updatedAt: segment.updatedAt },
      matchedViews: matched.value,
      allViews: views,
      contactRowsById,
      accountContactCount: views.length,
    },
  }
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
  const withinLimit = await assertSegmentEvaluationWithinLimit(customerAccountId)
  if (!withinLimit.ok) return withinLimit
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
  const resolved = await resolveSavedSegmentMatches(customerAccountId, segmentId)
  if (!resolved.ok) return resolved
  const { matchedViews, allViews, accountContactCount } = resolved.value
  return {
    ok: true,
    value: {
      segmentId,
      contactIds: matchedViews.map((view) => view.id),
      matchedContacts: matchedViews.length,
      accountContactCount,
      summary: summarizeSegmentPopulation(matchedViews),
      accountSummary: summarizeSegmentPopulation(allViews),
    },
  }
}
