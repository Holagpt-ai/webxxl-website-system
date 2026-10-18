/**
 * Postiz Public API HTTP transport (docs.postiz.com/public-api).
 * Reference app pin: v2.25.1 (INFRA-02). Cloud base: https://api.postiz.com/public/v1
 * Self-hosted WebXXL candidate: {scheduler}/public/v1 (UNVERIFIED live credentials).
 */

export type PostizHttpRequest = {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Record<string, string>
  body?: unknown
  authorization: string
}

export type PostizHttpResponse = {
  status: number
  json: unknown
}

export type PostizHttpTransport = (request: PostizHttpRequest) => Promise<PostizHttpResponse>

export type PostizIntegration = {
  id: string
  name: string
  providerIdentifier: string
  picture?: string
}

export type PostizPostState = 'QUEUE' | 'PUBLISHED' | 'ERROR' | 'DRAFT'

export type PostizPost = {
  id: string
  content?: string
  publishDate?: string
  releaseURL?: string
  state: PostizPostState
  error?: string | null
  integration?: { id: string; providerIdentifier?: string; name?: string }
}

export function createFetchPostizTransport(baseUrl: string): PostizHttpTransport {
  return async (request) => {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}${request.path}`)
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) url.searchParams.set(key, value)
    }
    const res = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: request.authorization,
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

export function mapPostizIntegrations(json: unknown): PostizIntegration[] {
  if (!json || typeof json !== 'object') return []
  const integrations = (json as { integrations?: PostizIntegration[] }).integrations
  return Array.isArray(integrations) ? integrations : []
}

export function mapPostizPosts(json: unknown): PostizPost[] {
  if (!json || typeof json !== 'object') return []
  const posts = (json as { posts?: PostizPost[] }).posts
  return Array.isArray(posts) ? posts : []
}
