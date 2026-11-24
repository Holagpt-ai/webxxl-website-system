import { NextResponse } from 'next/server'
import { commsRouteError } from '@/lib/platform/comms/http'
import { buildChatwootIntegrationReadiness } from '@/lib/platform/comms/chatwoot-readiness-service'
import { buildMessagingProviderReadiness } from '@/lib/platform/comms/messaging-provider-readiness'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

export async function GET() {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const [chatwoot, messaging] = await Promise.all([
      buildChatwootIntegrationReadiness(actor.customerAccountId),
      buildMessagingProviderReadiness(actor.customerAccountId),
    ])
    if (!chatwoot.ok) {
      return NextResponse.json(
        { code: chatwoot.code, message: chatwoot.message },
        { status: chatwoot.status },
      )
    }
    return NextResponse.json({
      customerAccountId: actor.customerAccountId,
      assessedAt: new Date().toISOString(),
      chatwoot: chatwoot.value,
      messaging: messaging.value,
    })
  } catch (error) {
    return commsRouteError(error)
  }
}
