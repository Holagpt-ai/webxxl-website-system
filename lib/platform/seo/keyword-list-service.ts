import { SEO_LIST_DEFAULT_TAKE, SEO_LIST_MAX_TAKE } from '@/config/seo-backend'
import type { PersistedKeywordRow } from '@/lib/platform/seo/gsc-performance-read'
import { loadGscStoredSiteBundle } from '@/lib/platform/seo/gsc-site-read'
import type { GscPerformanceReadModel } from '@/lib/platform/seo/gsc-performance-read'
import { decodeSeoListCursor, encodeSeoListCursor, type SeoListCursorPayload } from '@/lib/platform/seo/seo-list-cursor'
import type { SeoResult } from '@/lib/platform/seo/types'

export type GscKeywordListItem = {
  query: string
  page: string | null
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  averagePositionLabel: 'GSC average position (not fixed rank)'
  date: string
  dataState: string
  observedAt: string
}

type DedupedRow = GscKeywordListItem & {
  sortDateMs: number
  sortQuery: string
  sortPage: string
  sortId: string
}

function clampTake(take?: number): number {
  return Math.min(Math.max(Number(take ?? SEO_LIST_DEFAULT_TAKE) || SEO_LIST_DEFAULT_TAKE, 1), SEO_LIST_MAX_TAKE)
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function dedupeKeywordRowsForList(rows: PersistedKeywordRow[]): DedupedRow[] {
  const byMetric = new Map<string, DedupedRow>()
  for (const row of rows) {
    const metricKey = `${row.query}|${row.page ?? ''}|${toIsoDate(row.date)}`
    const existing = byMetric.get(metricKey)
    const candidate: DedupedRow = {
      query: row.query,
      page: row.page,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      averagePosition: row.averagePosition,
      averagePositionLabel: 'GSC average position (not fixed rank)',
      date: toIsoDate(row.date),
      dataState: row.dataState,
      observedAt: row.observedAt.toISOString(),
      sortDateMs: row.date.getTime(),
      sortQuery: row.query,
      sortPage: row.page ?? '',
      sortId: row.idempotencyKey,
    }
    if (!existing || row.observedAt > new Date(existing.observedAt)) {
      byMetric.set(metricKey, candidate)
    }
  }
  return [...byMetric.values()].sort(compareKeywordSortKeys)
}

/** date DESC, query ASC, page ASC, idempotencyKey ASC */
export function compareKeywordSortKeys(a: DedupedRow, b: DedupedRow): number {
  if (b.sortDateMs !== a.sortDateMs) return b.sortDateMs - a.sortDateMs
  const q = a.sortQuery.localeCompare(b.sortQuery)
  if (q !== 0) return q
  const p = a.sortPage.localeCompare(b.sortPage)
  if (p !== 0) return p
  return a.sortId.localeCompare(b.sortId)
}

function keywordCursorFromRow(row: DedupedRow): SeoListCursorPayload {
  return { p: row.sortDateMs, q: row.sortQuery, pg: row.sortPage, i: row.sortId }
}

function cursorSortAnchor(cursor: SeoListCursorPayload): DedupedRow {
  return {
    query: cursor.q ?? '',
    page: cursor.pg ? cursor.pg : null,
    clicks: null,
    impressions: null,
    ctr: null,
    averagePosition: null,
    averagePositionLabel: 'GSC average position (not fixed rank)',
    date: '',
    dataState: 'READY',
    observedAt: '',
    sortDateMs: cursor.p,
    sortQuery: cursor.q ?? '',
    sortPage: cursor.pg ?? '',
    sortId: cursor.i,
  }
}

/** Rows strictly after cursor in deterministic sort order. */
export function keywordRowsAfterCursor(sorted: DedupedRow[], cursor: SeoListCursorPayload): DedupedRow[] {
  const anchor = cursorSortAnchor(cursor)
  return sorted.filter((row) => compareKeywordSortKeys(anchor, row) < 0)
}

export async function listGscKeywordsForSite(input: {
  customerAccountId: string
  managedSiteId: string
  take?: number
  cursor?: string
  search?: string
}): Promise<
  SeoResult<{
    gsc: GscPerformanceReadModel
    keywords: GscKeywordListItem[]
    nextCursor?: string
    limitations: string[]
  }>
> {
  const bundle = await loadGscStoredSiteBundle({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
  })
  if (!bundle.ok) return bundle

  const take = clampTake(input.take)
  let sorted = dedupeKeywordRowsForList(bundle.value.rows)
  const q = input.search?.trim().toLowerCase()
  if (q) {
    sorted = sorted.filter(
      (row) => row.query.toLowerCase().includes(q) || (row.page ?? '').toLowerCase().includes(q),
    )
  }

  if (input.cursor) {
    const decoded = decodeSeoListCursor(input.cursor)
    if (!decoded.ok) return decoded
    sorted = keywordRowsAfterCursor(sorted, decoded.value)
  }

  const page = sorted.slice(0, take)
  const keywords: GscKeywordListItem[] = page.map(
    ({ sortDateMs: _d, sortQuery: _q, sortPage: _p, sortId: _i, ...rest }) => rest,
  )

  let nextCursor: string | undefined
  if (sorted.length > take) {
    const last = page[page.length - 1]!
    nextCursor = encodeSeoListCursor(keywordCursorFromRow(last))
  }

  return {
    ok: true,
    value: {
      gsc: bundle.value.performance,
      keywords,
      nextCursor,
      limitations: bundle.value.limitations,
    },
  }
}
