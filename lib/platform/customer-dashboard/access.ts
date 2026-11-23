import { isEnabled } from '@/config/features'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { isCommerceBackendEnabled } from '@/config/commerce-backend'
import {
  isCustomerAiPilotPrepEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import {
  loadModuleAccessContext,
  resolveCommsModuleAccess,
  resolveCrmModuleAccess,
  resolveMarketingModuleAccess,
  resolveSeoModuleAccess,
  type ModuleAccessContext,
} from '@/lib/platform/business-overview/access'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'

export { loadModuleAccessContext }

export function resolveWebsiteProjectsModuleAccess(_ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  return 'proceed'
}

export function resolveAnalyticsModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isAnalyticsBackendEnabled() || !isEnabled('analyticsBackend')) {
    return { state: 'disabled', reasonCode: 'ANALYTICS_DISABLED', message: 'Analytics backend is disabled' }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.analytics',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  if (!decision.allowed) {
    if (decision.access === 'DISABLED') {
      return { state: 'not_configured', reasonCode: decision.code, message: decision.message }
    }
    if (decision.access === 'POLICY_UNRESOLVED') {
      return { state: 'policy_unresolved', reasonCode: decision.code, message: decision.message }
    }
    return { state: 'not_eligible', reasonCode: decision.code, message: decision.message }
  }
  return 'proceed'
}

export function resolveCommerceModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isCommerceBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'COMMERCE_DISABLED', message: 'Commerce backend is disabled' }
  }
  if (!ctx.portal.customerAccount?.id) {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Customer account membership required' }
  }
  return 'proceed'
}

export function resolveBillingModuleAccess(_ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  return 'proceed'
}

export function resolveAiEmployeesModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isCustomerAiWorkforceEnabled() && !isCustomerAiPilotPrepEnabled()) {
    return {
      state: 'disabled',
      reasonCode: 'CUSTOMER_AI_WORKFORCE_DISABLED',
      message: 'Customer AI workforce is disabled',
    }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.ai-marketing-agents',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  if (!decision.allowed) {
    if (decision.access === 'POLICY_UNRESOLVED') {
      return { state: 'policy_unresolved', reasonCode: decision.code, message: decision.message }
    }
    return { state: 'not_eligible', reasonCode: decision.code, message: decision.message }
  }
  return 'proceed'
}

export function resolveAutomationModuleAccess(_ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isEnabled('automationNotifications')) {
    return {
      state: 'disabled',
      reasonCode: 'AUTOMATION_NOTIFICATIONS_DISABLED',
      message: 'Automation notifications are disabled',
    }
  }
  return 'proceed'
}

export function readinessOrAvailable(
  access: BusinessModuleReadiness | 'proceed',
  now: Date,
): BusinessModuleReadiness {
  if (access === 'proceed') {
    return {
      state: 'available',
      empty: false,
      sourceCheckedAt: now.toISOString(),
      evidenceCount: 0,
    }
  }
  return access
}

export const dashboardModuleAccessResolvers = {
  crm: resolveCrmModuleAccess,
  website_projects: resolveWebsiteProjectsModuleAccess,
  marketing_studio: resolveMarketingModuleAccess,
  local_seo: resolveSeoModuleAccess,
  analytics: resolveAnalyticsModuleAccess,
  communications: resolveCommsModuleAccess,
  commerce: resolveCommerceModuleAccess,
  billing: resolveBillingModuleAccess,
  ai_employees: resolveAiEmployeesModuleAccess,
  automation: resolveAutomationModuleAccess,
} as const