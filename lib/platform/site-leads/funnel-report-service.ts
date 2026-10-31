import type { Prisma } from '@prisma/client'
import { Prisma as PrismaNamespace } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SITE_LEAD_FUNNEL_MAX_GROUP_ROWS } from '@/config/site-lead-intake'
import { parseSiteLeadFunnelDateRange, type SiteLeadFunnelDateRange } from '@/lib/platform/site-leads/funnel-date-range'
import {
  countManagedSiteLeadStatusBundle,
  siteLeadSummaryMetricsFromCounts,
  type SiteLeadStatusCountBundle,
} from '@/lib/platform/site-leads/funnel-metrics'
import type { SiteLeadResult, SiteLeadSummaryMetric } from '@/lib/platform/site-leads/types'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

export type SiteLeadFunnelTrendPoint = {
  date: string
  leadsCreated: number
}

export type SiteLeadFunnelGroupRow = {
  key: string
  counts: SiteLeadStatusCountBundle
}

export type SiteLeadFunnelAttributionCoverage = {
  state: 'verified_partial' | 'none'
  /** Stable keys for EN/ES UI copy (Batch 30B). */
  labelKeys: string[]
  analyticsEventLinkedLeads: number
  message: string
}

export type SiteLeadFunnelReport = {
  customerAccountId: string
  generatedAt: string
  filters: {
    managedSiteId: string | null
    formReference: string | null
    createdFrom: string
    createdTo: string
  }
  semantics: {
    cohortCreatedInRange: string
    lifecycleCounts: string
    conversionsInPeriod: string
    qualifiedEventsInPeriod: string
    rejectedEventsInPeriod: string
  }
  summary: Record<string, SiteLeadSummaryMetric>
  conversionsInPeriod: SiteLeadSummaryMetric
  qualifiedEventsInPeriod: SiteLeadSummaryMetric
  rejectedEventsInPeriod: SiteLeadSummaryMetric
  byManagedSite: SiteLeadFunnelGroupRow[]
  byFormReference: SiteLeadFunnelGroupRow[]
  creationTrend: SiteLeadFunnelTrendPoint[]
  attribution: SiteLeadFunnelAttributionCoverage
}

function cohortWhere(input: {
  customerAccountId: string
  managedSiteId?: string | null
  formReference?: string | null
  range: SiteLeadFunnelDateRange
}): Prisma.ManagedSiteLeadWhereInput {
  return {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    ...(input.formReference ? { formReference: input.formReference } : {}),
    createdAt: { gte: input.range.createdFrom, lt: input.range.createdToExclusive },
  }
}

function scopeWhere(input: {
  customerAccountId: string
  managedSiteId?: string | null
  formReference?: string | null
}): Prisma.ManagedSiteLeadWhereInput {
  return {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    ...(input.formReference ? { formReference: input.formReference } : {}),
  }
}

async function countEventInPeriod(
  where: Prisma.ManagedSiteLeadWhereInput,
  field: 'convertedAt' | 'qualifiedAt' | 'rejectedAt',
  range: SiteLeadFunnelDateRange,
): Promise<number> {
  return prisma.managedSiteLead.count({
    where: {
      ...where,
      [field]: { gte: range.createdFrom, lt: range.createdToExclusive },
    },
  })
}

async function loadCreationTrend(
  customerAccountId: string,
  range: SiteLeadFunnelDateRange,
  managedSiteId?: string | null,
  formReference?: string | null,
): Promise<SiteLeadFunnelTrendPoint[]> {
  const siteFilter = managedSiteId
    ? PrismaNamespace.sql`AND "managedSiteId" = ${managedSiteId}`
    : PrismaNamespace.sql``
  const formFilter = formReference
    ? PrismaNamespace.sql`AND "formReference" = ${formReference}`
    : PrismaNamespace.sql``
  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>(PrismaNamespace.sql`
    SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
    FROM "ManagedSiteLead"
    WHERE "customerAccountId" = ${customerAccountId}
      AND "createdAt" >= ${range.createdFrom}
      AND "createdAt" < ${range.createdToExclusive}
      ${siteFilter}
      ${formFilter}
    GROUP BY day
    ORDER BY day ASC
    LIMIT ${SITE_LEAD_FUNNEL_MAX_GROUP_ROWS * 8}
  `)
  return rows.map((row) => ({
    date: row.day.toISOString().slice(0, 10),
    leadsCreated: Number(row.count),
  }))
}

