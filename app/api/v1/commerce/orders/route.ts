import { NextResponse } from 'next/server'
import { createPurchaseOrder } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

export async function POST(request: Request) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const body = (await request.json()) as {
      billingGroupId?: string
      customerAccountId?: string | null
      projectId?: string | null
      productPriceId?: string
      quantity?: number
      expectedTotalMinor?: number
      currency?: string
      idempotencyKey?: string
    }
    if (!body.billingGroupId || !body.productPriceId || !body.quantity || body.expectedTotalMinor == null || !body.currency || !body.idempotencyKey) {
      return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    }
    const result = await createPurchaseOrder(prismaCommerceStore, {
      actor: toCommerceActor(user),
      billingGroupId: body.billingGroupId,
      customerAccountId: body.customerAccountId ?? null,
      projectId: body.projectId,
      productPriceId: body.productPriceId,
      quantity: body.quantity,
      expectedTotalMinor: body.expectedTotalMinor,
      currency: body.currency,
      idempotencyKey: body.idempotencyKey,
    })
    if (!result.ok) return commerceResultResponse(result)
    return NextResponse.json({ orderId: result.value.order.id, publicId: result.value.order.publicId, status: result.value.order.status, paymentConfirmed: false }, { status: 201 })
  } catch (error) {
    return commerceRouteError(error)
  }
}
