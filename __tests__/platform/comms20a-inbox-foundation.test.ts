import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeCommsListCursor, encodeCommsListCursor } from '@/lib/platform/comms/comms-list-cursor'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { resolveInboxVisibilityState } from '@/lib/platform/comms/inbox-visibility'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'

vi.mock('@/lib/db', () => ({
  prisma: {
    chatwootConversationMapping: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    chatwootInboxMapping: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('COMMS-20A inbox foundation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('cursor round-trip encodes list sort anchor', () => {
    const raw = encodeCommsListCursor({
      la: '2023-11-14T22:13:20.000Z',
      u: 1_700_000_000_000,
      i: 'cm_conv_1',
    })
    const decoded = decodeCommsListCursor(raw)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.value.i).toBe('cm_conv_1')
      expect(decoded.value.u).toBe(1_700_000_000_000)
    }
  })

  it('rejects malformed conversation list cursor', () => {
    expect(decodeCommsListCursor('not-valid').ok).toBe(false)
  })

  it('rejects unknown conversation filter', async () => {
    const result = await listAccountConversations({
      customerAccountId: 'acct',
      filter: 'bogus',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VALIDATION')
  })

  it('returns nextCursor when page is full', async () => {
    const row = {
      id: 'cm_1',
      externalConversationId: 'ext_1',
      externalInboxId: 'inbox_1',
      webxxlStatus: 'OPEN' as const,
      channel: 'web',
      crmContactId: null,
      lastActivityAt: new Date('2026-10-20T12:00:00Z'),
      lastSyncAt: new Date('2026-10-20T11:00:00Z'),
      coverageState: 'PARTIAL',
      syncError: null,
      updatedAt: new Date('2026-10-20T12:00:00Z'),
    }
    vi.mocked(prisma.chatwootConversationMapping.findMany).mockResolvedValue([row, row] as never)
    const result = await listAccountConversations({ customerAccountId: 'acct', take: 2 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.conversations).toHaveLength(2)
      expect(result.value.nextCursor).toBeTruthy()
    }
  })

  it('inbox visibility states cover pending, verified, disconnected', () => {
    expect(
      resolveInboxVisibilityState({
        tenantRevoked: true,
        tenantVerificationState: 'VERIFIED',
        inboxVerificationState: 'VERIFIED',
      }),
    ).toBe('DISCONNECTED')
    expect(
      resolveInboxVisibilityState({
        tenantRevoked: false,
        tenantVerificationState: 'PENDING',
        inboxVerificationState: 'PENDING',
      }),
    ).toBe('MAPPING_PENDING')
    expect(
      resolveInboxVisibilityState({
        tenantRevoked: false,
        tenantVerificationState: 'VERIFIED',
        inboxVerificationState: 'VERIFIED',
        syncStale: false,
      }),
    ).toBe('VERIFIED')
  })

  it('billing group does not grant inbox conversation access', () => {
    const denied = denyBillingGroupSiblingCommsAccess({
      actorUserId: 'u1',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map(),
    })
    expect(denied.ok).toBe(false)
  })
})
