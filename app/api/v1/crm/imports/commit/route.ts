import { NextResponse } from 'next/server'
import { commitCrmImport } from '@/lib/platform/crm/import-export-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor()
    const body = (await request.json()) as { jobId?: string; commitIdempotencyKey?: string }
    if (!body.jobId || !body.commitIdempotencyKey) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'jobId and commitIdempotencyKey required' }, { status: 400 })
    }
    const committed = await commitCrmImport({
      customerAccountId: actor.customerAccountId,
      jobId: body.jobId,
      commitIdempotencyKey: body.commitIdempotencyKey,
    })
    if (!committed.ok) {
      return NextResponse.json({ code: committed.code, message: committed.message }, { status: crmResultHttpStatus(committed.code) })
    }
    return NextResponse.json(committed.value)
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Import commit failed' }, { status: 500 })
  }
}
