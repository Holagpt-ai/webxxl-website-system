import { NextResponse } from 'next/server'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { requireMktCrmAudienceActor } from '@/lib/platform/marketing/crm-audience-route-auth'
import { listCrmSegmentsForAudiencePlanning } from '@/lib/platform/marketing/crm-segment-audience-service'

export async function GET() {
  try {
    const actor = await requireMktCrmAudienceActor('marketing.read')
    const listed = await listCrmSegmentsForAudiencePlanning(actor.customerAccountId)
    if (!listed.ok) return mktServiceResponse(listed)
    return NextResponse.json({ segments: listed.value })
  } catch (error) {
    return mktRouteError(error)
  }
}
