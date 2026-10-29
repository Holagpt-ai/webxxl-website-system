import { NextResponse } from 'next/server'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'
import { recordContactSuppression } from '@/lib/platform/crm/consent-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: contactId } = await params
    const actor = await requireCrmApiActor('crm.consent.manage')
    const body = (await request.json()) as {
      channel?: CrmConsentChannel
      purpose?: CrmConsentPurpose
      reason?: string
      source?: string
      idempotencyKey?: string
    }
    if (!body.channel || !body.purpose || !body.reason?.trim() || !body.source?.trim()) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'channel, purpose, reason, source required' },
        { status: 400 },
      )
    }
    const recorded = await recordContactSuppression({
      customerAccountId: actor.customerAccountId,
      contactId,
      channel: body.channel,
      purpose: body.purpose,
      reason: body.reason.trim(),
      source: body.source.trim(),
      idempotencyKey: body.idempotencyKey,
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
