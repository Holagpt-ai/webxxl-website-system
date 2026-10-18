/**
 * Chatwoot Application API transport (developers.chatwoot.com).
 * Application API uses `api_access_token` header — distinct from Platform API and Client API.
 * Reference pin: chatwoot/chatwoot:v4.18.0-ce (INFRA-02 staging only; not live-verified).
 */

export type ChatwootHttpRequest = {
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  query?: Record<string, string>
  body?: unknown
  apiAccessToken: string
}

export type ChatwootHttpResponse = {
  status: number
  json: unknown
}

export type ChatwootHttpTransport = (request: ChatwootHttpRequest) => Promise<ChatwootHttpResponse>

export function createFetchChatwootTransport(baseUrl: string): ChatwootHttpTransport {
  return async (request) => {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}${request.path}`)
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) url.searchParams.set(key, value)
    }
    const res = await fetch(url, {
      method: request.method,
      headers: {
        api_access_token: request.apiAccessToken,
        ...(request.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    return { status: res.status, json }
  }
}

export type ChatwootInboxSummary = { id: number; name: string; channel_type?: string }
export type ChatwootConversationSummary = {
  id: number
  inbox_id: number
  status: string
  meta?: { assignee?: { id: number } }
}
export type ChatwootMessageSummary = { id: number; content?: string; message_type?: number; created_at?: number }

export function mapChatwootInboxes(json: unknown): ChatwootInboxSummary[] {
  if (!Array.isArray(json)) {
    const payload = json as { payload?: ChatwootInboxSummary[] }
    if (Array.isArray(payload.payload)) return payload.payload
    return []
  }
  return json as ChatwootInboxSummary[]
}

export function mapChatwootConversations(json: unknown): ChatwootConversationSummary[] {
  const payload = json as { data?: { payload?: ChatwootConversationSummary[] } }
  if (payload?.data?.payload && Array.isArray(payload.data.payload)) return payload.data.payload
  if (Array.isArray(json)) return json as ChatwootConversationSummary[]
  return []
}

export function mapChatwootMessages(json: unknown): ChatwootMessageSummary[] {
  if (Array.isArray(json)) return json as ChatwootMessageSummary[]
  const payload = json as { payload?: ChatwootMessageSummary[] }
  return Array.isArray(payload.payload) ? payload.payload : []
}
