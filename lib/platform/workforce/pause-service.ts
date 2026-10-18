import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import { isInternalAgentIdentity, resolveTrustedWorkforceHuman } from '@/lib/platform/workforce/operator-auth'
import type { WorkforcePauseScope, WorkforceResult } from '@/lib/platform/workforce/types'

export function isWorkforcePaused(
  store: WorkforceStore,
  input: { agentKey?: string; taskId?: string; providerKey?: string },
): boolean {
  for (const pause of store.pauses) {
    if (!pause.active) continue
    if (pause.scope === 'GLOBAL') return true
    if (pause.scope === 'AGENT' && input.agentKey && pause.targetKey === input.agentKey) return true
    if (pause.scope === 'TASK' && input.taskId && pause.targetKey === input.taskId) return true
    if (pause.scope === 'PROVIDER' && input.providerKey && pause.targetKey === input.providerKey) return true
  }
  return false
}

export function activatePause(
  store: WorkforceStore,
  input: {
    scope: WorkforcePauseScope
    targetKey: string
    operatorUserId: string
    reason?: string
  },
): WorkforceResult<{ pauseId: string }> {
  const operator = resolveTrustedWorkforceHuman(store, input.operatorUserId, 'workforce.pause')
  if (!operator.ok) return operator
  if (isInternalAgentIdentity(input.operatorUserId)) {
    return { ok: false, code: 'AGENT_IMPERSONATION_DENIED', message: 'Agents cannot control pause policy' }
  }
  const id = nextWorkforceId('wfpause')
  store.pauses.push({
    id,
    scope: input.scope,
    targetKey: input.targetKey,
    active: true,
    reason: input.reason,
    setByUserId: operator.value.userId,
    createdAt: new Date(),
  })
  recordWorkforceAudit(store, {
    actorUserId: operator.value.userId,
    actorType: 'USER',
    eventKind: 'PAUSE_ACTIVATED',
    detail: { scope: input.scope, targetKey: input.targetKey },
  })
  return { ok: true, value: { pauseId: id } }
}

export function releasePause(
  store: WorkforceStore,
  pauseId: string,
  operatorUserId: string,
): WorkforceResult<{ released: true }> {
  const operator = resolveTrustedWorkforceHuman(store, operatorUserId, 'workforce.pause')
  if (!operator.ok) return operator
  const pause = store.pauses.find((p) => p.id === pauseId && p.active)
  if (!pause) return { ok: false, code: 'NOT_FOUND', message: 'Active pause not found' }
  pause.active = false
  pause.releasedAt = new Date()
  recordWorkforceAudit(store, {
    actorUserId: operator.value.userId,
    actorType: 'USER',
    eventKind: 'PAUSE_RELEASED',
    detail: { pauseId },
  })
  return { ok: true, value: { released: true } }
}
