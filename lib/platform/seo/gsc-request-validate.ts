import { SEO_GSC_MAX_ROWS } from '@/config/seo-backend'
import type { GscSearchAnalyticsRequest } from '@/lib/platform/seo/gsc-types'
import type { SeoResult } from '@/lib/platform/seo/types'

const ALLOWED_DIMENSIONS = new Set(['query', 'page', 'country', 'device', 'date'])
const MAX_RANGE_DAYS = 366

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateGscSearchAnalyticsRequest(request: GscSearchAnalyticsRequest): SeoResult<GscSearchAnalyticsRequest> {
  const start = parseYmd(request.startDate)
  const end = parseYmd(request.endDate)
  if (!start || !end) {
    return { ok: false, code: 'VALIDATION', message: 'startDate and endDate must be YYYY-MM-DD' }
  }
  if (end < start) {
    return { ok: false, code: 'VALIDATION', message: 'endDate must be on or after startDate' }
  }
  const rangeDays = (end.getTime() - start.getTime()) / 86400000 + 1
  if (rangeDays > MAX_RANGE_DAYS) {
    return { ok: false, code: 'VALIDATION', message: 'Date range exceeds maximum window' }
  }
  for (const dim of request.dimensions ?? []) {
    if (!ALLOWED_DIMENSIONS.has(dim)) {
      return { ok: false, code: 'VALIDATION', message: `Unsupported dimension: ${dim}` }
    }
  }
  if (request.rowLimit != null) {
    if (!Number.isInteger(request.rowLimit) || request.rowLimit <= 0 || request.rowLimit > SEO_GSC_MAX_ROWS) {
      return { ok: false, code: 'VALIDATION', message: 'rowLimit must be a positive integer within configured maximum' }
    }
  }
  if (request.startRow != null) {
    if (!Number.isInteger(request.startRow) || request.startRow < 0) {
      return { ok: false, code: 'VALIDATION', message: 'startRow must be a non-negative integer' }
    }
  }
  return { ok: true, value: request }
}
