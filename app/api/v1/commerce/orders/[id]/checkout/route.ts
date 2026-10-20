import { createCheckout } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { id } = await params
    const body = (await request.json()) as { idempotencyKey?: string; providerKey?: string }
    if (!body.idempotencyKey) return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    const result = await createCheckout(prismaCommerceStore, {
      actor: toCommerceActor(user),
      orderId: id,
      idempotencyKey: body.idempotencyKey,
      providerKey: body.providerKey,
    })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}
