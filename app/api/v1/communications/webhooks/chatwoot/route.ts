import { NextResponse } from 'next/server'
import { isChatwootWebhookIngestEnabled } from '@/config/comms-backend'
import { ingestChatwootWebhook } from '@/lib/platform/comms/webhook-ingest-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'

export async function POST(request: Request) {
  if (!isChatwootWebhookIngestEnabled()) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: 'Chatwoot webhook ingest disabled' },
      { status: 503 },
    )
  }
  const rawBody = await request.text()
  const signatureHeader = request.headers.get('x-webxxl-chatwoot-signature')
  const idempotencyKey = request.headers.get('x-idempotency-key') ?? `body:${rawBody.length}`
  const providerInstanceId = process.env.CHATWOOT_PROVIDER_INSTANCE_ID ?? 'chatwoot_staging_infra02'
  const relaySecret = process.env.COMMS_CHATWOOT_RELAY_SECRET ?? null

  const result = await ingestChatwootWebhook({
    providerInstanceId,
    rawBody,
    signatureHeader,
    relaySecret,
    idempotencyKey,
  })
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
  }
  return NextResponse.json({ receipt: result.value })
}
