import { getAccountInbox } from '@/lib/platform/comms/inbox-service'
import { commsRouteError, commsServiceResponse } from '@/lib/platform/comms/http'
import { requireCommsApiActor } from '@/lib/platform/comms/route-auth'

type Params = { params: Promise<{ inboxId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const { inboxId } = await params
    const result = await getAccountInbox({
      customerAccountId: actor.customerAccountId,
      inboxMappingId: inboxId,
    })
    return commsServiceResponse(result)
  } catch (error) {
    return commsRouteError(error)
  }
}