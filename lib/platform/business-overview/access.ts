import { isCommsBackendEnabled } from '@/config/comms-backend'
import { isCrmBackendEnabled } from '@/config/crm-backend'
import { isMktBackendEnabled } from '@/config/mkt-backend'
import { isSeoBackendEnabled } from '@/config/seo-backend'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import { assertCrmPermission } from '@/lib/platform/crm/permissions'
import { assertMarketingPermission, hasMarketingPermission } from '@/lib/platform/marketing/permissions'
import { assertSeoPermission } from '@/lib/platform/seo/permissions'
import { assertCommsPermission } from '@/lib/platform/comms/permissions'
import {
  evaluateIncludedFreeAccessForAccount,
  type IncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import type { BusinessModuleReadiness, BusinessOverviewModule } from '@/lib/platform/business-overview/types'

export type ModuleAccessContext = {
  portal: PortalUser
  evidence: Awaited<ReturnType<typeof loadSubscriberEvidenceForAccount>>
  isStaff: boolean
}

export async function loadModuleAccessContext(portal: PortalUser): Promise<ModuleAccessContext> {
  const evidence = await loadSubscriberEvidenceForAccount(portal.customerAccount.id)
  return { portal, evidence, isStaff: isStaffRole(portal.role) }
}

function readinessFromEntitlement(decision: IncludedFreeAccessDecision): BusinessModuleReadiness | null {
  if (decision.allowed) return null
  switch (decision.access) {
    case 'DISABLED':
      return { state: 'not_configured', reasonCode: decision.code, message: decision.message }
    case 'POLICY_UNRESOLVED':
      return { state: 'policy_unresolved', reasonCode: decision.code, message: decision.message }
    case 'NOT_ELIGIBLE':
    case 'EVIDENCE_UNVERIFIABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return { state: 'not_eligible', reasonCode: decision.code, message: decision.message }
    default:
      return { state: 'not_configured', reasonCode: decision.code, message: decision.message }
  }
}

function availableReadiness(sourceCheckedAt: string, evidenceCount: number): BusinessModuleReadiness {
  return {
    state: 'available',
    empty: evidenceCount === 0,
    sourceCheckedAt,
    evidenceCount,
  }
}

export function resolveCrmModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isCrmBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'CRM_DISABLED', message: 'CRM backend is disabled' }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.crm',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  const blocked = readinessFromEntitlement(decision)
  if (blocked) return blocked
  try {
    assertCrmPermission(
      { membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff },
      'crm.read',
    )
  } catch {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Missing CRM permission: crm.read' }
  }
  return 'proceed'
}

export function resolveMarketingModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
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

export function resolveSeoModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isSeoBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'SEO_DISABLED', message: 'Local SEO backend is disabled' }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.local-seo',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  const blocked = readinessFromEntitlement(decision)
  if (blocked) return blocked
  try {
    assertSeoPermission({ membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff }, 'seo.read')
  } catch {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Missing SEO permission: seo.read' }
  }
  return 'proceed'
}

export function resolveCommsModuleAccess(ctx: ModuleAccessContext): BusinessModuleReadiness | 'proceed' {
  if (!isCommsBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'COMMS_DISABLED', message: 'Communications backend is disabled' }
  }
  const decision = evaluateIncludedFreeAccessForAccount({
    entitlementKey: 'core.communications',
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
  const blocked = readinessFromEntitlement(decision)
  if (blocked) return blocked
  try {
    assertCommsPermission({ membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff }, 'comms.read')
  } catch {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Missing communications permission: comms.read' }
  }
  return 'proceed'
}

export function marketingViewerCanDecide(ctx: ModuleAccessContext): boolean {
  return hasMarketingPermission(
    { membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff },
    'marketing.artifact.review',
  )
}

export function isPrismaMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return code === 'P2021' || code === 'P2022'
}

export function unavailableReadiness(module: BusinessOverviewModule, message: string): BusinessModuleReadiness {
  return {
    state: 'unavailable',
    reasonCode: 'DATA_UNAVAILABLE',
    message: `${module} data unavailable in this environment: ${message}`,
  }
}

export { availableReadiness }
