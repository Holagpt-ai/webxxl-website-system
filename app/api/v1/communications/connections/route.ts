import { listAccountInboxes } from '@/lib/platform/comms/inbox-service'
import { listCommsConnections } from '@/lib/platform/comms/connections-service'
import { buildCommsConnectionsAuthorizationContract } from '@/lib/platform/comms/connections-authorization-contract'
import { commsRouteError, commsServiceResponse } from '@/lib/platform/comms/http'
import { requireCommsApiActor } from '@/lib/platform/comms/route-auth'

export async function GET() {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const [result, inboxes] = await Promise.all([
      listCommsConnections({
        customerAccountId: actor.customerAccountId,
        actorUserId: actor.userId,
      }),
      listAccountInboxes({ customerAccountId: actor.customerAccountId }),
    ])
    if (!result.ok) return commsServiceResponse(result)
    if (!inboxes.ok) return commsServiceResponse(inboxes)
    const authorization = buildCommsConnectionsAuthorizationContract({
      chatwoot: result.value.chatwoot,
      inboxes: inboxes.value.inboxes,
    })
    return Response.json({ ...result.value, authorization })
  } catch (error) {
    return commsRouteError(error)
  }
}
