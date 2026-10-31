import { NextResponse } from 'next/server'
import { ingestManagedSiteLead } from '@/lib/platform/site-leads/ingest-service'
import { readSiteLeadIntakeBody } from '@/lib/platform/site-leads/read-body'
import type { SiteLeadIntakeBody } from '@/lib/platform/site-leads/validate-payload'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bodyRead = await readSiteLeadIntakeBody(request)
  if (!bodyRead.ok) {
    return NextResponse.json({ code: bodyRead.code, message: bodyRead.message }, { status: 413 })
  }
  const rawBody = bodyRead.rawBody
  let parsed: SiteLeadIntakeBody
  try {
    parsed = rawBody ? (JSON.parse(rawBody) as SiteLeadIntakeBody) : {}
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: 'Invalid JSON body' }, { status: 400 })
  }
  const result = await ingestManagedSiteLead({
    publicKeyId: request.headers.get('x-webxxl-lead-intake-key'),
    idempotencyKeyHeader: request.headers.get('x-idempotency-key'),
    signatureHeader: request.headers.get('x-webxxl-signature'),
    timestampHeader: request.headers.get('x-webxxl-timestamp'),
    rawBody,
    parsed,
  })
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status })
  }
  return NextResponse.json(
    { ok: true, leadId: result.leadId, status: result.status, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  )
}
