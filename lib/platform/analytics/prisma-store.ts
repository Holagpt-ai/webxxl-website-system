import { prisma } from '@/lib/db'
import { isStaffRole } from '@/lib/admin/roles'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import type { AnalyticsStore } from '@/lib/platform/analytics/store'
import type { SeoAnalyticsProvider } from '@prisma/client'

export const prismaAnalyticsStore: AnalyticsStore = {
  isStaff(_userId, platformRole) {
    return isStaffRole(platformRole as import('@prisma/client').UserRole)
  },
  async hasOperatingMembership(userId, customerAccountId) {
    const row = await prisma.customerMembership.findFirst({
      where: { userId, customerAccountId },
      select: { id: true },
    })
    return Boolean(row)
  },
  async resolveManagedSite(customerAccountId, managedSiteId) {
    if (!managedSiteId) {
      const first = await prisma.managedSite.findFirst({
        where: { customerAccountId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, domain: true },
      })
      return first
    }
    return prisma.managedSite.findFirst({
      where: { id: managedSiteId, customerAccountId },
      select: { id: true, name: true, domain: true },
    })
  },
  async listConnections(customerAccountId, managedSiteId) {
    const sites = await prisma.managedSite.findMany({
      where: { customerAccountId, ...(managedSiteId ? { id: managedSiteId } : {}) },
      select: { id: true, name: true, domain: true },
    })
    if (sites.length === 0) return []
    const connections = await prisma.siteAnalyticsConnection.findMany({
      where: { customerAccountId, managedSiteId: { in: sites.map((s) => s.id) } },
    })
    const siteById = new Map(sites.map((s) => [s.id, s]))
    return connections.map((c) => {
      const site = siteById.get(c.managedSiteId)!
      return {
        managedSiteId: c.managedSiteId,
        siteName: site.name,
        domain: site.domain,
        provider: c.provider,
        propertyRef: c.propertyRef,
        propertyKind: c.propertyKind,
        verificationState: c.verificationState,
        dataState: c.dataState,
        lastVerifiedAt: c.lastVerifiedAt,
        updatedAt: c.updatedAt,
      }
    })
  },
  async listMetrics(input) {
    return prisma.seoMetricObservation.findMany({
      where: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        ...(input.metricDefinitions?.length ? { metricDefinition: { in: input.metricDefinitions } } : {}),
        OR: [
          { date: { gte: input.range.start, lte: input.range.end } },
          { date: null, observedAt: { gte: input.range.start, lte: input.range.end } },
        ],
      },
      select: {
        metricDefinition: true,
        dimension: true,
        dimensionValue: true,
        value: true,
        dataState: true,
        date: true,
        observedAt: true,
      },
    })
  },
  async listKeywordObservations(input) {
    return prisma.seoKeywordObservation.findMany({
      where: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        provider: 'GSC',
        date: { gte: input.range.start, lte: input.range.end },
      },
      select: {
        clicks: true,
        impressions: true,
        ctr: true,
        averagePosition: true,
        date: true,
        dataState: true,
        idempotencyKey: true,
        observedAt: true,
      },
    })
  },
  async countLocalRankObservations(managedSiteId, range) {
    return prisma.localRankObservation.count({
      where: {
        managedSiteId,
        OR: [
          { observedAt: { gte: range.start, lte: range.end } },
          { observedAt: null, ingestedAt: { gte: range.start, lte: range.end } },
        ],
      },
    })
  },
  async listConversionDefinitions(customerAccountId, managedSiteId) {
    return prisma.analyticsConversionDefinition.findMany({
      where: {
        customerAccountId,
        OR: [{ managedSiteId }, { managedSiteId: null }],
        isActive: true,
      },
      select: { id: true, publicId: true, key: true, displayName: true, isActive: true, sourceKind: true },
    })
  },
  async summarizeConversions(input) {
    const grouped = await prisma.analyticsConversionObservation.groupBy({
      by: ['conversionKey', 'sourceProvider', 'dataState'],
      where: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        periodDate: { gte: input.range.start, lte: input.range.end },
      },
      _sum: { count: true, uniqueCount: true },
    })
    const defs = await prisma.analyticsConversionDefinition.findMany({
      where: { customerAccountId: input.customerAccountId },
      select: { key: true, displayName: true },
    })
    const nameByKey = new Map(defs.map((d) => [d.key, d.displayName]))
    return grouped.map((g) => ({
      conversionKey: g.conversionKey,
      displayName: nameByKey.get(g.conversionKey) ?? g.conversionKey,
      count: g._sum.count ?? 0,
      uniqueCount: g._sum.uniqueCount ?? g._sum.count ?? 0,
      sourceProvider: g.sourceProvider,
      dataState: g.dataState,
    }))
  },
  async listSyncRuns(customerAccountId, managedSiteId) {
    return prisma.seoProviderSyncRun.findMany({
      where: { customerAccountId, managedSiteId },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
      select: {
        provider: true,
        status: true,
        dataState: true,
        scheduledAt: true,
        processedAt: true,
        errorClass: true,
      },
    })
  },
  async crmCounts(customerAccountId, range) {
    const [leadsCreated, leadsConverted, openDeals] = await Promise.all([
      prisma.salesLead.count({
        where: { customerAccountId, createdAt: { gte: range.start, lte: range.end } },
      }),
      prisma.salesLead.count({
        where: {
          customerAccountId,
          convertedAt: { gte: range.start, lte: range.end },
        },
      }),
      prisma.crmDeal.count({
        where: { customerAccountId, status: { notIn: ['WON', 'LOST'] } },
      }),
    ])
    return { leadsCreated, leadsConverted, openDeals }
  },
}
