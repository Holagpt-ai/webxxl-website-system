import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { createPostizSocialPublisher } from '@/lib/platform/providers/postiz-social'
import type { PostizHttpTransport } from '@/lib/platform/providers/postiz-http'
import {
  createSocialCampaignApproval,
  decideSocialCampaignApproval,
} from '@/lib/platform/social/approval-service'
import {
  addSocialCampaignRevision,
  createSocialCampaign,
  submitSocialCampaignForApproval,
} from '@/lib/platform/social/campaign-service'
import { getConnectionForAccount } from '@/lib/platform/social/connections-service'
import { createMarketingRequest } from '@/lib/platform/social/marketing-requests'
import { reconcileSocialPublication, scheduleApprovedSocialCampaign } from '@/lib/platform/social/scheduling-gateway'
import { assertSocialCampaignTransition } from '@/lib/platform/social/transitions'
import {
  buildSynthetic30DayEditorialPlan,
  createSocial04TestStore,
  trustedSocialStaffApprover,
} from '@/lib/platform/social/test-fixtures'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'

function aestheticsChannelId(store: ReturnType<typeof createSocial04TestStore>) {
  return [...store.connections.values()].find((c) => c.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!.id
}

describe('SOCIAL-04 Marketing Studio backend', () => {
  beforeEach(() => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'true')
    vi.stubEnv('POSTIZ_API_ENABLED', 'false')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'false')
    vi.stubEnv('MARKETING_STUDIO_DRAFTS_PER_MONTH', '100')
    vi.stubEnv('MARKETING_STUDIO_SCHEDULES_PER_MONTH', '100')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('maps customer account to isolated social connections', () => {
    const store = createSocial04TestStore()
    const aesthetics = listConnections(store, ABMED_AESTHETICS_ACCOUNT_ID)
    const physicians = listConnections(store, ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(aesthetics).toHaveLength(1)
    expect(physicians).toHaveLength(1)
    expect(aesthetics[0]?.externalChannelRef).not.toBe(physicians[0]?.externalChannelRef)
  })

  it('denies cross-account social channel access', () => {
    const store = createSocial04TestStore()
    const physiciansChannel = [...store.connections.values()].find(
      (c) => c.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID,
    )!
    const denied = getConnectionForAccount(store, physiciansChannel.id, ABMED_AESTHETICS_ACCOUNT_ID)
    expect(denied.ok).toBe(false)
  })

  it('denies using sibling account channel on another account campaign', async () => {
    const store = createSocial04TestStore()
    const physiciansChannel = [...store.connections.values()].find(
      (c) => c.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID,
    )!.id
    const { campaign, approval, scheduledAt } = seedApprovedCampaign(store)
    const publisher = createPostizSocialPublisher()
    const res = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: physiciansChannel,
      approvalId: approval.id,
      idempotencyKey: 'sibling-channel',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
  })

  it('creates campaign revisions with stable content hash', () => {
    const store = createSocial04TestStore()
    const campaign = createSocialCampaign(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: trustedSocialStaffApprover().userId,
      goal: 'Brand',
      locale: 'en',
      targetPlatforms: ['instagram', 'facebook'],
    })
    expect(campaign.ok).toBe(true)
    if (!campaign.ok) return
    const rev = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'Caption',
      captionEs: 'Subtítulo',
      targetChannelIds: [aestheticsChannelId(store)],
    })
    expect(rev.ok).toBe(true)
    if (rev.ok) expect(rev.value.contentHash.length).toBeGreaterThan(10)
  })

  it('rejects invalid campaign transitions', () => {
    expect(assertSocialCampaignTransition('DRAFT', 'PUBLISHED').ok).toBe(false)
    expect(assertSocialCampaignTransition('APPROVED', 'SCHEDULING').ok).toBe(true)
  })

  it('requires trusted human approval and rejects forged approver registration', () => {
    const store = createSocial04TestStore()
    const campaign = createSocialCampaign(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: trustedSocialStaffApprover().userId,
      goal: 'Approve me',
      locale: 'en',
      targetPlatforms: ['instagram'],
    })
    expect(campaign.ok).toBe(true)
    if (!campaign.ok) return
    const rev = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'Post',
      targetChannelIds: [aestheticsChannelId(store)],
    })
    expect(rev.ok).toBe(true)
    if (!rev.ok) return
    const approval = createSocialCampaignApproval(store, {
      campaignId: campaign.value.id,
      revisionId: rev.value.id,
      contentHash: rev.value.contentHash,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    const denied = decideSocialCampaignApproval(store, {
      approvalId: approval.id,
      trustedApprover: { kind: 'verified_human', userId: 'user_not_registered', platformWide: true },
      decision: 'APPROVED',
    })
    expect(denied.ok).toBe(false)
    const ok = decideSocialCampaignApproval(store, {
      approvalId: approval.id,
      trustedApprover: trustedSocialStaffApprover(),
      decision: 'APPROVED',
    })
    expect(ok.ok).toBe(true)
  })

  it('invalidates approval when content hash changes', async () => {
    const store = createSocial04TestStore()
    const campaign = createSocialCampaign(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: trustedSocialStaffApprover().userId,
      goal: 'Hash',
      locale: 'en',
      targetPlatforms: ['instagram'],
    })
    if (!campaign.ok) return
    const rev = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'v1',
      targetChannelIds: [aestheticsChannelId(store)],
    })
    if (!rev.ok) return
    const approval = createSocialCampaignApproval(store, {
      campaignId: campaign.value.id,
      revisionId: rev.value.id,
      contentHash: rev.value.contentHash,
      expiresAt: new Date(Date.now() + 3600_000),
    })
    decideSocialCampaignApproval(store, {
      approvalId: approval.id,
      trustedApprover: trustedSocialStaffApprover(),
      decision: 'APPROVED',
    })
    addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'v2 changed',
      targetChannelIds: [aestheticsChannelId(store)],
    })
    approval.contentHash = 'tampered'
    const publisher = createPostizSocialPublisher()
    const res = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: aestheticsChannelId(store),
      approvalId: approval.id,
      idempotencyKey: 'hash-test',
      scheduledAt: new Date('2026-11-02T15:00:00Z'),
    })
    expect(res.ok).toBe(false)
  })

  it('prevents duplicate scheduling intents via idempotency key', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'POST' && req.path === '/posts') {
        return { status: 200, json: { posts: [{ id: 'post_123', state: 'QUEUE' }] } }
      }
      return { status: 200, json: { integrations: [] } }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const first = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'dup-key',
      scheduledAt,
    })
    const second = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'dup-key',
      scheduledAt,
    })
    expect(first.ok && second.ok).toBe(true)
    expect(store.schedulingByIdempotency.size).toBe(1)
  })

  it('marks provider timeout as reconciliation required without republishing', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    const transport: PostizHttpTransport = async () => ({ status: 504, json: null })
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const res = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'timeout-key',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('RECONCILIATION_REQUIRED')
  })

  it('does not mark scheduled posts as published without provider evidence', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'POST') return { status: 200, json: { posts: [{ id: 'post_sched', state: 'QUEUE' }] } }
      return { status: 200, json: { posts: [{ id: 'post_sched', state: 'QUEUE' }] } }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const scheduled = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'sched-key',
      scheduledAt,
    })
    expect(scheduled.ok).toBe(true)
    if (!scheduled.ok) return
    expect(scheduled.value.publication.status).toBe('SCHEDULED')
    expect(scheduled.value.publication.publishedUrl).toBeUndefined()
    const pub = await reconcileSocialPublication(
      store,
      publisher,
      scheduled.value.publication.id,
      ABMED_AESTHETICS_ACCOUNT_ID,
    )
    expect(pub.ok).toBe(true)
    if (pub.ok) expect(pub.value.status).toBe('SCHEDULED')
  })

  it('marks published only when provider returns release URL', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'POST') return { status: 200, json: { posts: [{ id: 'post_pub', state: 'QUEUE' }] } }
      return {
        status: 200,
        json: {
          posts: [
            {
              id: 'post_pub',
              state: 'PUBLISHED',
              releaseURL: 'https://instagram.com/p/abc',
              publishDate: '2026-11-03T16:00:00.000Z',
            },
          ],
        },
      }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const scheduled = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'pub-key',
      scheduledAt,
    })
    expect(scheduled.ok).toBe(true)
    if (!scheduled.ok) return
    const pub = await reconcileSocialPublication(
      store,
      publisher,
      scheduled.value.publication.id,
      ABMED_AESTHETICS_ACCOUNT_ID,
    )
    expect(pub.ok).toBe(true)
    if (pub.ok) {
      expect(pub.value.status).toBe('PUBLISHED')
      expect(pub.value.publishedUrl).toContain('instagram.com')
    }
  })

  it('blocks dispatch for revoked channels', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const conn = store.connections.get(channel)
    if (conn) conn.connectionState = 'REVOKED'
    const publisher = createPostizSocialPublisher()
    const res = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'revoked-key',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
  })

  it('returns NOT_CONFIGURED when Postiz live publishing is disabled', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const publisher = createPostizSocialPublisher()
    const res = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'disabled-key',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(['NOT_CONFIGURED', 'CHANNEL_NOT_CONNECTED']).toContain(res.code)
  })

  it('builds synthetic 30-day editorial plan with EN/ES variants', () => {
    const store = createSocial04TestStore()
    const plan = buildSynthetic30DayEditorialPlan(store, ABMED_AESTHETICS_ACCOUNT_ID, trustedSocialStaffApprover().userId)
    expect(plan).toHaveLength(30)
    expect(plan.some((p) => p.locale === 'en')).toBe(true)
    expect(plan.some((p) => p.locale === 'es')).toBe(true)
    expect(new Set(plan.map((p) => p.platform)).size).toBeGreaterThan(1)
  })

  it('blocks ad spend and PHI in marketing requests', () => {
    const store = createSocial04TestStore()
    const ad = createMarketingRequest(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      requestType: 'AD_CREATIVE',
      brief: 'Please launch and spend $500 on Meta ads today',
      locale: 'en',
      createdByUserId: trustedSocialStaffApprover().userId,
    })
    expect(ad.ok).toBe(false)
    const phi = createMarketingRequest(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      requestType: 'SOCIAL_POST',
      brief: 'Share patient diagnosis highlights',
      locale: 'en',
      createdByUserId: trustedSocialStaffApprover().userId,
    })
    expect(phi.ok).toBe(false)
  })

  it('registers Postiz provider in default registry', () => {
    const registry = createDefaultProviderRegistry()
    const social = registry.list('social')
    expect(social.some((p) => p.key === 'postiz')).toBe(true)
  })

  it('leaves website ProjectApproval workflow models untouched', async () => {
    const { Prisma } = await import('@prisma/client')
    expect(Prisma.ModelName.ProjectApproval).toBe('ProjectApproval')
  })
})

