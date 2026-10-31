import { NextResponse } from 'next/server'
import { convertManagedSiteLeadToCrmContact } from '@/lib/platform/site-leads/convert-service'
import { SiteLeadApiError, requireSiteLeadInboxActor } from '@/lib/platform/site-leads/route-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSiteLeadInboxActor('crm.write')
    const { id } = await context.params
    const idempotencyKey = request.headers.get('x-idempotency-key')
    if (!idempotencyKey?.trim()) {
      return NextResponse.json({ code: 'VALIDATION', message: 'x-idempotency-key is required' }, { status: 400 })
    }
    const result = await convertManagedSiteLeadToCrmContact({
      leadId: id,
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      idempotencyKey: idempotencyKey.trim(),
    })
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, message: result.message },
        { status: siteLeadResultHttpStatus(result.code) },
      )
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof SiteLeadApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('site-leads convert failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to convert lead' }, { status: 500 })
  }
}
