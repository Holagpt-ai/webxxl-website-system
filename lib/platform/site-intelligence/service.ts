import { isEnabled } from '@/config/features'
import { isAnalyticsBackendEnabled, ANALYTICS_DEFAULT_TIMEZONE } from '@/config/analytics-backend'
import { isSeoBackendEnabled } from '@/config/seo-backend'
import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import { assertSeoPermission } from '@/lib/platform/seo/permissions'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { buildAnalyticsOverview } from '@/lib/platform/analytics/bi/summary-service'
import { prismaAnalyticsStore } from '@/lib/platform/analytics/prisma-store'
import { buildGoogleAccountReadiness } from '@/lib/platform/google/account-readiness-service'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import { loadSeoSiteOverview } from '@/lib/platform/seo/seo-overview-service'
import {
  SITE_INTELLIGENCE_PROVENANCE_NOTICE,
} from '@/lib/platform/site-intelligence/constants'
import type {
  SiteIntelligenceSlice,
  SiteIntelligenceSummaryResponse,
} from '@/lib/platform/site-intelligence/types'

export type SiteIntelligenceResult =
  | { ok: true; value: SiteIntelligenceSummaryResponse }
  | { ok: false; code: 'NOT_FOUND'; message: string }

function unavailable<T>(
  sourceModule: SiteIntelligenceSlice<T>['sourceModule'],
  reasonCode: string,
  message: string,
): SiteIntelligenceSlice<T> {
  return { status: 'UNAVAILABLE', sourceModule, reasonCode, message }
}

const SEO_READ_FORBIDDEN_MESSAGE = 'Missing SEO permission: seo.read'

function seoReadDenied(portal: PortalUser): boolean {
  try {
    assertSeoPermission(
      { membershipRole: portal.membership.role, isStaff: isStaffRole(portal.role) },
      'seo.read',
    )
    return false
  } catch {
    return true
  }
}

export async function getSiteIntelligenceSummary(input: {
  portal: PortalUser
  managedSiteId: string
  range: AnalyticsDateRange
}): Promise<SiteIntelligenceResult> {
  const customerAccountId = input.portal.customerAccount.id
  const site = await prismaAnalyticsStore.resolveManagedSite(customerAccountId, input.managedSiteId)
  if (!site) {
    return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found for account' }
  }
  const assembledAt = new Date().toISOString()
  const evidence = await loadSubscriberEvidenceForAccount(customerAccountId)

  const seoEntitlement = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.local-seo',
    customerAccountId,
    evidence,
  })
  const analyticsEntitlement = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.analytics',
    customerAccountId,
    evidence,
  })

  let seo: SiteIntelligenceSummaryResponse['seo'] = unavailable(
    'seo.overview',
    'SEO_DISABLED',
    'Local SEO backend is disabled',
  )
  if (!isSeoBackendEnabled()) {
    seo = unavailable('seo.overview', 'SEO_DISABLED', 'Local SEO backend is disabled')
  } else if (!seoEntitlement.allowed) {
    seo = unavailable('seo.overview', seoEntitlement.code, seoEntitlement.message)
  } else if (seoReadDenied(input.portal)) {
    seo = unavailable('seo.overview', 'FORBIDDEN', SEO_READ_FORBIDDEN_MESSAGE)
  } else {
    const overview = await loadSeoSiteOverview({
      customerAccountId,
      managedSiteId: site.id,
    })
    if (!overview.ok) {
      if (overview.code === 'NOT_FOUND') {
        return { ok: false, code: 'NOT_FOUND', message: overview.message }
      }
      seo = unavailable('seo.overview', overview.code, overview.message)
    } else {
      seo = { status: 'AVAILABLE', sourceModule: 'seo.overview', data: overview.value }
    }
  }

  let analytics: SiteIntelligenceSummaryResponse['analytics'] = unavailable(
    'analytics.overview',
    'ANALYTICS_DISABLED',
    'Analytics backend is disabled',
  )
  if (!isAnalyticsBackendEnabled() || !isEnabled('analyticsBackend')) {
    analytics = unavailable('analytics.overview', 'ANALYTICS_DISABLED', 'Analytics backend is disabled')
  } else if (!analyticsEntitlement.allowed) {
    analytics = unavailable('analytics.overview', analyticsEntitlement.code, analyticsEntitlement.message)
  } else {
    const overview = await buildAnalyticsOverview(prismaAnalyticsStore, {
      customerAccountId,
      managedSiteId: site.id,
      range: input.range,
    })
    analytics = { status: 'AVAILABLE', sourceModule: 'analytics.overview', data: overview }
  }

  let googleReadiness: SiteIntelligenceSummaryResponse['googleReadiness'] = unavailable(
    'google.readiness',
    'READINESS_MODULE_DISABLED',
    'Google provider readiness module disabled',
  )
  if (!isGoogleProviderReadinessEnabled()) {
    googleReadiness = unavailable(
      'google.readiness',
      'READINESS_MODULE_DISABLED',
      'Google provider readiness module disabled',
    )
  } else if (!isSeoBackendEnabled()) {
    googleReadiness = unavailable('google.readiness', 'SEO_DISABLED', 'Local SEO backend is disabled')
  } else if (!seoEntitlement.allowed) {
    googleReadiness = unavailable('google.readiness', seoEntitlement.code, seoEntitlement.message)
  } else if (seoReadDenied(input.portal)) {
    googleReadiness = unavailable('google.readiness', 'FORBIDDEN', SEO_READ_FORBIDDEN_MESSAGE)
  } else {
    const readiness = await buildGoogleAccountReadiness({
      customerAccountId,
      managedSiteId: site.id,
    })
    if (!readiness.ok) {
      if (readiness.code === 'NOT_FOUND') {
        return { ok: false, code: 'NOT_FOUND', message: readiness.message }
      }
      googleReadiness = unavailable('google.readiness', readiness.code, readiness.message)
    } else {
      const siteDto = readiness.value.sites[0]
      if (!siteDto) {
        googleReadiness = unavailable('google.readiness', 'NOT_FOUND', 'No readiness row for managed site')
      } else {
        googleReadiness = { status: 'AVAILABLE', sourceModule: 'google.readiness', data: siteDto }
      }
    }
  }

  return {
    ok: true,
    value: {
      customerAccountId,
      managedSiteId: site.id,
      assembledAt,
      analyticsDateRange: {
        start: input.range.startIso,
        end: input.range.endIso,
        timezone: ANALYTICS_DEFAULT_TIMEZONE,
      },
      provenanceNotice: SITE_INTELLIGENCE_PROVENANCE_NOTICE,
      seo,
      analytics,
      googleReadiness,
    },
  }
}
