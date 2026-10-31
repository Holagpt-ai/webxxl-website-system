import { createHash, randomUUID } from 'node:crypto'
import type { SiteLeadConnectorPayload } from '@/lib/platform/site-leads/connector/types'

/** Reuse the same key when retrying an identical submission attempt. */
export function resolveSiteLeadIdempotencyKey(input: {
  payload: SiteLeadConnectorPayload
  rawBody: string
  explicitKey?: string | null
}): string {
  const explicit = input.explicitKey?.trim()
  if (explicit) return explicit.slice(0, 128)
  return createHash('sha256').update(input.rawBody, 'utf8').digest('hex').slice(0, 64)
}

/** New key for a distinct user submission when the caller does not supply one. */
export function newSiteLeadSubmissionIdempotencyKey(): string {
  return randomUUID()
}
