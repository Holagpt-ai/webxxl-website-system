import { COMMS_CONVERSATION_STALE_MINUTES, COMMS_LIST_DEFAULT_TAKE, COMMS_LIST_MAX_TAKE } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { decodeCommsListCursor, encodeCommsListCursor } from '@/lib/platform/comms/comms-list-cursor'
import type { CommsConversationFilter, CommsResult } from '@/lib/platform/comms/types'
import type { CommsConversationStatus, Prisma } from '@prisma/client'

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
  needsAttention: boolean
}

export type ConversationDetail = ConversationSummary & {
  assignedUserRef: string | null
  priority: string
  syncError: string | null
  inboxMappingId: string | null
  crmContact: { id: string; displayName: string | null } | null
  crmTimelinePath: string | null
  tenantVerificationState: string | null
  providerConnected: boolean
  transcriptAvailable: false
  transcriptNote: string
}

const FILTER_VALUES: CommsConversationFilter[] = [
  'open',
  'pending',
  'resolved',
  'assigned',
  'assigned_to_me',
  'unassigned',
  'needs_attention',
]

function isSyncStale(lastSyncAt: Date | null, now: Date): boolean {
  if (!lastSyncAt) return true
  const ageMs = now.getTime() - lastSyncAt.getTime()
  return ageMs > COMMS_CONVERSATION_STALE_MINUTES * 60_000
}

function activitySortTime(row: { lastActivityAt: Date | null; updatedAt: Date }): number {
  return (row.lastActivityAt ?? row.updatedAt).getTime()
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

function parseFilter(raw: string | undefined): CommsResult<CommsConversationFilter | undefined> {
  if (!raw) return { ok: true, value: undefined }
  if (!FILTER_VALUES.includes(raw as CommsConversationFilter)) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid conversation filter' }
  }
  return { ok: true, value: raw as CommsConversationFilter }
}

function applyStatusFilter(
  where: Prisma.ChatwootConversationMappingWhereInput,
  filter: CommsConversationFilter | undefined,
  assignedUserRef?: string,
): void {
  switch (filter) {
    case 'open':
      where.webxxlStatus = 'OPEN'
      break
    case 'pending':
      where.webxxlStatus = 'PENDING'
      break
    case 'resolved':
      where.webxxlStatus = 'RESOLVED'
      break
    case 'assigned':
      where.assignedUserRef = { not: null }
      break
    case 'assigned_to_me':
      where.assignedUserRef = assignedUserRef
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
}

function cursorWhere(
  base: Prisma.ChatwootConversationMappingWhereInput,
  cursor: { t: number; i: string },
): Prisma.ChatwootConversationMappingWhereInput {
  const cursorAt = new Date(cursor.t)
  return {
    AND: [
      base,
      {
        OR: [
          { lastActivityAt: { not: null, lt: cursorAt } },
          { lastActivityAt: null, updatedAt: { lt: cursorAt } },
          { lastActivityAt: { not: null, equals: cursorAt }, id: { gt: cursor.i } },
          { lastActivityAt: null, updatedAt: cursorAt, id: { gt: cursor.i } },
        ],
      },
    ],
  }
}

function toSummary(row: {
  id: string
  externalConversationId: string
  externalInboxId: string
  webxxlStatus: CommsConversationStatus
  channel: string
  crmContactId: string | null
  lastActivityAt: Date | null
  lastSyncAt: Date | null
  coverageState: string
  syncError: string | null
  updatedAt: Date
}, now: Date): ConversationSummary {
  return {
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
    needsAttention: Boolean(row.syncError),
  }
}

export async function listAccountConversations(input: {
  customerAccountId: string
  filter?: string
  assignedUserRef?: string
  inboxId?: string
  channel?: string
  take?: number
  cursor?: string
}): Promise<CommsResult<{ conversations: ConversationSummary[]; nextCursor?: string }>> {
  const filter = parseFilter(input.filter)
  if (!filter.ok) return filter

  const take = Math.min(Math.max(input.take ?? COMMS_LIST_DEFAULT_TAKE, 1), COMMS_LIST_MAX_TAKE)
  const now = new Date()

  let where: Prisma.ChatwootConversationMappingWhereInput = { customerAccountId: input.customerAccountId }
  applyStatusFilter(where, filter.value, input.assignedUserRef)

  if (input.inboxId) {
    const inbox = await prisma.chatwootInboxMapping.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        OR: [{ id: input.inboxId }, { externalInboxId: input.inboxId }],
      },
    })
    if (!inbox) return { ok: false, code: 'VALIDATION', message: 'Inbox not found for account' }
    where.externalInboxId = inbox.externalInboxId
  }

  if (input.channel) {
    where.channel = input.channel
  }

  if (input.cursor) {
    const decoded = decodeCommsListCursor(input.cursor)
    if (!decoded.ok) return decoded
    where = cursorWhere(where, decoded.value)
  }

  const rows = await prisma.chatwootConversationMapping.findMany({
    where,
    orderBy: [
      { lastActivityAt: { sort: 'desc', nulls: 'last' } },
      { updatedAt: 'desc' },
      { id: 'asc' },
    ],
    take,
  })

  const conversations = rows.map((row) => toSummary(row, now))

  let nextCursor: string | undefined
  if (rows.length === take) {
    const last = rows[rows.length - 1]!
    nextCursor = encodeCommsListCursor({ t: activitySortTime(last), i: last.id })
  }

  return { ok: true, value: { conversations, nextCursor } }
}

export async function getAccountConversation(input: {
  customerAccountId: string
  conversationMappingId: string
}): Promise<CommsResult<ConversationDetail>> {
  const row = await prisma.chatwootConversationMapping.findFirst({
    where: { id: input.conversationMappingId, customerAccountId: input.customerAccountId },
    include: {
      tenantMapping: { select: { verificationState: true, revokedAt: true } },
      crmContact: { select: { id: true, customerAccountId: true, givenName: true, familyName: true, preferredName: true } },
    },
  })
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Conversation not found' }

  const inbox = await prisma.chatwootInboxMapping.findFirst({
    where: { customerAccountId: input.customerAccountId, externalInboxId: row.externalInboxId },
    select: { id: true },
  })

  let crmContact: ConversationDetail['crmContact'] = null
  let crmTimelinePath: string | null = null
  if (row.crmContact && row.crmContact.customerAccountId === input.customerAccountId) {
    const displayName =
      row.crmContact.preferredName?.trim() ||
      [row.crmContact.givenName, row.crmContact.familyName].filter(Boolean).join(' ').trim() ||
      null
    crmContact = { id: row.crmContact.id, displayName }
    crmTimelinePath = `/api/v1/crm/contacts/${row.crmContact.id}/timeline`
  }

  const now = new Date()
  const authorizedContactId = crmContact ? row.crmContactId : null
  const summary = toSummary({ ...row, crmContactId: authorizedContactId }, now)
  const providerConnected =
    row.tenantMapping.revokedAt == null && row.tenantMapping.verificationState === 'VERIFIED'

  return {
    ok: true,
    value: {
      ...summary,
      assignedUserRef: row.assignedUserRef,
      priority: row.priority,
      syncError: row.syncError,
      inboxMappingId: inbox?.id ?? null,
      crmContact,
      crmTimelinePath,
      tenantVerificationState: row.tenantMapping.verificationState,
      providerConnected,
      transcriptAvailable: false,
      transcriptNote:
        'Message transcript is not stored in WebXXL for customer read; use CRM timeline for linked contact history when authorized.',
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
