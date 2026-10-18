import type { CompetitorCandidate } from '@/lib/platform/seo/competitor-ranking'
import type { SeoResult } from '@/lib/platform/seo/types'

const FORBIDDEN_CLIENT_KEYS = ['provenance', 'providerObservationRef', 'source'] as const

export type PublicCompetitorSubmission = {
  displayName: string
  placeId?: string
  categoryMatch: number
  serviceOverlap: number
  geoRelevance: number
  observedEvidence: number
}

export function sanitizeOwnerSubmittedCompetitors(raw: unknown): SeoResult<CompetitorCandidate[]> {
  if (raw == null) return { ok: true, value: [] }
  if (!Array.isArray(raw)) {
    return { ok: false, code: 'VALIDATION', message: 'candidateCompetitors must be an array' }
  }
  const out: CompetitorCandidate[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, code: 'VALIDATION', message: 'Invalid competitor candidate' }
    }
    const record = item as Record<string, unknown>
    for (const key of FORBIDDEN_CLIENT_KEYS) {
      if (key in record && record[key] !== undefined) {
        return { ok: false, code: 'VALIDATION', message: 'Client-supplied provider provenance is not allowed' }
      }
    }
    const submission = item as PublicCompetitorSubmission
    out.push({
      displayName: submission.displayName,
      placeId: submission.placeId,
      categoryMatch: submission.categoryMatch,
      serviceOverlap: submission.serviceOverlap,
      geoRelevance: submission.geoRelevance,
      observedEvidence: submission.observedEvidence,
      provenance: 'OWNER_SUPPLIED',
    })
  }
  return { ok: true, value: out }
}
