/** Server-only ABMED control API client. Do not import from client components. */
import type { AbmedCampaignSiteSlug } from '@/lib/managed-sites/abmed/site-slug'

export type AbmedRemoteCampaign = {
  id: string
  slug: string
  name: string
  type: string
  placement: string
  status: string
  derivedState: string
  headline: string
  body: string
  imageUrl: string | null
  ctaText: string
  ctaDestination: string
  startAt: string | null
  endAt: string | null
  delayMs: number
  frequencyDays: number
  priority: number
  deviceTargeting: string
  currentVersion: number
  approvedAt: string | null
  publishedAt: string | null
  updatedAt: string
  site: AbmedCampaignSiteSlug
}

type ControlConfig = { baseUrl: string; secret: string }

export function getAbmedControlConfig(): ControlConfig | null {
  const baseUrl = process.env.ABMED_CONTROL_API_BASE?.trim().replace(/\/$/, '')
  const secret = process.env.ABMED_CONTROL_API_SECRET?.trim()
  if (!baseUrl || !secret) return null
  return { baseUrl, secret }
}

export function isAbmedControlConfigured(): boolean {
  return getAbmedControlConfig() != null
}

async function abmedControlFetch<T>(
  path: string,
  input: {
    site: AbmedCampaignSiteSlug
    actorUserId: string
    method?: string
    body?: unknown
  },
): Promise<{ ok: true; data: T } | { ok: false; code: string; status: number }> {
  const config = getAbmedControlConfig()
  if (!config) return { ok: false, code: 'unavailable', status: 503 }
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: input.method ?? 'GET',
    headers: {
      authorization: `Bearer ${config.secret}`,
      'x-webxxl-actor-id': input.actorUserId.slice(0, 120),
      'content-type': 'application/json',
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: 'no-store',
  })
  let payload: Record<string, unknown> = {}
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch {
    payload = {}
  }
  if (!response.ok) {
    return { ok: false, code: typeof payload.code === 'string' ? payload.code : 'unavailable', status: response.status }
  }
  return { ok: true, data: payload as T }
}

export async function listAbmedRemoteCampaigns(site: AbmedCampaignSiteSlug, actorUserId: string) {
  return abmedControlFetch<{ campaigns: AbmedRemoteCampaign[] }>(
    `/api/integrations/webxxl/campaigns?site=${encodeURIComponent(site)}`,
    { site, actorUserId },
  )
}

export async function createAbmedRemoteDraft(
  site: AbmedCampaignSiteSlug,
  actorUserId: string,
  fields: Record<string, unknown>,
) {
  return abmedControlFetch<{ campaign: AbmedRemoteCampaign }>(`/api/integrations/webxxl/campaigns`, {
    site,
    actorUserId,
    method: 'POST',
    body: { site, ...fields },
  })
}

export async function updateAbmedRemoteDraft(
  site: AbmedCampaignSiteSlug,
  actorUserId: string,
  campaignId: string,
  expectedVersion: number,
  fields: Record<string, unknown>,
) {
  return abmedControlFetch<{ campaign: AbmedRemoteCampaign }>(`/api/integrations/webxxl/campaigns/${campaignId}`, {
    site,
    actorUserId,
    method: 'PATCH',
    body: { site, expectedVersion, ...fields },
  })
}

export async function requestAbmedRemoteApproval(
  site: AbmedCampaignSiteSlug,
  actorUserId: string,
  campaignId: string,
  expectedVersion: number,
) {
  return abmedControlFetch<{ campaign: AbmedRemoteCampaign }>(
    `/api/integrations/webxxl/campaigns/${campaignId}/request-approval?site=${encodeURIComponent(site)}`,
    { site, actorUserId, method: 'POST', body: { expectedVersion } },
  )
}
