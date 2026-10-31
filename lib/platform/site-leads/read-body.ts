import { SITE_LEAD_INTAKE_MAX_BODY_BYTES } from '@/config/site-lead-intake'

export async function readSiteLeadIntakeBody(
  request: Request,
): Promise<{ ok: true; rawBody: string } | { ok: false; code: 'PAYLOAD_TOO_LARGE'; message: string }> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const len = Number(contentLength)
    if (Number.isFinite(len) && len > SITE_LEAD_INTAKE_MAX_BODY_BYTES) {
      return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds lead intake limit' }
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
      if (total > SITE_LEAD_INTAKE_MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds lead intake limit' }
      }
      chunks.push(value)
    }
  }
  const rawBody = Buffer.concat(chunks).toString('utf8')
  if (Buffer.byteLength(rawBody, 'utf8') > SITE_LEAD_INTAKE_MAX_BODY_BYTES) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds lead intake limit' }
  }
  return { ok: true, rawBody }
}