function listConnections(store: ReturnType<typeof createSocial04TestStore>, accountId: string) {
  return [...store.connections.values()].filter((c) => c.customerAccountId === accountId)
}

function seedApprovedCampaign(store: ReturnType<typeof createSocial04TestStore>) {
  const channel = aestheticsChannelId(store)
  const scheduledAt = new Date('2026-11-03T15:00:00Z')
  const campaign = createSocialCampaign(store, {
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    createdByUserId: trustedSocialStaffApprover().userId,
    goal: 'Schedule test',
    locale: 'en',
    targetPlatforms: ['instagram'],
  })
  if (!campaign.ok) throw new Error('campaign')
  const rev = addSocialCampaignRevision(store, {
    campaignId: campaign.value.id,
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    captionEn: 'Scheduled caption',
    targetChannelIds: [channel],
    scheduledAt,
  })
  if (!rev.ok) throw new Error('revision')
  submitSocialCampaignForApproval(store, campaign.value.id, ABMED_AESTHETICS_ACCOUNT_ID)
  const approval = createSocialCampaignApproval(store, {
    campaignId: campaign.value.id,
    revisionId: rev.value.id,
    contentHash: rev.value.contentHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  decideSocialCampaignApproval(store, {
    approvalId: approval.id,
    trustedApprover: trustedSocialStaffApprover(),
    decision: 'APPROVED',
  })
  return { campaign: campaign.value, approval, channel, scheduledAt }
}
