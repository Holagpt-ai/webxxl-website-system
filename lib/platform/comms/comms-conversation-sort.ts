import {
  decodeCommsListCursor,
  encodeCommsListCursor,
  type CommsListCursorPayload,
} from '@/lib/platform/comms/comms-list-cursor'
import type { Prisma } from '@prisma/client'

/** Row fields used for list ordering (matches SQL orderBy). */
export type ConversationListSortRow = {
  id: string
  lastActivityAt: Date | null
  updatedAt: Date
}

/** DESC NULLS LAST on lastActivityAt, then updatedAt DESC, then id ASC. Negative = a before b in list. */
export function compareConversationListOrder(a: ConversationListSortRow, b: ConversationListSortRow): number {
  const aNull = a.lastActivityAt == null
  const bNull = b.lastActivityAt == null
  if (aNull !== bNull) return aNull ? 1 : -1
  if (!aNull && !bNull) {
    const byActivity = b.lastActivityAt!.getTime() - a.lastActivityAt!.getTime()
    if (byActivity !== 0) return byActivity
  }
  const byUpdated = b.updatedAt.getTime() - a.updatedAt.getTime()
  if (byUpdated !== 0) return byUpdated
  return a.id.localeCompare(b.id)
}

export function conversationListCursorFromRow(row: ConversationListSortRow): CommsListCursorPayload {
  return {
    la: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
    u: row.updatedAt.getTime(),
    i: row.id,
  }
}

export function encodeConversationListCursor(row: ConversationListSortRow): string {
  return encodeCommsListCursor(conversationListCursorFromRow(row))
}

/** True when row appears strictly after cursor anchor in list order (eligible for next page). */
export function conversationRowFollowsCursor(row: ConversationListSortRow, cursor: CommsListCursorPayload): boolean {
  const anchor: ConversationListSortRow = {
    id: cursor.i,
    lastActivityAt: cursor.la ? new Date(cursor.la) : null,
    updatedAt: new Date(cursor.u),
  }
  return compareConversationListOrder(anchor, row) < 0
}

export function buildConversationKeysetWhere(
  base: Prisma.ChatwootConversationMappingWhereInput,
  cursor: CommsListCursorPayload,
): Prisma.ChatwootConversationMappingWhereInput {
  const anchorUpdatedAt = new Date(cursor.u)

  if (cursor.la != null) {
    const anchorActivity = new Date(cursor.la)
    return {
      AND: [
        base,
        {
          OR: [
            { lastActivityAt: { lt: anchorActivity } },
            {
              lastActivityAt: anchorActivity,
              OR: [
                { updatedAt: { lt: anchorUpdatedAt } },
                { updatedAt: anchorUpdatedAt, id: { gt: cursor.i } },
              ],
            },
            { lastActivityAt: null },
          ],
        },
      ],
    }
  }

  return {
    AND: [
      base,
      {
        lastActivityAt: null,
        OR: [
          { updatedAt: { lt: anchorUpdatedAt } },
          { updatedAt: anchorUpdatedAt, id: { gt: cursor.i } },
        ],
      },
    ],
  }
}

/** Test helper: paginate sorted rows with the same keyset rules as the API. */
export function paginateConversationListInMemory(
  rows: ConversationListSortRow[],
  take: number,
  cursorRaw?: string,
): { rows: ConversationListSortRow[]; nextCursor?: string } {
  let cursor: CommsListCursorPayload | undefined
  if (cursorRaw) {
    const decoded = decodeCommsListCursor(cursorRaw)
    if (!decoded.ok) throw new Error(decoded.message)
    cursor = decoded.value
  }
  const sorted = [...rows].sort(compareConversationListOrder)
  const filtered = cursor ? sorted.filter((row) => conversationRowFollowsCursor(row, cursor!)) : sorted
  const page = filtered.slice(0, take)
  const nextCursor = page.length === take ? encodeConversationListCursor(page[page.length - 1]!) : undefined
  return { rows: page, nextCursor }
}
