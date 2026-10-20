import { configureProductPrice } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireStaff } from '@/lib/portal/authz'
import type { BillingInterval } from '@/lib/platform/commerce/types'

export async function POST(request: Request) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireStaff()
    const body = (await request.json()) as {
      productKey?: string
      currency?: string
      amountMinor?: number
      billingInterval?: BillingInterval
      priceVersion?: string
      creditAmount?: number | null
      effectiveFrom?: string
      providerKey?: string | null
      externalPriceRef?: string | null
    }
    if (!body.productKey || !body.currency || body.amountMinor == null || !body.billingInterval || !body.priceVersion || !body.effectiveFrom) {
      return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    }
    const result = await configureProductPrice(prismaCommerceStore, {
      actor: toCommerceActor(user),
      productKey: body.productKey,
      currency: body.currency,
      amountMinor: body.amountMinor,
      billingInterval: body.billingInterval,
      priceVersion: body.priceVersion,
      creditAmount: body.creditAmount,
      effectiveFrom: new Date(body.effectiveFrom),
      providerKey: body.providerKey,
      externalPriceRef: body.externalPriceRef,
    })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}
