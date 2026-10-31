/** Stable ascending-id export page helper (testable without database). */
export function paginateStableIds(ids: string[], cursor: string | undefined, take: number): {
  pageIds: string[]
  nextCursor?: string
} {
  const sorted = [...ids].sort()
  const startIndex = cursor ? sorted.findIndex((id) => id === cursor) + 1 : 0
  const pageIds = sorted.slice(startIndex, startIndex + take)
  const hasMore = startIndex + take < sorted.length
  const nextCursor = hasMore && pageIds.length > 0 ? pageIds[pageIds.length - 1] : undefined
  return { pageIds, nextCursor }
}

export function buildExportIdCursorWhere(customerAccountId: string, cursor?: string) {
  return {
    customerAccountId,
    status: 'ACTIVE' as const,
    ...(cursor ? { id: { gt: cursor } } : {}),
  }
}
