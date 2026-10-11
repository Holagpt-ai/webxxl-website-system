import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import type { ServiceOrderStatus } from '@prisma/client'
import { getMarketplaceService, isMarketplaceServiceVisible } from '@/lib/marketplace/catalog'
import { writeServiceOrderActivity } from '@/lib/marketplace/activity'
import { canTransitionServiceOrder, OPEN_SERVICE_ORDER_STATUSES } from '@/lib/marketplace/transitions'

function buildPublicOrderId(): string {
  return `WO-${Date.now().toString(36).toUpperCase()}`
}

function buildSubmissionFingerprint(input: {
  customerAccountId: string
  serviceKey: string
  projectId: string | null
}): string {
  return createHash('sha256')
    .update(`${input.customerAccountId}|${input.serviceKey}|${input.projectId ?? 'none'}`)
    .digest('hex')
}

export async function createServiceOrderRequest(input: {
  actorUserId: string
  customerAccountId: string
  serviceKey: string
  projectId?: string | null
  customerNotes?: string
}) {
  const definition = getMarketplaceService(input.serviceKey)
  if (!definition || !isMarketplaceServiceVisible(definition)) {
    return { ok: false as const, error: 'unavailable' }
  }
  if (definition.availability === 'UNAVAILABLE') return { ok: false as const, error: 'unavailable' }
  if (definition.availability === 'COMING_SOON') return { ok: false as const, error: 'coming_soon' }
  if (definition.requiresProject && !input.projectId) return { ok: false as const, error: 'project_required' }

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, customerAccountId: input.customerAccountId },
    })
    if (!project) return { ok: false as const, error: 'project_required' }
  }

  const fingerprint = buildSubmissionFingerprint({
    customerAccountId: input.customerAccountId,
    serviceKey: input.serviceKey,
    projectId: input.projectId ?? null,
  })

  const existing = await prisma.serviceOrder.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      serviceKey: input.serviceKey,
      projectId: input.projectId ?? null,
      status: { in: OPEN_SERVICE_ORDER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    return { ok: true as const, duplicate: true, orderId: existing.id, publicId: existing.publicId, status: existing.status }
  }

  const publicId = buildPublicOrderId()
  const order = await prisma.serviceOrder.create({
    data: {
      publicId,
      customerAccountId: input.customerAccountId,
      projectId: input.projectId ?? null,
      requestedById: input.actorUserId,
      serviceKey: input.serviceKey,
      status: 'REQUESTED',
      customerNotes: input.customerNotes?.trim() || null,
      submissionFingerprint: fingerprint,
      billingProvider: null,
      billingProviderRef: null,
    },
  })

  await writeServiceOrderActivity({
    orderId: order.id,
    actorUserId: input.actorUserId,
    type: 'CREATED',
    summary: `Service request submitted (${publicId})`,
    metadata: { serviceKey: input.serviceKey },
  })

  return { ok: true as const, duplicate: false, orderId: order.id, publicId: order.publicId, status: order.status }
}

export async function transitionServiceOrderStatus(input: {
  orderId: string
  actorUserId: string
  nextStatus: ServiceOrderStatus
  internalNote?: string
}) {
  const order = await prisma.serviceOrder.findUnique({ where: { id: input.orderId } })
  if (!order) return { ok: false as const, error: 'not_found' }
  if (!canTransitionServiceOrder(order.status, input.nextStatus)) {
    return { ok: false as const, error: 'invalid_transition' }
  }
  if (order.status === input.nextStatus) return { ok: true as const, orderId: order.id, status: order.status }

  await prisma.serviceOrder.update({
    where: { id: order.id },
    data: { status: input.nextStatus },
  })
  await writeServiceOrderActivity({
    orderId: order.id,
    actorUserId: input.actorUserId,
    type: 'STATUS_CHANGED',
    summary: `Status changed to ${input.nextStatus}`,
    metadata: { from: order.status, to: input.nextStatus },
  })
  if (input.internalNote?.trim()) {
    const merged = order.internalNotes ? `${order.internalNotes}\n\n${input.internalNote.trim()}` : input.internalNote.trim()
    await prisma.serviceOrder.update({ where: { id: order.id }, data: { internalNotes: merged } })
    await writeServiceOrderActivity({
      orderId: order.id,
      actorUserId: input.actorUserId,
      type: 'NOTE_ADDED',
      summary: 'Internal note added',
    })
  }
  return { ok: true as const, orderId: order.id, status: input.nextStatus }
}

