import { NextResponse } from 'next/server'
import { recordContactSuppression } from '@/lib/platform/crm/consent-service'
import { parseSuppressionRecordInput } from '@/lib/platform/crm/crm-consent-input'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: contactId } = await params
    const actor = await requireCrmApiActor('crm.consent.manage')
    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseSuppressionRecordInput(body as Parameters<typeof parseSuppressionRecordInput>[0])
    if (!parsed.ok) {
      return NextResponse.json({ code: parsed.code, message: parsed.message }, { status: crmResultHttpStatus(parsed.code) })
    }
    const recorded = await recordContactSuppression({
      customerAccountId: actor.customerAccountId,
      contactId,
      ...parsed.value,
    })
    if (!recorded.ok) {
      return NextResponse.json({ code: recorded.code, message: recorded.message }, { status: crmResultHttpStatus(recorded.code) })
    }
    return NextResponse.json({ id: recorded.value.id }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to record suppression' }, { status: 500 })
  }
}
