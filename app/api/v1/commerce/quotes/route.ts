import { quotePurchase } from '@/lib/platform/commerce/engine'
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
      productKey?: string
      quantity?: number
      expectedTotalMinor?: number
      currency?: string
    }
    if (!body.billingGroupId || body.expectedTotalMinor == null || !body.currency || !body.quantity) {
      return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    }
    const result = await quotePurchase(prismaCommerceStore, {
      actor: toCommerceActor(user),
      billingGroupId: body.billingGroupId,
      customerAccountId: body.customerAccountId ?? null,
      projectId: body.projectId,
      productPriceId: body.productPriceId,
      productKey: body.productKey,
      quantity: body.quantity,
      expectedTotalMinor: body.expectedTotalMinor,
      currency: body.currency,
    })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}
