import { NextResponse } from 'next/server'
import { liftContactSuppression } from '@/lib/platform/crm/consent-service'
import { parseSuppressionLiftInput } from '@/lib/platform/crm/crm-consent-input'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: contactId } = await params
    const actor = await requireCrmApiActor('crm.consent.manage')
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseSuppressionLiftInput(body as Parameters<typeof parseSuppressionLiftInput>[0])
    if (!parsed.ok) {
      return NextResponse.json({ code: parsed.code, message: parsed.message }, { status: crmResultHttpStatus(parsed.code) })
    }
    const lifted = await liftContactSuppression({
      customerAccountId: actor.customerAccountId,
      contactId,
      actorUserId: actor.userId,
      ...parsed.value,
    })
    if (!lifted.ok) {
      return NextResponse.json({ code: lifted.code, message: lifted.message }, { status: crmResultHttpStatus(lifted.code) })
    }
    return NextResponse.json({
      id: lifted.value.id,
      alreadyLifted: lifted.value.alreadyLifted,
      consentUnchanged: lifted.value.consentUnchanged,
    })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to lift suppression' }, { status: 500 })
  }
}
