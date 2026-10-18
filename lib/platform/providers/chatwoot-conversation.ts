import { isChatwootApiEnabled } from '@/config/comms-backend'
import {
  createFetchChatwootTransport,
  mapChatwootConversations,
  mapChatwootInboxes,
  mapChatwootMessages,
  type ChatwootHttpTransport,
} from '@/lib/platform/providers/chatwoot-http'
import type {
  ConversationProvider,
  ConversationProviderCapabilities,
  ProviderAuthContext,
  ProviderResult,
} from '@/lib/platform/providers/types'

export type ChatwootConversationProviderConfig = {
  baseUrl: string
  transport?: ChatwootHttpTransport
  resolveApiAccessToken: (context: ProviderAuthContext) => Promise<string | null>
  resolveExternalAccountId: (context: ProviderAuthContext) => Promise<string | null>
}

export function createChatwootConversationProvider(config: ChatwootConversationProviderConfig): ConversationProvider {
  const transport = config.transport ?? createFetchChatwootTransport(config.baseUrl)

  async function requireToken(context: ProviderAuthContext): Promise<ProviderResult<string>> {
    if (!isChatwootApiEnabled()) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'CHATWOOT_API_ENABLED=false' }
    }
    const token = await config.resolveApiAccessToken(context)
    if (!token) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot api_access_token not configured' }
    return { ok: true, value: token }
  }

  return {
    kind: 'conversation',
    key: 'chatwoot',
    displayName: 'Chatwoot',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: false,
    pinnedEdition: 'chatwoot/chatwoot:v4.18.0-ce',
    describeCapabilities(): ConversationProviderCapabilities {
      return {
        accountDiscovery: true,
        inboxListing: true,
        contactLookup: true,
        conversationListing: true,
        conversationRetrieval: true,
        messageMetadata: true,
        assignment: false,
        statusHandoff: false,
        eventSync: false,
        healthCheck: true,
        outboundMutations: false,
      }
    },
    async healthCheck(context) {
      const tokenResult = await requireToken(context)
      if (!tokenResult.ok) return tokenResult
      const accountId = await config.resolveExternalAccountId(context)
      if (!accountId) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot account mapping missing' }
      const res = await transport({
        method: 'GET',
        path: `/api/v1/accounts/${accountId}/inboxes`,
        apiAccessToken: tokenResult.value,
      })
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: `Chatwoot health check failed (${res.status})` }
      }
      return { ok: true, value: { connected: true, inboxCount: mapChatwootInboxes(res.json).length } }
    },
    async listInboxes(context) {
      const tokenResult = await requireToken(context)
      if (!tokenResult.ok) return tokenResult
      const accountId = await config.resolveExternalAccountId(context)
      if (!accountId) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot account mapping missing' }
      const res = await transport({
        method: 'GET',
        path: `/api/v1/accounts/${accountId}/inboxes`,
        apiAccessToken: tokenResult.value,
      })
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Unable to list Chatwoot inboxes' }
      }
      return {
        ok: true,
        value: mapChatwootInboxes(res.json).map((inbox) => ({
          id: String(inbox.id),
          name: inbox.name,
          channelType: inbox.channel_type ?? 'unknown',
        })),
      }
    },
    async listConversations(context, query) {
      const tokenResult = await requireToken(context)
      if (!tokenResult.ok) return tokenResult
      const accountId = await config.resolveExternalAccountId(context)
      if (!accountId) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot account mapping missing' }
      const res = await transport({
        method: 'GET',
        path: `/api/v1/accounts/${accountId}/conversations`,
        query: query?.status ? { status: query.status } : undefined,
        apiAccessToken: tokenResult.value,
      })
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Unable to list Chatwoot conversations' }
      }
      return {
        ok: true,
        value: mapChatwootConversations(res.json).map((row) => ({
          id: String(row.id),
          inboxId: String(row.inbox_id),
          status: row.status,
          assigneeId: row.meta?.assignee?.id != null ? String(row.meta.assignee.id) : undefined,
        })),
      }
    },
    async getConversation(context, conversationId) {
      const tokenResult = await requireToken(context)
      if (!tokenResult.ok) return tokenResult
      const accountId = await config.resolveExternalAccountId(context)
      if (!accountId) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot account mapping missing' }
      const res = await transport({
        method: 'GET',
        path: `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
        apiAccessToken: tokenResult.value,
      })
      if (res.status === 404) return { ok: false, code: 'UNKNOWN', message: 'Conversation not found' }
      if (res.status >= 400) return { ok: false, code: 'UNAVAILABLE', message: 'Unable to retrieve conversation' }
      const row = res.json as { id?: number; inbox_id?: number; status?: string }
      return {
        ok: true,
        value: {
          id: String(row.id ?? conversationId),
          inboxId: String(row.inbox_id ?? ''),
          status: row.status ?? 'open',
        },
      }
    },
    async listConversationMessages(context, conversationId) {
      const tokenResult = await requireToken(context)
      if (!tokenResult.ok) return tokenResult
      const accountId = await config.resolveExternalAccountId(context)
      if (!accountId) return { ok: false, code: 'NOT_CONFIGURED', message: 'Chatwoot account mapping missing' }
      const res = await transport({
        method: 'GET',
        path: `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
        apiAccessToken: tokenResult.value,
      })
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Unable to list conversation messages' }
      }
      return {
        ok: true,
        value: mapChatwootMessages(res.json).map((m) => ({
          id: String(m.id),
          messageType: m.message_type,
          createdAt: m.created_at,
        })),
      }
    },
    async lookupContactRef() {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'Contact lookup requires persisted ChatwootContactMapping (COMMS-06 read path)' }
    },
    async syncProviderEvents() {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'Provider polling sync not activated in COMMS-06' }
    },
  }
}
