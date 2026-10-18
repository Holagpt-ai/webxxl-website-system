import type { FeatureFlag } from '@/config/features'
import type { PortalModuleKey } from '@/lib/portal/modules'
import type { ServicePricingMode } from '@/lib/platform/entitlements'

export type ModuleAvailabilityStatus = 'EXISTING' | 'PLANNED' | 'DISABLED' | 'CANDIDATE'

export type PlatformModuleContract = {
  moduleKey: PortalModuleKey | 'marketingStudio' | 'communications' | 'wallet'
  minRole: 'MEMBER' | 'OWNER' | 'BILLING_VIEWER' | 'BILLING_ADMIN'
  entitlement?: string
  featureFlag?: FeatureFlag
  routes: string[]
  requiredIntegrations: string[]
  sourceOfTruth: string
  includedOrPaid: ServicePricingMode
  availabilityStatus: ModuleAvailabilityStatus
}

export const PLATFORM_MODULE_CONTRACTS: PlatformModuleContract[] = [
  {
    moduleKey: 'project',
    minRole: 'MEMBER',
    routes: ['/dashboard', '/dashboard/project'],
    requiredIntegrations: [],
    sourceOfTruth: 'WebXXL Project',
    includedOrPaid: 'RECURRING',
    availabilityStatus: 'EXISTING',
  },
  {
    moduleKey: 'crm',
    minRole: 'MEMBER',
    entitlement: 'core.crm',
    routes: [],
    requiredIntegrations: ['crm'],
    sourceOfTruth: 'WebXXL contact refs + CRM provider',
    includedOrPaid: 'INCLUDED_FREE',
    availabilityStatus: 'PLANNED',
  },
  {
    moduleKey: 'marketingStudio',
    minRole: 'MEMBER',
    entitlement: 'core.marketing-studio',
    routes: [],
    requiredIntegrations: ['social'],
    sourceOfTruth: 'WebXXL marketing artifacts + Postiz',
    includedOrPaid: 'INCLUDED_FREE',
    availabilityStatus: 'PLANNED',
  },
  {
    moduleKey: 'seo',
    minRole: 'MEMBER',
    entitlement: 'core.local-seo',
    routes: [],
    requiredIntegrations: ['seo'],
    sourceOfTruth: 'WebXXL SEO snapshots',
    includedOrPaid: 'INCLUDED_FREE',
    availabilityStatus: 'PLANNED',
  },
  {
    moduleKey: 'wallet',
    minRole: 'BILLING_VIEWER',
    entitlement: 'paid.sms-usage',
    routes: [],
    requiredIntegrations: ['sms', 'payment'],
    sourceOfTruth: 'WebXXL CreditWallet',
    includedOrPaid: 'METERED_EXTERNAL',
    availabilityStatus: 'PLANNED',
  },
  {
    moduleKey: 'ai',
    minRole: 'OWNER',
    entitlement: 'future.ai-employee',
    featureFlag: 'purchasableAiEmployees',
    routes: [],
    requiredIntegrations: ['workforce'],
    sourceOfTruth: 'WebXXL agent instance',
    includedOrPaid: 'RECURRING',
    availabilityStatus: 'DISABLED',
  },
]
