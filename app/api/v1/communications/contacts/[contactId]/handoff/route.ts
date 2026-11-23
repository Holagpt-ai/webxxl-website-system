import { buildCrmContactCommunicationHandoff } from '@/lib/platform/comms/crm-contact-handoff-contract'
import { commsRouteError, commsServiceResponse } from '@/lib/platform/comms/http'
import { requireCommsApiActor } from '@/lib/platform/comms/route-auth'

type Params = { params: Promise<{ contactId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const { contactId } = await params
    const result = await buildCrmContactCommunicationHandoff({
      customerAccountId: actor.customerAccountId,
      contactId,
    })
    return commsServiceResponse(result)
  } catch (error) {
    return commsRouteError(error)
  }
}