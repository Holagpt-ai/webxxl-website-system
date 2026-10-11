import { createHash } from 'node:crypto'
import type { LeadSource } from '@prisma/client'

export function buildLeadSubmissionFingerprint(input: {
  source: LeadSource
  contactEmail: string
  dedupeKey: string
}): string {
  const normalizedEmail = input.contactEmail.trim().toLowerCase()
  const key = input.dedupeKey.trim().toLowerCase().slice(0, 500)
  return createHash('sha256').update(`${input.source}|${normalizedEmail}|${key}`).digest('hex')
}

export function buildReferenceCode(prefix: string, seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
  return `${prefix}-${compact || 'REF'}`
}
