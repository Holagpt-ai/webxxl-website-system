import { isMktBackendEnabled } from '@/config/mkt-backend'
import { isSocialExecutionGatesEnabled, isSocialMarketingEnabled } from '@/config/social-marketing'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import {
  evaluateIncludedFreeAccessForAccount,
  type IncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import { assertMarketingPermission } from '@/lib/platform/marketing/permissions'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'

function blockedFromModuleAccess(
  access: BusinessModuleReadiness | 'proceed',
): { reasonCode: string; message: string } | null {
  if (access === 'proceed') return null
  if (access.state === 'available') return null
  return { reasonCode: access.reasonCode, message: access.message }
}

function readinessFromEntitlement(decision: IncludedFreeAccessDecision): BusinessModuleReadiness | null {
  if (decision.allowed) return null
  switch (decision.access) {
    case 'DISABLED':
      return { state: 'not_configured', reasonCode: decision.code, message: decision.message }
    case 'POLICY_UNRESOLVED':
      return { state: 'policy_unresolved', reasonCode: decision.code, message: decision.message }
    default:
      return { state: 'not_eligible', reasonCode: decision.code, message: decision.message }
  }
}

export async function loadMarketingExecutionContext(portal: PortalUser) {
  const evidence = await loadSubscriberEvidenceForAccount(portal.customerAccount.id)
  return { portal, evidence, isStaff: isStaffRole(portal.role) }
}

export function resolveMarketingExecutionCoreAccess(
  ctx: Awaited<ReturnType<typeof loadMarketingExecutionContext>>,
): BusinessModuleReadiness | 'proceed' {
  if (!isMktBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'MKT_DISABLED', message: 'Marketing backend is disabled' }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.marketing-studio',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  const blocked = readinessFromEntitlement(decision)
  if (blocked) return blocked
  try {
    assertMarketingPermission(
      { membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff },
      'marketing.read',
    )
  } catch {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Missing marketing permission: marketing.read' }
  }
  return 'proceed'
}

export function resolveSocialReadinessSliceAccess(
  ctx: Awaited<ReturnType<typeof loadMarketingExecutionContext>>,
): { reasonCode: string; message: string } | null {
  if (!isSocialMarketingEnabled()) {
    return { reasonCode: 'SOCIAL_MARKETING_DISABLED', message: 'Social Marketing Studio backend is disabled' }
  }
  if (!isSocialExecutionGatesEnabled()) {
    return { reasonCode: 'NOT_CONFIGURED', message: 'SOCIAL_EXECUTION_GATES_ENABLED is false' }
  }
  for (const entitlementKey of ['core.social-automation', 'core.marketing-studio'] as const) {
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey,
      customerAccountId: ctx.portal.customerAccount.id,
      evidence: ctx.evidence,
    })
    if (!decision.allowed) {
      return { reasonCode: decision.code, message: decision.message }
    }
  }
  try {
    assertMarketingPermission(
      { membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff },
      'marketing.read',
    )
  } catch {
    return { reasonCode: 'FORBIDDEN', message: 'Missing marketing permission: marketing.read' }
  }
  return null
}

export function resolveCrmAudiencePlanningSliceAccess(
  ctx: Awaited<ReturnType<typeof loadMarketingExecutionContext>>,
): { reasonCode: string; message: string } | null {
  for (const entitlementKey of ['core.crm', 'core.marketing-studio'] as const) {
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey,
      customerAccountId: ctx.portal.customerAccount.id,
      evidence: ctx.evidence,
    })
    if (!decision.allowed) {
      return { reasonCode: decision.code, message: decision.message }
    }
  }
  return blockedFromModuleAccess(resolveMarketingExecutionCoreAccess(ctx))
}
