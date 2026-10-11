import type { LeadSource } from '@prisma/client'

/** Server-only operational log — no customer PII or secrets. */
export function logLeadPersistenceFailure(input: { source: LeadSource; resendMessageId: string }) {
  console.error('[webxxl-lead-intake] CRM persistence failed after successful email delivery', {
    source: input.source,
    resendMessageId: input.resendMessageId,
  })
}

export function logNewsletterPersistenceFailure(input: { source: string; resendMessageId: string }) {
  console.error('[webxxl-newsletter] subscriber persistence failed after successful email delivery', {
    source: input.source,
    resendMessageId: input.resendMessageId,
  })
}
