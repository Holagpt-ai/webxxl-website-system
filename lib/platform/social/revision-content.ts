import { stableSocialContentHash } from '@/lib/platform/social/hash'
import type { SocialPlatformKey } from '@/lib/platform/social/types'

export type SocialRevisionContentInput = {
  captionEn: string
  captionEs?: string
  mediaRefs: string[]
  platformPayloads: Record<string, unknown>
  targetChannelIds: string[]
  scheduledAt?: Date | string
}

export function computeSocialRevisionContentHash(input: SocialRevisionContentInput): string {
  const scheduledAt =
    input.scheduledAt instanceof Date
      ? input.scheduledAt.toISOString()
      : input.scheduledAt
        ? new Date(input.scheduledAt).toISOString()
        : undefined
  return stableSocialContentHash({
    captionEn: input.captionEn,
    captionEs: input.captionEs ?? null,
    mediaRefs: [...input.mediaRefs].sort(),
    platformPayloads: input.platformPayloads,
    targetChannelIds: [...input.targetChannelIds].sort(),
    scheduledAt,
  })
}

const ALLOWED_PLATFORMS = new Set<SocialPlatformKey>([
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
])

export function assertValidTargetPlatforms(platforms: string[]): { ok: true } | { ok: false; code: string; message: string } {
  for (const platform of platforms) {
    if (!ALLOWED_PLATFORMS.has(platform as SocialPlatformKey)) {
      return { ok: false, code: 'INVALID_PLATFORM', message: `Unsupported platform: ${platform}` }
    }
  }
  return { ok: true }
}

export function assertRevisionContentBounds(input: SocialRevisionContentInput): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.captionEn.trim()) {
    return { ok: false, code: 'INVALID_BODY', message: 'captionEn is required' }
  }
  if (input.captionEn.length > 5000) {
    return { ok: false, code: 'INVALID_BODY', message: 'captionEn exceeds maximum length' }
  }
  if (input.targetChannelIds.length === 0) {
    return { ok: false, code: 'INVALID_BODY', message: 'At least one target channel is required' }
  }
  return { ok: true }
}
