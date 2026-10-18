export type CompetitorCandidate = {
  displayName: string
  placeId?: string
  categoryMatch: number
  serviceOverlap: number
  geoRelevance: number
  observedEvidence: number
  ownerExcluded?: boolean
}

export type RankedCompetitor = CompetitorCandidate & {
  rankScore: number
  source: string
  evidenceRef?: string
}

const DISPLAY_LIMIT = 5

export function rankCompetitorCandidates(candidates: CompetitorCandidate[]): RankedCompetitor[] {
  const scored = candidates
    .filter((c) => !c.ownerExcluded)
    .map((c) => ({
      ...c,
      rankScore:
        c.categoryMatch * 0.35 +
        c.serviceOverlap * 0.25 +
        c.geoRelevance * 0.2 +
        c.observedEvidence * 0.2,
      source: c.placeId ? 'PLACES_DISCOVERY' : 'SYNTHETIC',
      evidenceRef: c.placeId ? `places:place_id:${c.placeId}` : undefined,
    }))
    .sort((a, b) => b.rankScore - a.rankScore || a.displayName.localeCompare(b.displayName))
  return scored.slice(0, DISPLAY_LIMIT)
}

/** Places text search order is discovery evidence, not keyword rank. */
export function placesDiscoveryIsNotKeywordRank(): true {
  return true
}
