import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { evaluateAccountLeadFollowUps } from '@/lib/platform/marketing/follow-up-evaluation-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

export async function POST(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.followup.manage')
    const body = (await request.json()) as { idempotencyKey?: string; limit?: number }
    const evaluated = await evaluateAccountLeadFollowUps({
      customerAccountId: actor.customerAccountId,
      idempotencyKey: body.idempotencyKey,
      limit: body.limit,
    })
    return mktServiceResponse(evaluated)
  } catch (error) {
    return mktRouteError(error)
  }
}
