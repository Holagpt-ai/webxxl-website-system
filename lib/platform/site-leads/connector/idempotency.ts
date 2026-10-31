import { createHash, randomUUID } from 'node:crypto'

/** Caller-provided submission identity (before site scoping). */
export const SITE_LEAD_SUBMISSION_ID_MAX_LENGTH = 128

const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/

export class SiteLeadSubmissionIdError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteLeadSubmissionIdError'
  }
}

/** Validate an explicit submission id — no silent truncation. */
export function validateExplicitSiteLeadSubmissionId(raw: string): string {
  const id = raw.trim()
  if (!id) {
    throw new SiteLeadSubmissionIdError('submission id must not be empty')
  }
  if (id.length > SITE_LEAD_SUBMISSION_ID_MAX_LENGTH) {
    throw new SiteLeadSubmissionIdError(
      `submission id must be at most ${SITE_LEAD_SUBMISSION_ID_MAX_LENGTH} characters`,
    )
  }
  if (!SUBMISSION_ID_PATTERN.test(id)) {
    throw new SiteLeadSubmissionIdError(
      'submission id may only contain letters, digits, and . _ : -',
    )
  }
  return id
}

/** New identity for a distinct user submission when the caller does not supply one. */
export function newSiteLeadSubmissionId(): string {
  return randomUUID()
}

function isSubmissionIdArgProvided(value: string | null | undefined): value is string {
  return value !== undefined && value !== null
}

export function resolveSiteLeadSubmissionId(input: {
  submissionId?: string | null
  /** Legacy alias — same semantics as `submissionId`. */
  legacyIdempotencyKey?: string | null
}): string {
  if (isSubmissionIdArgProvided(input.submissionId)) {
    return validateExplicitSiteLeadSubmissionId(String(input.submissionId))
  }
  if (isSubmissionIdArgProvided(input.legacyIdempotencyKey)) {
    return validateExplicitSiteLeadSubmissionId(String(input.legacyIdempotencyKey))
  }
  return newSiteLeadSubmissionId()
}

/**
 * Intake `x-idempotency-key` — scoped to the site credential so keys never collide across sites.
 * Collision-resistant SHA-256 hex (64 chars, within intake 128-char limit).
 */
export function buildSiteLeadIntakeIdempotencyKey(input: {
  publicKeyId: string
  submissionId: string
}): string {
  const publicKeyId = input.publicKeyId.trim()
  if (!publicKeyId) {
    throw new SiteLeadSubmissionIdError('publicKeyId is required to scope idempotency')
  }
  return createHash('sha256')
    .update(`${publicKeyId}\n${input.submissionId}`, 'utf8')
    .digest('hex')
}

/** @deprecated Renamed to `newSiteLeadSubmissionId`. */
export function newSiteLeadSubmissionIdempotencyKey(): string {
  return newSiteLeadSubmissionId()
}
