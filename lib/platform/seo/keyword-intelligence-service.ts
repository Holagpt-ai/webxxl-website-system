import { dedupeKeywordRowsForList, type GscKeywordListItem } from '@/lib/platform/seo/keyword-list-service'
import { loadGscStoredSiteBundle } from '@/lib/platform/seo/gsc-site-read'
import type { GscPerformanceReadModel } from '@/lib/platform/seo/gsc-performance-read'
import type { SeoResult } from '@/lib/platform/seo/types'

export type KeywordIntelligenceObservation = GscKeywordListItem

export type KeywordIntelligenceDto = {
  managedSiteId: string
  query: string
  page: string | null
  dataState: string
  gsc: GscPerformanceReadModel
  observations: KeywordIntelligenceObservation[]
  limitations: string[]
  measuredAt: string | null
  provenance: 'STORED_GSC_OBSERVATION'
}

function normalizeQuery(q: string): string {
  return q.trim()
}

export async function getKeywordIntelligenceForSite(input: {
  customerAccountId: string
  managedSiteId: string
  query: string
  page?: string | null
  date?: string | null
}): Promise<SeoResult<KeywordIntelligenceDto>> {
  const query = normalizeQuery(input.query)
  if (!query) {
    return { ok: false, code: 'VALIDATION', message: 'query required' }
  }

  const bundle = await loadGscStoredSiteBundle({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
  })
  if (!bundle.ok) return bundle

  let rows = dedupeKeywordRowsForList(bundle.value.rows).filter(
    (row) => row.query.toLowerCase() === query.toLowerCase(),
  )
  if (input.page !== undefined && input.page !== null) {
    const pageNorm = input.page.trim()
    rows = rows.filter((row) => (row.page ?? '') === pageNorm)
  }
  if (input.date) {
    rows = rows.filter((row) => row.date === input.date)
  }

  const observations: KeywordIntelligenceObservation[] = rows.map(
    ({ sortDateMs: _d, sortQuery: _q, sortPage: _p, sortId: _i, ...rest }) => rest,
  )

  const measuredAt =
    observations.length > 0
      ? observations.reduce((latest, row) => (row.observedAt > latest ? row.observedAt : latest), observations[0]!.observedAt)
      : null

  const dataState =
    bundle.value.performance.dataState === 'READY' && observations.length === 0
      ? 'UNAVAILABLE'
      : bundle.value.performance.dataState

  return {
    ok: true,
    value: {
      managedSiteId: input.managedSiteId,
      query,
      page: input.page ?? null,
      dataState,
      gsc: bundle.value.performance,
      observations,
      limitations: [
        ...bundle.value.limitations,
        'Keyword intelligence is derived from stored Search Console observations only; live rank is not synthesized.',
      ],
      measuredAt,
      provenance: 'STORED_GSC_OBSERVATION',
    },
  }
}