import type { CapabilityExecutionMode } from '@prisma/client'
import { type EffectiveCapability, isKnownCapability, resolveEffectiveCapability, type CapabilityAssignment } from '@/lib/managed-sites/capabilities'

export type RoutedExecution = 'SELF_SERVICE' | 'AI_ASSISTED' | 'HUMAN_REQUIRED' | 'READ_ONLY' | 'UNAVAILABLE'

export type RouteDecision = {
  mode: RoutedExecution
  capability: EffectiveCapability | null
  reason: 'unknown' | 'disabled' | 'hidden' | 'resolved'
}

/**
 * Deterministic router. It never calls a model.
 * Execution mode comes from the registry plus the stored site assignment.
 */
export function routeManagedSiteRequest(input: {
  capabilityKey: string
  assignment: CapabilityAssignment | null
  actor: 'customer' | 'staff'
  clientExecutionMode?: unknown
}): RouteDecision {
  if (!isKnownCapability(input.capabilityKey)) {
    return { mode: 'UNAVAILABLE', capability: null, reason: 'unknown' }
  }
  const capability = resolveEffectiveCapability(input.capabilityKey, input.assignment, input.clientExecutionMode)
  if (!capability || !capability.enabled) {
    return { mode: 'UNAVAILABLE', capability, reason: 'disabled' }
  }
  if (input.actor === 'customer' && !capability.customerVisible) {
    return { mode: 'UNAVAILABLE', capability, reason: 'hidden' }
  }
  return { mode: capability.executionMode, capability, reason: 'resolved' }
}

export function isMutationMode(mode: CapabilityExecutionMode | RoutedExecution): boolean {
  return mode === 'SELF_SERVICE' || mode === 'AI_ASSISTED' || mode === 'HUMAN_REQUIRED'
}
