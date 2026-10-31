import { createHash } from 'node:crypto'

/** Durable idempotency fingerprint — SHA-256 of the authenticated raw request body (no PII stored). */
export function buildSiteLeadIntakePayloadFingerprint(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}
