/**
 * Browser-safe shapes for the Batch 20A communications read APIs. Only keys named in
 * docs/platform/docs/BATCH20B-COMMUNICATIONS-UI-CONTRACT.md are typed; nothing imports `@/lib/platform/**`.
 */

export const COMMS_API = {
  conversations: '/api/v1/communications/conversations',
  conversation: (id: string) => `/api/v1/communications/conversations/${encodeURIComponent(id)}`,
  inboxes: '/api/v1/communications/inboxes',
  connections: '/api/v1/communications/connections',
} as const

export const COMMS_PAGE_SIZE = 50

export const CONVERSATION_FILTERS = [
  'open',
  'pending',
  'resolved',
  'assigned',
  'assigned_to_me',
  'unassigned',
  'needs_attention',
] as const

export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]

export function parseConversationFilter(value: string | null): ConversationFilter | '' {
  return value && (CONVERSATION_FILTERS as readonly string[]).includes(value) ? (value as ConversationFilter) : ''
}

export type ConversationSummary = {
  id: string
  externalConversationId: string
  externalInboxId: string
  webxxlStatus: string
  channel: string
  crmContactId: string | null
  lastActivityAt: string | null
  lastSyncAt: string | null
  syncStale: boolean
  coverageState: string
  needsAttention: boolean
}

export type ConversationListResponse = {
  conversations: ConversationSummary[]
  nextCursor?: string
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
  transcriptAvailable: boolean
  transcriptNote: string
}

export type InboxVisibilityState = 'NOT_CONFIGURED' | 'MAPPING_PENDING' | 'VERIFIED' | 'DISCONNECTED' | 'STALE_SYNC'

export type CommsInbox = {
  id: string
  externalInboxId: string
  channelType: string | null
  verificationState: string
  tenantVerificationState: string | null
  tenantRevoked: boolean
  visibilityState: InboxVisibilityState | string
  lastSyncAt: string | null
  syncStale: boolean
}

export type ChatwootDataState = 'NOT_CONNECTED' | 'PARTIAL' | 'READY' | 'DISCONNECTED'

export type CommsConnections = {
  chatwoot: {
    configured: boolean
    verificationState?: string
    authorizedInboxCount: number
    verifiedInboxCount: number
    disconnected: boolean
    mappingPending: boolean
    staleSyncRisk: boolean
    dataState: ChatwootDataState | string
    summary: string
  }
  outbound: { enabled: boolean; dataState: 'DISABLED' | 'ENABLED' | string }
}

/** States shown on the connections page; the last two refine READY/PARTIAL from the backend flags. */
export type ConnectionDisplayState = ChatwootDataState | 'MAPPING_PENDING' | 'STALE_SYNC'

export function connectionDisplayState(chatwoot: CommsConnections['chatwoot']): ConnectionDisplayState {
  if (chatwoot.dataState === 'NOT_CONNECTED' || !chatwoot.configured) return 'NOT_CONNECTED'
  if (chatwoot.dataState === 'DISCONNECTED' || chatwoot.disconnected) return 'DISCONNECTED'
  if (chatwoot.mappingPending) return 'MAPPING_PENDING'
  if (chatwoot.staleSyncRisk) return 'STALE_SYNC'
  return chatwoot.dataState === 'READY' ? 'READY' : 'PARTIAL'
}

/** The list API rejects any inbox that is not verified under an active, verified tenant mapping. */
export function isFilterableInbox(inbox: CommsInbox): boolean {
  return inbox.verificationState === 'VERIFIED' && inbox.tenantVerificationState === 'VERIFIED' && !inbox.tenantRevoked
}

/**
 * Inboxes report the raw provider channel type; conversations carry the WebXXL channel label.
 * This mirrors the backend classifier so channel filters only offer values conversations can have.
 */
export function channelFromInboxType(channelType: string | null | undefined): string {
  if (!channelType) return 'unknown'
  const t = channelType.toLowerCase()
  if (t.includes('sms') || t.includes('twilio')) return 'sms'
  if (t.includes('email')) return 'email'
  if (t.includes('webwidget') || t.includes('web_widget') || t.includes('website')) return 'web_chat'
  if (['facebook', 'instagram', 'twitter', 'telegram', 'line'].some((k) => t.includes(k))) return 'social_dm'
  if (t.includes('whatsapp')) return 'whatsapp'
  if (t.includes('api')) return 'web_chat'
  return 'unknown'
}