async function loadGroupCounts(
  customerAccountId: string,
  range: SiteLeadFunnelDateRange,
  field: 'managedSiteId' | 'formReference',
): Promise<SiteLeadFunnelGroupRow[]> {
  const cohort = cohortWhere({ customerAccountId, range })
  const grouped = await prisma.managedSiteLead.groupBy({
    by: [field],
    where: {
      ...cohort,
      ...(field === 'formReference' ? { formReference: { not: null } } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: SITE_LEAD_FUNNEL_MAX_GROUP_ROWS,
  })
  const rows: SiteLeadFunnelGroupRow[] = []
  for (const row of grouped) {
    const key = String(row[field] ?? '')
    if (!key) continue
    const counts = await countManagedSiteLeadStatusBundle(
      cohortWhere({
        customerAccountId,
        range,
        ...(field === 'managedSiteId' ? { managedSiteId: key } : { formReference: key }),
      }),
    )
    rows.push({ key, counts })
  }
  return rows
}

async function loadAttributionCoverage(
  where: Prisma.ManagedSiteLeadWhereInput,
): Promise<SiteLeadFunnelAttributionCoverage> {
  const analyticsEventLinkedLeads = await prisma.managedSiteLead.count({
    where: { ...where, analyticsEventRef: { not: null } },
  })
  const withSource = await prisma.managedSiteLead.count({
    where: { ...where, sourceAttribution: { not: PrismaNamespace.DbNull } },
  })
  const labelKeys = [
    'siteLeads.attribution.managedSiteId',
    'siteLeads.attribution.formReference',
    'siteLeads.attribution.submittedAt',
    'siteLeads.attribution.createdAt',
    'siteLeads.attribution.sourceAttribution',
  ]
  if (analyticsEventLinkedLeads > 0 || withSource > 0) {
    return {
      state: 'verified_partial',
      labelKeys: [...labelKeys, 'siteLeads.attribution.analyticsEventRef'],
      analyticsEventLinkedLeads,
      message:
        'Source fields are reported from stored lead records only. Analytics event links are shown when analyticsEventRef is present; no advertising ROI or campaign conversion is inferred.',
    }
  }
  return {
    state: 'none',
    labelKeys,
    analyticsEventLinkedLeads: 0,
    message:
      'No verified analytics linkage in this cohort. Provenance uses managedSiteId, formReference, and timestamps from ManagedSiteLead records only.',
  }
}

export async function getManagedSiteLeadFunnelReport(input: {
  customerAccountId: string
  managedSiteId?: string | null
  formReference?: string | null
  createdFromRaw?: string | null
  createdToRaw?: string | null
  now?: Date
}): Promise<SiteLeadResult<SiteLeadFunnelReport>> {
  if (input.managedSiteId) {
    const site = await getManagedSiteForAccount(input.managedSiteId, input.customerAccountId)
    if (!site) {
      return { ok: false, code: 'FORBIDDEN', message: 'Managed site not found for this account' }
    }
  }

  const parsedRange = parseSiteLeadFunnelDateRange({
    createdFromRaw: input.createdFromRaw ?? null,
    createdToRaw: input.createdToRaw ?? null,
    now: input.now,
  })
  if (!parsedRange.ok) {
    return { ok: false, code: 'VALIDATION', message: parsedRange.message }
  }
  const range = parsedRange.value
  const cohort = cohortWhere({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    formReference: input.formReference,
    range,
  })
  const scope = scopeWhere({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    formReference: input.formReference,
  })

  const [cohortCounts, conversionsInPeriod, qualifiedEventsInPeriod, rejectedEventsInPeriod, byManagedSite, byFormReference, creationTrend, attribution] =
    await Promise.all([
      countManagedSiteLeadStatusBundle(cohort),
      countEventInPeriod(scope, 'convertedAt', range),
      countEventInPeriod(scope, 'qualifiedAt', range),
      countEventInPeriod(scope, 'rejectedAt', range),
      input.managedSiteId ? Promise.resolve([]) : loadGroupCounts(input.customerAccountId, range, 'managedSiteId'),
      input.formReference ? Promise.resolve([]) : loadGroupCounts(input.customerAccountId, range, 'formReference'),
      loadCreationTrend(input.customerAccountId, range, input.managedSiteId, input.formReference),
      loadAttributionCoverage(cohort),
    ])

  const now = input.now ?? new Date()
  return {
    ok: true,
    value: {
      customerAccountId: input.customerAccountId,
      generatedAt: now.toISOString(),
      filters: {
        managedSiteId: input.managedSiteId ?? null,
        formReference: input.formReference ?? null,
        createdFrom: range.createdFromIso,
        createdTo: range.createdToInclusiveIso,
      },
      semantics: {
        cohortCreatedInRange: 'Counts include leads whose createdAt falls within the selected date range.',
        lifecycleCounts: 'Status buckets reflect the current lifecycle state of leads in that cohort (not historical snapshots).',
        conversionsInPeriod:
          'conversionsInPeriod counts leads whose convertedAt timestamp falls within the range. Conversion means CRM contact creation, not a completed sale.',
        qualifiedEventsInPeriod: 'qualifiedEventsInPeriod uses qualifiedAt within the range when present.',
        rejectedEventsInPeriod: 'rejectedEventsInPeriod uses rejectedAt within the range when present.',
      },
      summary: siteLeadSummaryMetricsFromCounts(cohortCounts),
      conversionsInPeriod: { value: conversionsInPeriod, scope: 'account_total' },
      qualifiedEventsInPeriod: { value: qualifiedEventsInPeriod, scope: 'account_total' },
      rejectedEventsInPeriod: { value: rejectedEventsInPeriod, scope: 'account_total' },
      byManagedSite,
      byFormReference,
      creationTrend,
      attribution,
    },
  }
}

export { parseSiteLeadFunnelDateRange }
