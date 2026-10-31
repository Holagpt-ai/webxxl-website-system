import { createHash } from 'node:crypto'

/** Business duplicate fingerprint — independent of request idempotency keys. */
export function buildSiteLeadSubmissionFingerprint(input: {
  customerAccountId: string
  managedSiteId: string
  normalizedEmail: string
  normalizedPhone: string | null
  formReference: string | null
}): string {
  const material = [
    input.customerAccountId,
    input.managedSiteId,
    input.normalizedEmail,
    input.normalizedPhone ?? '',
    input.formReference ?? '',
  ].join('|')
  return createHash('sha256').update(material, 'utf8').digest('hex')
}
