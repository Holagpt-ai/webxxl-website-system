import { isCommsBackendEnabled, isCommsIntegrationGatesEnabled } from '@/config/comms-backend'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import {
  evaluateIncludedFreeAccessForAccount,
  type IncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import { assertCommsPermission } from '@/lib/platform/comms/permissions'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'

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

export async function loadCommsExecutionContext(portal: PortalUser) {
  const evidence = await loadSubscriberEvidenceForAccount(portal.customerAccount.id)
  return { portal, evidence, isStaff: isStaffRole(portal.role) }
}

export function resolveCommsExecutionCoreAccess(
  ctx: Awaited<ReturnType<typeof loadCommsExecutionContext>>,
): BusinessModuleReadiness | 'proceed' {
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
    assertCommsPermission(
      { membershipRole: ctx.portal.membership.role, isStaff: ctx.isStaff },
      'comms.read',
    )
  } catch {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Missing communications permission: comms.read' }
  }
  return 'proceed'
}

export function resolveCommsIntegrationSliceAccess(
  ctx: Awaited<ReturnType<typeof loadCommsExecutionContext>>,
): { reasonCode: string; message: string } | null {
  const core = resolveCommsExecutionCoreAccess(ctx)
  if (core !== 'proceed') {
    if (core.state === 'available') {
      return { reasonCode: 'UNAVAILABLE', message: 'Communications module not ready' }
    }
    return { reasonCode: core.reasonCode, message: core.message }
  }
  if (!isCommsIntegrationGatesEnabled()) {
    return { reasonCode: 'NOT_CONFIGURED', message: 'COMMS_INTEGRATION_GATES_ENABLED is false' }
  }
  return null
}
