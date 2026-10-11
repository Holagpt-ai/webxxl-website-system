import { prisma } from '@/lib/db'
import type { AutomationEventType, Prisma } from '@prisma/client'
import { isEnabled } from '@/config/features'
import { planDeliveriesForEvent } from '@/lib/automation/plan-deliveries'

async function flushPendingDeliveries() {
  const { processAutomationDeliveryBatch } = await import('@/lib/automation/worker')
  await processAutomationDeliveryBatch(10)
}

export async function emitAutomationEvent(input: {
  eventType: AutomationEventType
  dedupeKey: string
  customerAccountId?: string | null
  actorUserId?: string | null
  payload: Record<string, unknown>
}) {
  if (!isEnabled('automationNotifications')) {
    return { ok: true as const, duplicate: false, skipped: true as const }
  }

  const data: Prisma.AutomationEventCreateInput = {
    dedupeKey: input.dedupeKey,
    eventType: input.eventType,
    payload: input.payload as Prisma.InputJsonValue,
    customerAccount: input.customerAccountId ? { connect: { id: input.customerAccountId } } : undefined,
    actor: input.actorUserId ? { connect: { id: input.actorUserId } } : undefined,
  }

  try {
    const event = await prisma.automationEvent.create({ data })
    const planned = await planDeliveriesForEvent(event)
    try {
      await flushPendingDeliveries()
    } catch {
      // Outbox retains pending jobs for the worker endpoint.
    }
    return { ok: true as const, duplicate: false, eventId: event.id, jobsPlanned: planned.created }
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : ''
    if (code === 'P2002') {
      const existing = await prisma.automationEvent.findUnique({ where: { dedupeKey: input.dedupeKey } })
      return { ok: true as const, duplicate: true, eventId: existing?.id, jobsPlanned: 0 }
    }
    throw error
  }
}

/** Best-effort wrapper for mutation hooks. */
export async function emitAutomationEventBestEffort(input: Parameters<typeof emitAutomationEvent>[0]) {
  try {
    await emitAutomationEvent(input)
  } catch {
    // Domain mutation already succeeded.
  }
}
