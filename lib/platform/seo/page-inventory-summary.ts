import type { SeoPageInventoryStatus } from '@prisma/client'

export type PageInventoryCountRow = {
  status: SeoPageInventoryStatus
  count: number
}

export function summarizePageInventory(rows: PageInventoryCountRow[]): {
  discovered: number
  crawled: number
  draft: number
  preview: number
  published: number
  removed: number
  unverified: number
  publishedOnlyWhenVerified: number
} {
  const byStatus = new Map(rows.map((r) => [r.status, r.count]))
  const published = byStatus.get('PUBLISHED') ?? 0
  return {
    discovered: byStatus.get('DISCOVERED') ?? 0,
    crawled: byStatus.get('CRAWLED') ?? 0,
    draft: byStatus.get('DRAFT') ?? 0,
    preview: byStatus.get('PREVIEW') ?? 0,
    published,
    removed: byStatus.get('REMOVED') ?? 0,
    unverified: byStatus.get('UNVERIFIED') ?? 0,
    publishedOnlyWhenVerified: published,
  }
}
