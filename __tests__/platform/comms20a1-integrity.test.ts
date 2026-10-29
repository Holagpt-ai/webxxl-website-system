import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compareConversationListOrder,
  paginateConversationListInMemory,
} from '@/lib/platform/comms/comms-conversation-sort'
import { decodeCommsListCursor, encodeCommsListCursor } from '@/lib/platform/comms/comms-list-cursor'
import { chatwootConnectionState } from '@/lib/platform/comms/connections-service'
import { parseConversationListTake, resolveVerifiedInboxExternalId } from '@/lib/platform/comms/conversation-list-validation'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { COMMS_LIST_MAX_TAKE } from '@/config/comms-backend'

vi.mock('@/lib/db', () => ({
  prisma: {
    chatwootConversationMapping: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
    },
    chatwootInboxMapping: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    chatwootTenantMapping: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('COMMS-20A.1 integrity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('cursor encodes lastActivityAt, updatedAt, and id dimensions', () => {
    const raw = encodeCommsListCursor({
      la: '2026-10-20T12:00:00.000Z',
      u: new Date('2026-10-21T08:00:00.000Z').getTime(),
      i: 'cm_abc',
    })
    const decoded = decodeCommsListCursor(raw)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.value.la).toBe('2026-10-20T12:00:00.000Z')
      expect(decoded.value.i).toBe('cm_abc')
    }
  })

  it('multipage in-memory pagination visits every row once without gaps', () => {
    const base = [
      { id: 'a', lastActivityAt: new Date('2026-10-22T00:00:00Z'), updatedAt: new Date('2026-10-22T01:00:00Z') },
      { id: 'b', lastActivityAt: new Date('2026-10-22T00:00:00Z'), updatedAt: new Date('2026-10-22T00:30:00Z') },
      { id: 'c', lastActivityAt: new Date('2026-10-21T00:00:00Z'), updatedAt: new Date('2026-10-21T12:00:00Z') },
      { id: 'd', lastActivityAt: null, updatedAt: new Date('2026-10-23T00:00:00Z') },
      { id: 'e', lastActivityAt: null, updatedAt: new Date('2026-10-22T00:00:00Z') },
      { id: 'f', lastActivityAt: new Date('2026-10-22T00:00:00Z'), updatedAt: new Date('2026-10-22T00:30:00Z') },
    ]
    const sorted = [...base].sort(compareConversationListOrder)
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'f', 'c', 'd', 'e'])

    const seen = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < 10; page++) {
      const { rows, nextCursor } = paginateConversationListInMemory(base, 2, cursor)
      if (rows.length === 0) break
      for (const row of rows) {
        expect(seen.has(row.id)).toBe(false)
        seen.add(row.id)
      }
      cursor = nextCursor
      if (!nextCursor) break
    }
    expect(seen.size).toBe(base.length)
  })

  it('classifies revoked tenant mapping as DISCONNECTED', () => {
    const state = chatwootConnectionState({
      mapping: {
        verificationState: 'VERIFIED',
        revokedAt: new Date('2026-10-01T00:00:00Z'),
        lastVerifiedAt: new Date('2026-09-01T00:00:00Z'),
        inboxMappings: [{ verificationState: 'VERIFIED' }],
      },
      apiEnabled: true,
    })
    expect(state.dataState).toBe('DISCONNECTED')
    expect(state.disconnected).toBe(true)
  })

  it('rejects non-integer and out-of-range take values', () => {
    expect(parseConversationListTake(Number.NaN).ok).toBe(false)
    expect(parseConversationListTake(1.5).ok).toBe(false)
    expect(parseConversationListTake(0).ok).toBe(false)
    expect(parseConversationListTake(COMMS_LIST_MAX_TAKE + 1).ok).toBe(false)
    expect(parseConversationListTake(25).ok).toBe(true)
  })

  it('requires verified inbox and tenant for inbox filter', async () => {
    vi.mocked(prisma.chatwootInboxMapping.findFirst).mockResolvedValue(null)
    const denied = await resolveVerifiedInboxExternalId({ customerAccountId: 'acct', inboxId: 'in_1' })
    expect(denied.ok).toBe(false)

    vi.mocked(prisma.chatwootInboxMapping.findFirst).mockResolvedValue({ externalInboxId: 'ext_inbox' } as never)
    const ok = await resolveVerifiedInboxExternalId({ customerAccountId: 'acct', inboxId: 'in_1' })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value).toBe('ext_inbox')
  })

  it('listAccountConversations rejects invalid take before querying', async () => {
    const result = await listAccountConversations({ customerAccountId: 'acct', take: 9999 })
    expect(result.ok).toBe(false)
    expect(prisma.chatwootConversationMapping.findMany).not.toHaveBeenCalled()
  })
})
