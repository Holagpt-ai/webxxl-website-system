import { isEnabled, type FeatureFlag } from '@/config/features'
import {
  getMarketplaceCatalog,
  type FreeServiceEligibilityCohort,
  type ServiceBillingClass,
  type ServicePricingMode,
} from '@/lib/marketplace/catalog'

export type { FreeServiceEligibilityCohort, ServicePricingMode }

export type EntitlementAccessState = 'INCLUDED' | 'PAID' | 'DISABLED' | 'POLICY_UNRESOLVED'

export type ServiceEntitlementDefinition = {
  entitlementKey: string
  name: string
  pricingMode: ServicePricingMode
  includedOrPaid: 'INCLUDED_FREE' | 'PAID'
  eligibleSubscriberCohort: FreeServiceEligibilityCohort
  featureFlag?: FeatureFlag
  purchasable: boolean
  providerPassThrough: boolean
  fairUsePolicy?: string
}

export const FREE_SERVICE_ELIGIBILITY_DEFAULT: FreeServiceEligibilityCohort = 'UNRESOLVED'

export const PLATFORM_ENTITLEMENTS: ServiceEntitlementDefinition[] = [
  {
    entitlementKey: 'core.crm',
    name: 'CRM',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
    fairUsePolicy: 'Included software service; carrier and provider usage remain separately billed.',
  },
  {
    entitlementKey: 'core.communications',
    name: 'Unified communications',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
    fairUsePolicy: 'Included inbox software; SMS/email/voice carrier usage billed separately via wallet.',
  },
  {
    entitlementKey: 'core.marketing-studio',
    name: 'Marketing Studio',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'core.social-automation',
    name: 'Postiz social automation',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'core.local-seo',
    name: 'Local SEO intelligence',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'core.analytics',
    name: 'Analytics & business intelligence',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    featureFlag: 'analyticsBackend',
    purchasable: false,
    providerPassThrough: false,
    fairUsePolicy: 'Read-only reporting; provider credentials and ingestion remain separately authorized.',
  },
  {
    entitlementKey: 'core.ai-landing-pages',
    name: 'AI landing-page production',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'core.campaign-preparation',
    name: 'Campaign preparation',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'core.ad-creative',
    name: 'Ad creative',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
    fairUsePolicy: 'Creative production is included. Ad platform spend is never implied.',
  },
  {
    entitlementKey: 'core.ai-marketing-agents',
    name: 'Included AI marketing agents',
    pricingMode: 'INCLUDED_FREE',
    includedOrPaid: 'INCLUDED_FREE',
    eligibleSubscriberCohort: 'UNRESOLVED',
    purchasable: false,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'paid.website-subscription',
    name: 'Website subscription',
    pricingMode: 'RECURRING',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    purchasable: true,
    providerPassThrough: false,
  },
  {
    entitlementKey: 'paid.sms-usage',
    name: 'SMS usage',
    pricingMode: 'METERED_EXTERNAL',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    purchasable: true,
    providerPassThrough: true,
  },
  {
    entitlementKey: 'paid.hosting',
    name: 'Hosting',
    pricingMode: 'RECURRING',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    purchasable: true,
    providerPassThrough: true,
  },
  {
    entitlementKey: 'paid.domains',
    name: 'Domains',
    pricingMode: 'ONE_TIME',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    purchasable: true,
    providerPassThrough: true,
  },
  {
    entitlementKey: 'paid.business-email',
    name: 'Business email',
    pricingMode: 'RECURRING',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    purchasable: true,
    providerPassThrough: true,
  },
  {
    entitlementKey: 'future.ai-employee',
    name: 'Customer-purchased AI employee',
    pricingMode: 'RECURRING',
    includedOrPaid: 'PAID',
    eligibleSubscriberCohort: 'SUBSCRIBER_ONLY',
    featureFlag: 'purchasableAiEmployees',
    purchasable: true,
    providerPassThrough: false,
  },
]

export function resolveFreeServiceEligibility(
  configured?: FreeServiceEligibilityCohort,
): FreeServiceEligibilityCohort {
  return configured ?? FREE_SERVICE_ELIGIBILITY_DEFAULT
}

export function getServiceEntitlement(entitlementKey: string): ServiceEntitlementDefinition | undefined {
  return PLATFORM_ENTITLEMENTS.find((item) => item.entitlementKey === entitlementKey)
}

export function listIncludedFreeEntitlements(): ServiceEntitlementDefinition[] {
  return PLATFORM_ENTITLEMENTS.filter((item) => item.pricingMode === 'INCLUDED_FREE')
}

export function listPaidEntitlements(): ServiceEntitlementDefinition[] {
  return PLATFORM_ENTITLEMENTS.filter((item) => item.includedOrPaid === 'PAID')
}

export function evaluateEntitlementAccess(
  entitlement: ServiceEntitlementDefinition,
  options?: { configuredCohort?: FreeServiceEligibilityCohort },
): { classification: ServicePricingMode; access: EntitlementAccessState } {
  if (entitlement.featureFlag && !isEnabled(entitlement.featureFlag)) {
    return { classification: entitlement.pricingMode, access: 'DISABLED' }
  }
  if (entitlement.pricingMode === 'INCLUDED_FREE') {
    const cohort = resolveFreeServiceEligibility(
      options?.configuredCohort ?? entitlement.eligibleSubscriberCohort,
    )
    if (cohort === 'UNRESOLVED') {
      return { classification: 'INCLUDED_FREE', access: 'POLICY_UNRESOLVED' }
    }
    return { classification: 'INCLUDED_FREE', access: 'INCLUDED' }
  }
  return { classification: entitlement.pricingMode, access: 'PAID' }
}

export function pricingModeFromLegacyBillingClass(billingClass: ServiceBillingClass): ServicePricingMode {
  return billingClass
}

export function existingMarketplacePricesUnchanged(): boolean {
  return getMarketplaceCatalog().every((item) => item.billingClass === 'ONE_TIME' || item.billingClass === 'RECURRING')
}
