import { COMMS_CONVERSATION_STALE_MINUTES, COMMS_LIST_MAX_TAKE } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import type { CommsConversationFilter, CommsResult } from '@/lib/platform/comms/types'
import type { CommsConversationStatus } from '@prisma/client'

export type ConversationSummary = {
  id: string
  externalConversationId: string
  externalInboxId: string
  webxxlStatus: CommsConversationStatus
  channel: string
  crmContactId: string | null
  lastActivityAt: Date | null
  lastSyncAt: Date | null
  syncStale: boolean
  coverageState: string
}

function isSyncStale(lastSyncAt: Date | null, now: Date): boolean {
  if (!lastSyncAt) return true
  const ageMs = now.getTime() - lastSyncAt.getTime()
  return ageMs > COMMS_CONVERSATION_STALE_MINUTES * 60_000
}

function mapProviderStatus(status: string): CommsConversationStatus {
  const normalized = status.toLowerCase()
  if (normalized === 'resolved') return 'RESOLVED'
  if (normalized === 'pending' || normalized === 'snoozed') return 'PENDING'
  return 'OPEN'
}

export function translateChatwootConversationStatus(providerStatus: string): CommsConversationStatus {
  return mapProviderStatus(providerStatus)
}

export async function listAccountConversations(input: {
  customerAccountId: string
  filter?: CommsConversationFilter
  assignedUserRef?: string
  take?: number
}): Promise<CommsResult<ConversationSummary[]>> {
  const take = Math.min(Math.max(input.take ?? 50, 1), COMMS_LIST_MAX_TAKE)
  const now = new Date()
  const where: {
    customerAccountId: string
    webxxlStatus?: CommsConversationStatus
    assignedUserRef?: string | null
    syncError?: { not: null }
  } = { customerAccountId: input.customerAccountId }

  switch (input.filter) {
    case 'open':
      where.webxxlStatus = 'OPEN'
      break
    case 'pending':
      where.webxxlStatus = 'PENDING'
      break
    case 'resolved':
      where.webxxlStatus = 'RESOLVED'
      break
    case 'assigned_to_me':
      where.assignedUserRef = input.assignedUserRef
      break
    case 'unassigned':
      where.assignedUserRef = null
      break
    case 'needs_attention':
      where.syncError = { not: null }
      break
    default:
      break
  }

  const rows = await prisma.chatwootConversationMapping.findMany({
    where,
    orderBy: { lastActivityAt: 'desc' },
    take,
  })

  return {
    ok: true,
    value: rows.map((row) => ({
      id: row.id,
      externalConversationId: row.externalConversationId,
      externalInboxId: row.externalInboxId,
      webxxlStatus: row.webxxlStatus,
      channel: row.channel,
      crmContactId: row.crmContactId,
      lastActivityAt: row.lastActivityAt,
      lastSyncAt: row.lastSyncAt,
      syncStale: isSyncStale(row.lastSyncAt, now),
      coverageState: row.coverageState,
    })),
  }
}

export async function getAccountConversation(input: {
  customerAccountId: string
  conversationMappingId: string
}): Promise<CommsResult<ConversationSummary>> {
  const row = await prisma.chatwootConversationMapping.findFirst({
    where: { id: input.conversationMappingId, customerAccountId: input.customerAccountId },
  })
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Conversation not found' }
  const now = new Date()
  return {
    ok: true,
    value: {
      id: row.id,
      externalConversationId: row.externalConversationId,
      externalInboxId: row.externalInboxId,
      webxxlStatus: row.webxxlStatus,
      channel: row.channel,
      crmContactId: row.crmContactId,
      lastActivityAt: row.lastActivityAt,
      lastSyncAt: row.lastSyncAt,
      syncStale: isSyncStale(row.lastSyncAt, now),
      coverageState: row.coverageState,
    },
  }
}

/** Merge provider timestamps without regressing lastActivityAt on out-of-order sync. */
export function mergeConversationActivityTimestamps(input: {
  currentLast?: Date | null
  currentFirst?: Date | null
  eventAt: Date
}): { lastActivityAt: Date; firstActivityAt?: Date } {
  const last =
    !input.currentLast || input.eventAt.getTime() > input.currentLast.getTime() ? input.eventAt : input.currentLast
  const first =
    !input.currentFirst || input.eventAt.getTime() < input.currentFirst.getTime()
      ? input.eventAt
      : input.currentFirst
  return { lastActivityAt: last, firstActivityAt: first }
}
