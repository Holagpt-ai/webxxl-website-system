export type CompetitorProvenanceSource = 'OWNER_SUPPLIED' | 'PLACES_DISCOVERY' | 'SYNTHETIC_TEST'

export type CompetitorCandidate = {
  displayName: string
  placeId?: string
  categoryMatch: number
  serviceOverlap: number
  geoRelevance: number
  observedEvidence: number
  ownerExcluded?: boolean
  /** Required for PLACES_DISCOVERY — client place IDs alone are not trusted. */
  providerObservationRef?: string
  provenance?: CompetitorProvenanceSource
}

export type RankedCompetitor = CompetitorCandidate & {
  rankScore: number
  source: CompetitorProvenanceSource
  evidenceRef?: string
}

const DISPLAY_LIMIT = 5
const SCORE_MIN = 0
const SCORE_MAX = 1

export function validateCompetitorScore(value: number, field: string): boolean {
  return Number.isFinite(value) && value >= SCORE_MIN && value <= SCORE_MAX
}

export function validateCompetitorCandidate(candidate: CompetitorCandidate): { ok: true } | { ok: false; message: string } {
  if (!candidate.displayName?.trim()) return { ok: false, message: 'displayName required' }
  for (const [field, value] of [
    ['categoryMatch', candidate.categoryMatch],
    ['serviceOverlap', candidate.serviceOverlap],
    ['geoRelevance', candidate.geoRelevance],
    ['observedEvidence', candidate.observedEvidence],
  ] as const) {
    if (!validateCompetitorScore(value, field)) {
      return { ok: false, message: `${field} must be a finite number between ${SCORE_MIN} and ${SCORE_MAX}` }
    }
  }
  const provenance = candidate.provenance ?? 'OWNER_SUPPLIED'
  if (provenance === 'PLACES_DISCOVERY') {
    if (!candidate.providerObservationRef) {
      return { ok: false, message: 'PLACES_DISCOVERY requires providerObservationRef' }
    }
  }
  if (candidate.placeId && provenance === 'OWNER_SUPPLIED') {
    // Owner may reference a Place ID as a label only — not as Google-verified discovery.
  }
  return { ok: true }
}

export function resolveCompetitorProvenance(candidate: CompetitorCandidate): CompetitorProvenanceSource {
  if (candidate.provenance) return candidate.provenance
  if (candidate.providerObservationRef) return 'PLACES_DISCOVERY'
  return 'OWNER_SUPPLIED'
}

export function rankCompetitorCandidates(candidates: CompetitorCandidate[]): RankedCompetitor[] {
  const scored = candidates
    .filter((c) => !c.ownerExcluded)
    .map((c) => {
      const source = resolveCompetitorProvenance(c)
      return {
        ...c,
        rankScore:
          c.categoryMatch * 0.35 +
          c.serviceOverlap * 0.25 +
          c.geoRelevance * 0.2 +
          c.observedEvidence * 0.2,
        source,
        evidenceRef:
          source === 'PLACES_DISCOVERY'
            ? c.providerObservationRef
            : source === 'OWNER_SUPPLIED'
              ? `owner:supplied:${c.displayName}`
              : `synthetic:${c.displayName}`,
      }
    })
    .sort((a, b) => b.rankScore - a.rankScore || a.displayName.localeCompare(b.displayName))
  return scored.slice(0, DISPLAY_LIMIT)
}

/** Places text search order is discovery evidence, not keyword rank. */
export function placesDiscoveryIsNotKeywordRank(): true {
  return true
}
