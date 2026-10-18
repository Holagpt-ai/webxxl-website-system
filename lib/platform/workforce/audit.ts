import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import type { ActorType } from '@/lib/platform/identity'

export function recordWorkforceAudit(
  store: WorkforceStore,
  input: {
    taskId?: string
    actorUserId?: string
    actorType: ActorType | 'SYSTEM'
    eventKind: string
    detail?: Record<string, unknown>
  },
): void {
  store.audits.push({
    id: nextWorkforceId('wfaudit'),
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    eventKind: input.eventKind,
    detail: input.detail,
    createdAt: new Date(),
  })
}
