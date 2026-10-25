import { ANALYTICS_CAPTURE_MAX_BODY_BYTES } from '@/config/analytics-backend'

export async function readCaptureRequestBody(
  request: Request,
): Promise<{ ok: true; rawBody: string } | { ok: false; code: 'PAYLOAD_TOO_LARGE'; message: string }> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const len = Number(contentLength)
    if (Number.isFinite(len) && len > ANALYTICS_CAPTURE_MAX_BODY_BYTES) {
      return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds capture limit' }
    }
  }
  if (!request.body) {
    return { ok: true, rawBody: '' }
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > ANALYTICS_CAPTURE_MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds capture limit' }
      }
      chunks.push(value)
    }
  }
  const rawBody = Buffer.concat(chunks).toString('utf8')
  if (Buffer.byteLength(rawBody, 'utf8') > ANALYTICS_CAPTURE_MAX_BODY_BYTES) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds capture limit' }
  }
  return { ok: true, rawBody }
}
