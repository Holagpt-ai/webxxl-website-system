import { NextResponse } from 'next/server'
import { ingestFirstPartyConversionEvent } from '@/lib/platform/analytics/capture/ingest-service'
import { readCaptureRequestBody } from '@/lib/platform/analytics/capture/read-body'
import type { CaptureEventBody } from '@/lib/platform/analytics/capture/validate-payload'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const bodyRead = await readCaptureRequestBody(request)
  if (!bodyRead.ok) {
    return NextResponse.json({ code: bodyRead.code, message: bodyRead.message }, { status: 413 })
  }
  const rawBody = bodyRead.rawBody
  let parsed: CaptureEventBody
  try {
    parsed = rawBody ? (JSON.parse(rawBody) as CaptureEventBody) : {}
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: 'Invalid JSON body' }, { status: 400 })
  }
  const result = await ingestFirstPartyConversionEvent({
    publicKeyId: request.headers.get('x-webxxl-capture-key'),
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
    { ok: true, eventId: result.eventId, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  )
}
