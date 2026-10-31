import { createHash } from 'node:crypto'

export function buildSiteLeadSubmissionFingerprint(input: {
  managedSiteId: string
  normalizedEmail: string
  normalizedPhone: string | null
  formReference: string | null
  dedupeKey: string
}): string {
  const material = [
    input.managedSiteId,
    input.normalizedEmail,
    input.normalizedPhone ?? '',
    input.formReference ?? '',
    input.dedupeKey,
  ].join('|')
  return createHash('sha256').update(material, 'utf8').digest('hex')
}
