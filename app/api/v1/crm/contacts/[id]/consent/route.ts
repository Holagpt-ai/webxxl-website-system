import { NextResponse } from 'next/server'
import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'
import {
  listContactConsentAndSuppression,
  recordContactConsentWithEvidence,
} from '@/lib/platform/crm/consent-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: contactId } = await params
    const actor = await requireCrmApiActor('crm.read')
    const state = await listContactConsentAndSuppression(actor.customerAccountId, contactId)
    if (!state.ok) {
      return NextResponse.json({ code: state.code, message: state.message }, { status: crmResultHttpStatus(state.code) })
    }
    return NextResponse.json(state.value)
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load consent state' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: contactId } = await params
    const actor = await requireCrmApiActor('crm.consent.manage')
    const body = (await request.json()) as {
      channel?: CrmConsentChannel
      purpose?: CrmConsentPurpose
      status?: CrmConsentStatus
      source?: string
      capturedAt?: string
      termsVersion?: string
      idempotencyKey?: string
      evidence?: { evidenceRef?: string; detail?: Record<string, unknown> }[]
    }
    if (!body.channel || !body.purpose || !body.status || !body.source || !body.capturedAt) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'channel, purpose, status, source, capturedAt required' }, { status: 400 })
    }
    const recorded = await recordContactConsentWithEvidence({
      customerAccountId: actor.customerAccountId,
      contactId,
      channel: body.channel,
      purpose: body.purpose,
      status: body.status,
      source: body.source,
      capturedAt: new Date(body.capturedAt),
      termsVersion: body.termsVersion,
      idempotencyKey: body.idempotencyKey,
      evidence: body.evidence?.map((row) => ({
        evidenceRef: row.evidenceRef ?? '',
        detail: row.detail,
      })),
    })
    if (!recorded.ok) {
      return NextResponse.json({ code: recorded.code, message: recorded.message }, { status: crmResultHttpStatus(recorded.code) })
    }
    return NextResponse.json({ id: recorded.value.id }, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to record consent' }, { status: 500 })
  }
}
