import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
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
    setByUserId: string
    reason?: string
    actorType: 'USER'
  },
): WorkforceResult<{ pauseId: string }> {
  if (input.actorType !== 'USER') {
    return { ok: false, code: 'DENIED', message: 'Only human operators may activate pause controls' }
  }
  const id = nextWorkforceId('wfpause')
  store.pauses.push({
    id,
    scope: input.scope,
    targetKey: input.targetKey,
    active: true,
    reason: input.reason,
    setByUserId: input.setByUserId,
    createdAt: new Date(),
  })
  recordWorkforceAudit(store, {
    actorUserId: input.setByUserId,
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
  const pause = store.pauses.find((p) => p.id === pauseId && p.active)
  if (!pause) return { ok: false, code: 'NOT_FOUND', message: 'Active pause not found' }
  pause.active = false
  pause.releasedAt = new Date()
  recordWorkforceAudit(store, {
    actorUserId: operatorUserId,
    actorType: 'USER',
    eventKind: 'PAUSE_RELEASED',
    detail: { pauseId },
  })
  return { ok: true, value: { released: true } }
}
