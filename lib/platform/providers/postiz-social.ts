import {
  isPostizApiEnabled,
  isPostizLivePublishingEnabled,
  postizApiBaseUrl,
  postizApiSecretRef,
} from '@/config/social-marketing'
import {
  createFetchPostizTransport,
  mapPostizIntegrations,
  mapPostizPosts,
  type PostizHttpTransport,
  type PostizPost,
} from '@/lib/platform/providers/postiz-http'
import type { ProviderAuthContext, ProviderResult, SocialPublisherProvider } from '@/lib/platform/providers/types'
import type { SocialPlatformKey } from '@/lib/platform/social/types'

export const POSTIZ_REFERENCE_APP_TAG = 'v2.25.1'
export const POSTIZ_API_DOCS = 'https://docs.postiz.com/public-api'

export type PostizScheduleInput = {
  customerAccountId: string
  externalIntegrationId: string
  caption: string
  scheduledAt: Date
  platformType: SocialPlatformKey
  idempotencyKey: string
}

export type PostizSocialPublisher = {
  schedulePost(input: PostizScheduleInput): Promise<
    ProviderResult<{ externalPostId: string }> | { ok: false; code: 'UNKNOWN'; message: string }
  >
  getPostStatus(externalPostId: string): Promise<ProviderResult<PostizPost>>
  listIntegrations(): Promise<ProviderResult<PostizIntegrationView[]>>
}

export type PostizIntegrationView = {
  id: string
  name: string
  providerIdentifier: string
}

function resolveApiKey(secretResolver: (ref: string) => string | null): string | null {
  const ref = postizApiSecretRef()
  if (ref?.startsWith('env:')) {
    const envName = ref.slice('env:'.length)
    const fromEnv = process.env[envName]?.trim()
    if (fromEnv) return fromEnv
  } else if (ref) {
    const resolved = secretResolver(ref)
    if (resolved) return resolved
  }
  return secretResolver('default')
}

function platformSettings(platform: SocialPlatformKey): Record<string, unknown> {
  if (platform === 'linkedin') return { __type: 'linkedin' }
  if (platform === 'instagram') return { __type: 'instagram', post_type: 'post' }
  if (platform === 'facebook') return { __type: 'facebook' }
  if (platform === 'x') return { __type: 'x', who_can_reply_post: 'everyone' }
  if (platform === 'youtube') return { __type: 'youtube', title: 'WebXXL scheduled post', type: 'public' }
  return { __type: 'tiktok', privacy_level: 'PUBLIC_TO_EVERYONE', content_posting_method: 'DIRECT_POST' }
}

export function createPostizSocialPublisher(options?: {
  transport?: PostizHttpTransport
  secretResolver?: (ref: string) => string | null
  /** Vitest-only: mock transport tests bypass backend env gates. */
  ignoreEnvGates?: boolean
}): PostizSocialPublisher {
  const transport = options?.transport ?? createFetchPostizTransport(postizApiBaseUrl())
  const secretResolver = options?.secretResolver ?? (() => null)

  return {
    async listIntegrations() {
      if (!options?.ignoreEnvGates && !isPostizApiEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'POSTIZ_API_ENABLED is false' }
      }
      const apiKey = resolveApiKey(secretResolver)
      if (!apiKey) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'Postiz API credentials not configured' }
      }
      const res = await transport({
        method: 'GET',
        path: '/integrations',
        authorization: apiKey,
      })
      if (res.status === 401 || res.status === 403) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Postiz API rejected credentials' }
      }
      if (res.status >= 500) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Postiz API unavailable' }
      }
      return { ok: true, value: mapPostizIntegrations(res.json).map((row) => ({
        id: row.id,
        name: row.name,
        providerIdentifier: row.providerIdentifier,
      })) }
    },

    async schedulePost(input) {
      if (
        !options?.ignoreEnvGates &&
        (!isPostizApiEnabled() || !isPostizLivePublishingEnabled())
      ) {
        return {
          ok: false,
          code: 'NOT_CONFIGURED',
          message: 'Postiz live publishing disabled',
        }
      }
      const apiKey = resolveApiKey(secretResolver)
      if (!apiKey) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'Postiz API credentials not configured' }
      }
      const body = {
        type: 'schedule',
        date: input.scheduledAt.toISOString(),
        shortLink: false,
        tags: [],
        posts: [
          {
            integration: { id: input.externalIntegrationId },
            value: [{ content: input.caption, image: [] }],
            settings: platformSettings(input.platformType),
          },
        ],
      }
      const res = await transport({
        method: 'POST',
        path: '/posts',
        authorization: apiKey,
        body,
      })
      if (res.status === 408 || res.status === 504) {
        return { ok: false, code: 'UNKNOWN', message: 'Postiz schedule request timed out' }
      }
      if (res.status === 429) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Postiz rate limit exceeded' }
      }
      if (res.status >= 500) {
        return { ok: false, code: 'UNKNOWN', message: 'Postiz server error during schedule' }
      }
      if (res.status >= 400) {
        return { ok: false, code: 'DENIED', message: `Postiz rejected schedule (${res.status})` }
      }
      const posts = mapPostizPosts(res.json)
      const externalPostId = posts[0]?.id
      if (!externalPostId) {
        return { ok: false, code: 'UNKNOWN', message: 'Postiz accepted request without post id' }
      }
      return { ok: true, value: { externalPostId } }
    },

    async getPostStatus(externalPostId) {
      if (!options?.ignoreEnvGates && !isPostizApiEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'POSTIZ_API_ENABLED is false' }
      }
      const apiKey = resolveApiKey(secretResolver)
      if (!apiKey) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'Postiz API credentials not configured' }
      }
      const now = new Date()
      const start = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString()
      const end = new Date(now.getTime() + 7 * 24 * 3600_000).toISOString()
      const res = await transport({
        method: 'GET',
        path: '/posts',
        authorization: apiKey,
        query: { startDate: start, endDate: end },
      })
      if (res.status >= 400) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Unable to read Postiz post status' }
      }
      const posts = mapPostizPosts(res.json)
      const match = posts.find((p) => p.id === externalPostId)
      if (!match) {
        return { ok: false, code: 'UNAVAILABLE', message: 'Post not found in provider window' }
      }
      return { ok: true, value: match }
    },
  }
}

export function createPostizSocialProvider(options?: {
  transport?: PostizHttpTransport
  secretResolver?: (ref: string) => string | null
}): SocialPublisherProvider {
  const publisher = createPostizSocialPublisher(options)
  return {
    kind: 'social',
    key: 'postiz',
    displayName: 'Postiz',
    availability: 'NOT_ACTIVATED',
    replaceable: true,
    installed: false,
    async listChannels(context: ProviderAuthContext) {
      if (!context.customerAccountId) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Customer account required' }
      }
      const listed = await publisher.listIntegrations()
      if (!listed.ok) return listed
      return { ok: true, value: listed.value as never[] }
    },
    async getChannelStatus(context, externalIntegrationId) {
      const listed = await publisher.listIntegrations()
      if (!listed.ok) return listed
      const match = listed.value.find((row) => row.id === externalIntegrationId)
      if (!match) return { ok: false, code: 'DENIED', message: 'Integration not visible to credentials' }
      return { ok: true, value: { connected: true, name: match.name, providerIdentifier: match.providerIdentifier } }
    },
    schedulePost: publisher.schedulePost.bind(publisher),
    getPostStatus: publisher.getPostStatus.bind(publisher),
  }
}