export async function setServiceOrderQuote(input: {
  orderId: string
  actorUserId: string
  quoteAmountCents: number | null
  quoteCurrency?: string
  quoteNotes?: string
}) {
  const order = await prisma.serviceOrder.findUnique({ where: { id: input.orderId } })
  if (!order) return { ok: false as const, error: 'not_found' }
  await prisma.serviceOrder.update({
    where: { id: order.id },
    data: {
      quoteAmountCents: input.quoteAmountCents,
      quoteCurrency: input.quoteCurrency ?? 'USD',
      quoteNotes: input.quoteNotes?.trim() || null,
    },
  })
  await writeServiceOrderActivity({
    orderId: order.id,
    actorUserId: input.actorUserId,
    type: 'QUOTE_SET',
    summary: input.quoteAmountCents != null ? 'Quote amount updated' : 'Quote cleared',
    metadata: { quoteAmountCents: input.quoteAmountCents },
  })
  return { ok: true as const }
}

export async function assignServiceOrder(input: {
  orderId: string
  actorUserId: string
  assignedToId: string | null
}) {
  const order = await prisma.serviceOrder.findUnique({ where: { id: input.orderId } })
  if (!order) return { ok: false as const, error: 'not_found' }
  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: input.assignedToId } })
    if (!assignee || (assignee.role !== 'STAFF' && assignee.role !== 'ADMIN')) {
      return { ok: false as const, error: 'invalid_assignee' }
    }
  }
  await prisma.serviceOrder.update({ where: { id: order.id }, data: { assignedToId: input.assignedToId } })
  await writeServiceOrderActivity({
    orderId: order.id,
    actorUserId: input.actorUserId,
    type: 'ASSIGNED',
    summary: input.assignedToId ? 'Order assigned' : 'Order unassigned',
  })
  return { ok: true as const }
}

export async function activateServiceOrderEntitlement(input: {
  orderId: string
  actorUserId: string
}) {
  const order = await prisma.serviceOrder.findUnique({ where: { id: input.orderId } })
  if (!order) return { ok: false as const, error: 'not_found' }
  if (order.status !== 'COMPLETED') return { ok: false as const, error: 'invalid_status' }
  if (order.customerServiceId) return { ok: true as const, idempotent: true }

  const definition = getMarketplaceService(order.serviceKey)
  const entitlementKey = definition?.registryEntitlementKey
  if (!entitlementKey) return { ok: false as const, error: 'no_entitlement_mapping' }

  const service = await prisma.customerService.upsert({
    where: {
      customerAccountId_serviceKey: {
        customerAccountId: order.customerAccountId,
        serviceKey: entitlementKey,
      },
    },
    create: {
      customerAccountId: order.customerAccountId,
      serviceKey: entitlementKey,
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
    update: {
      status: 'ACTIVE',
      activatedAt: new Date(),
      deactivatedAt: null,
    },
  })

  await prisma.serviceOrder.update({
    where: { id: order.id },
    data: { customerServiceId: service.id },
  })
  await writeServiceOrderActivity({
    orderId: order.id,
    actorUserId: input.actorUserId,
    type: 'ENTITLEMENT_ACTIVATED',
    summary: `Entitlement ${entitlementKey} activated on customer account`,
    metadata: { customerServiceId: service.id, serviceKey: entitlementKey },
  })
  return { ok: true as const, idempotent: false, customerServiceId: service.id }
}
