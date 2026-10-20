import { ingestPaymentWebhook } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'

type Params = { params: Promise<{ provider: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const { provider } = await params
    const rawBody = await request.text()
    const signature = request.headers.get('x-webxxl-signature')
    const result = await ingestPaymentWebhook(prismaCommerceStore, { providerKey: provider, rawBody, signature })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}
