import type { PricingMode, ProductKind } from '@/lib/platform/commerce/types'

export type CatalogSkeleton = {
  productKey: string
  kind: ProductKind
  name: string
  pricingMode: PricingMode
  purchasable: boolean
  creditEligible: boolean
  eligibilityCohort: string
  entitlementKey: string | null
  providerPassThrough: boolean
  featureFlag: string | null
}

/**
 * Structural catalog only. Amounts, currencies, and promotional prices are configured
 * per CommerceProductPrice and are not embedded here.
 */
export const COMMERCE_CATALOG_SKELETON: CatalogSkeleton[] = [
  {
    productKey: 'website.development',
    kind: 'WEBSITE_PACKAGE',
    name: 'Website development package',
    pricingMode: 'ONE_TIME',
    purchasable: true,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: null,
    providerPassThrough: false,
    featureFlag: null,
  },
  {
    productKey: 'website.hosting',
    kind: 'HOSTING',
    name: 'Website hosting',
    pricingMode: 'RECURRING',
    purchasable: true,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'paid.hosting',
    providerPassThrough: true,
    featureFlag: null,
  },
  {
    productKey: 'domain.registration',
    kind: 'DOMAIN',
    name: 'Domain registration',
    pricingMode: 'ONE_TIME',
    purchasable: true,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'paid.domains',
    providerPassThrough: true,
    featureFlag: null,
  },
  {
    productKey: 'crm.included',
    kind: 'CRM',
    name: 'CRM',
    pricingMode: 'INCLUDED_FREE',
    purchasable: false,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'core.crm',
    providerPassThrough: false,
    featureFlag: null,
  },
  {
    productKey: 'marketing.included',
    kind: 'MARKETING',
    name: 'Marketing services',
    pricingMode: 'INCLUDED_FREE',
    purchasable: false,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'core.marketing-studio',
    providerPassThrough: false,
    featureFlag: null,
  },
  {
    productKey: 'seo.included',
    kind: 'SEO',
    name: 'SEO services',
    pricingMode: 'INCLUDED_FREE',
    purchasable: false,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'core.local-seo',
    providerPassThrough: false,
    featureFlag: null,
  },
  {
    productKey: 'ai.workforce',
    kind: 'AI_WORKFORCE',
    name: 'AI workforce services',
    pricingMode: 'RECURRING',
    purchasable: false,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'future.ai-employee',
    providerPassThrough: false,
    featureFlag: 'commerce.ai-workforce',
  },
  {
    productKey: 'messaging.credits',
    kind: 'MESSAGING_CREDITS',
    name: 'Messaging credit package',
    pricingMode: 'ONE_TIME',
    purchasable: true,
    creditEligible: true,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'paid.sms-usage',
    providerPassThrough: true,
    featureFlag: null,
  },
  {
    productKey: 'website.subscription',
    kind: 'SUBSCRIPTION',
    name: 'Website subscription',
    pricingMode: 'RECURRING',
    purchasable: true,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: 'paid.website-subscription',
    providerPassThrough: false,
    featureFlag: null,
  },
  {
    productKey: 'service.addon',
    kind: 'ADDON',
    name: 'One-time service add-on',
    pricingMode: 'ONE_TIME',
    purchasable: true,
    creditEligible: false,
    eligibilityCohort: 'SUBSCRIBER_ONLY',
    entitlementKey: null,
    providerPassThrough: false,
    featureFlag: null,
  },
]
