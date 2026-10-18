import { NextResponse } from 'next/server'
import { previewCrmImport } from '@/lib/platform/crm/import-export-service'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import { requireCrmApiActor, CrmApiError } from '@/lib/platform/crm/route-auth'

export async function POST(request: Request) {
  try {
    const actor = await requireCrmApiActor()
    const body = (await request.json()) as {
      fileName?: string
      rows?: Record<string, string>[]
      mapping?: Record<string, string>
    }
    if (!body.rows || !body.mapping) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'rows and mapping required' }, { status: 400 })
    }
    const preview = await previewCrmImport({
      customerAccountId: actor.customerAccountId,
      createdByUserId: actor.userId,
      fileName: body.fileName ?? 'upload.csv',
      rows: body.rows,
      mapping: body.mapping,
    })
    if (!preview.ok) {
      return NextResponse.json({ code: preview.code, message: preview.message }, { status: crmResultHttpStatus(preview.code) })
    }
    return NextResponse.json(preview.value, { status: 201 })
  } catch (error) {
    if (error instanceof CrmApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Import preview failed' }, { status: 500 })
  }
}
