import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { createPostizSocialProvider, createPostizSocialPublisher } from '@/lib/platform/providers/postiz-social'
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
import { computeSocialRevisionContentHash } from '@/lib/platform/social/revision-content'
import { scheduleApprovedSocialCampaign } from '@/lib/platform/social/scheduling-gateway'
import { createSocial04TestStore, trustedSocialStaffApprover } from '@/lib/platform/social/test-fixtures'
import { assertExternalIntegrationInTenantBoundary, resolvePostizTenantBoundaryFromStore } from '@/lib/platform/social/postiz-isolation'

describe('SOCIAL-04A security and integrity corrections', () => {
  beforeEach(() => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'true')
    vi.stubEnv('POSTIZ_API_ENABLED', 'false')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'false')
    vi.stubEnv('MARKETING_STUDIO_DRAFTS_PER_MONTH', '2')
    vi.stubEnv('MARKETING_STUDIO_SCHEDULES_PER_MONTH', '100')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('A/B: cross-tenant Postiz listChannels uses allowlist not global API credentials', async () => {
    const store = createSocial04TestStore()
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    const globalIntegrations = [
      { id: 'postiz_int_aesthetics_ig', name: 'A IG', providerIdentifier: 'instagram' },
      { id: 'postiz_int_physicians_li', name: 'P LI', providerIdentifier: 'linkedin' },
      { id: 'postiz_int_clinical_fb', name: 'C FB', providerIdentifier: 'facebook' },
      { id: 'postiz_int_foreign', name: 'Foreign', providerIdentifier: 'instagram' },
    ]
    const transport: PostizHttpTransport = async () => ({ status: 200, json: { integrations: globalIntegrations } })
    const provider = createPostizSocialProvider({
      getSocialStore: () => store,
      transport,
      secretResolver: () => 'global-key',
      ignoreEnvGates: true,
    })
    const aesthetics = await provider.listChannels!({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorId: 'actor',
      actorType: 'USER',
      requestId: 'req',
      idempotencyKey: 'list',
    })
    expect(aesthetics.ok).toBe(true)
    if (!aesthetics.ok) return
    expect(aesthetics.value).toHaveLength(1)
    expect(aesthetics.value[0]?.providerIdentifier).toBe('instagram')
    expect(aesthetics.value.some((row) => row.name.includes('Foreign'))).toBe(false)
  })

  it('C: invalid external integration rejected for tenant boundary', () => {
    const store = createSocial04TestStore()
    const boundary = resolvePostizTenantBoundaryFromStore(store, ABMED_AESTHETICS_ACCOUNT_ID)
    expect(boundary.ok).toBe(true)
    if (!boundary.ok) return
    const denied = assertExternalIntegrationInTenantBoundary(boundary.value, 'postiz_int_physicians_li')
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('INTEGRATION_NOT_AUTHORIZED')
  })

  it('F: media changes alter canonical revision hash', () => {
    const base = computeSocialRevisionContentHash({
      captionEn: 'Caption',
      mediaRefs: ['media-a'],
      platformPayloads: {},
      targetChannelIds: ['ch1'],
    })
    const changed = computeSocialRevisionContentHash({
      captionEn: 'Caption',
      mediaRefs: ['media-b'],
      platformPayloads: {},
      targetChannelIds: ['ch1'],
    })
    expect(base).not.toBe(changed)
  })

  it('G: foreign-account channel rejected on revision create (domain path)', () => {
    const store = createSocial04TestStore()
    const campaign = createSocialCampaign(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: trustedSocialStaffApprover().userId,
      goal: 'Brand',
      locale: 'en',
      targetPlatforms: ['instagram'],
    })
    expect(campaign.ok).toBe(true)
    if (!campaign.ok) return
    const foreignChannel = [...store.connections.values()].find(
      (c) => c.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID,
    )!.id
    const rev = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'Caption',
      targetChannelIds: [foreignChannel],
    })
    expect(rev.ok).toBe(false)
    if (!rev.ok) expect(rev.code).toBe('CROSS_ACCOUNT_DENIED')
  })

  it('I/J/K/L: scheduling idempotency, gateway publishing gate, unknown non-redispatch', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    let postCount = 0
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'POST' && req.path === '/posts') {
        postCount += 1
        if (postCount === 1) return { status: 504, json: null }
        return { status: 200, json: { posts: [{ id: 'should-not-happen', state: 'QUEUE' }] } }
      }
      return { status: 200, json: { integrations: [] } }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const unknown = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'unknown-key',
      scheduledAt,
    })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.code).toBe('RECONCILIATION_REQUIRED')
    expect(postCount).toBe(1)
    const replay = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'unknown-key',
      scheduledAt,
    })
    expect(replay.ok).toBe(false)
    expect(postCount).toBe(1)

    const conflict = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'unknown-key',
      scheduledAt: new Date(scheduledAt.getTime() + 60_000),
    })
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.code).toBe('IDEMPOTENCY_CONFLICT')

    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'false')
    const { campaign: c2, approval: a2, channel: ch2, scheduledAt: t2 } = seedApprovedCampaign(store)
    const blocked = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: c2.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: ch2,
      approvalId: a2.id,
      idempotencyKey: 'disabled-dispatch',
      scheduledAt: t2,
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('NOT_CONFIGURED')
  })

  it('I: idempotency key reused across accounts never leaks publication', async () => {
    const store = createSocial04TestStore()
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'true')
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'POST') return { status: 200, json: { posts: [{ id: 'post_a', state: 'QUEUE' }] } }
      return { status: 200, json: { integrations: [] } }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const seededA = seedApprovedCampaign(store)
    const first = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: seededA.campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: seededA.channel,
      approvalId: seededA.approval.id,
      idempotencyKey: 'shared-key',
      scheduledAt: seededA.scheduledAt,
    })
    expect(first.ok).toBe(true)
    const seededB = seedApprovedCampaignPhysicians(store)
    const leakAttempt = await scheduleApprovedSocialCampaign(store, publisher, {
      campaignId: seededB.campaign.id,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: seededB.channel,
      approvalId: seededB.approval.id,
      idempotencyKey: 'shared-key',
      scheduledAt: seededB.scheduledAt,
    })
    expect(leakAttempt.ok).toBe(false)
    if (!leakAttempt.ok) expect(leakAttempt.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('H: sequential revision creation allocates monotonic revision numbers', () => {
    const store = createSocial04TestStore()
    const campaign = createSocialCampaign(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: trustedSocialStaffApprover().userId,
      goal: 'Rev',
      locale: 'en',
      targetPlatforms: ['instagram'],
    })
    if (!campaign.ok) throw new Error('campaign')
    const channel = [...store.connections.values()].find((c) => c.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!.id
    const r1 = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'One',
      targetChannelIds: [channel],
    })
    const r2 = addSocialCampaignRevision(store, {
      campaignId: campaign.value.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      captionEn: 'Two',
      targetChannelIds: [channel],
    })
    expect(r1.ok && r2.ok).toBe(true)
    if (r1.ok && r2.ok) {
      expect(r2.value.revisionNumber).toBe(r1.value.revisionNumber + 1)
    }
  })
})

describe('SOCIAL-04A Prisma campaign quota (mocked persistence)', () => {
  beforeEach(() => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'true')
    vi.stubEnv('MARKETING_STUDIO_DRAFTS_PER_MONTH', '1')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('D/E: Prisma-backed campaign creation enforces draft quota and idempotency', async () => {
    const campaigns: { id: string; customerAccountId: string; createIdempotencyKey?: string | null }[] = []
    const usage: { customerAccountId: string; periodKey: string; operation: string; units: number; idempotencyKey?: string | null }[] =
      []
    let idCounter = 0
    const tx = {
      marketingStudioUsage: {
        aggregate: async ({ where }: { where: { customerAccountId: string; periodKey: string; operation: string } }) => ({
          _sum: {
            units: usage
              .filter(
                (row) =>
                  row.customerAccountId === where.customerAccountId &&
                  row.periodKey === where.periodKey &&
                  row.operation === where.operation,
              )
              .reduce((sum, row) => sum + row.units, 0),
          },
        }),
        create: async ({ data }: { data: (typeof usage)[number] }) => {
          usage.push(data)
        },
      },
      socialCampaign: {
        findFirst: async ({ where }: { where: { customerAccountId?: string; createIdempotencyKey?: string } }) =>
          campaigns.find(
            (row) =>
              (!where.customerAccountId || row.customerAccountId === where.customerAccountId) &&
              (!where.createIdempotencyKey || row.createIdempotencyKey === where.createIdempotencyKey),
          ) ?? null,
        create: async ({ data }: { data: { customerAccountId: string; createIdempotencyKey?: string } }) => {
          const row = { id: `camp_${++idCounter}`, ...data }
          campaigns.push(row)
          return row
        },
      },
    }
    vi.doMock('@/lib/db', () => ({
      prisma: {
        marketingStudioUsage: {
          findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
            usage.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
        },
        socialCampaign: {
          findFirst: async ({ where }: { where: { customerAccountId?: string; createIdempotencyKey?: string } }) =>
            campaigns.find(
              (row) =>
                (!where.customerAccountId || row.customerAccountId === where.customerAccountId) &&
                (!where.createIdempotencyKey || row.createIdempotencyKey === where.createIdempotencyKey),
            ) ?? null,
        },
        $transaction: async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
      },
    }))
    const { createSocialCampaignWithQuota: createWithQuota } = await import('@/lib/platform/social/campaign-create-service')
    const first = await createWithQuota({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: 'user',
      goal: 'One',
      locale: 'en',
      targetPlatforms: ['instagram'],
      idempotencyKey: 'idem-1',
    })
    expect(first.ok).toBe(true)
    const replay = await createWithQuota({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: 'user',
      goal: 'One',
      locale: 'en',
      targetPlatforms: ['instagram'],
      idempotencyKey: 'idem-1',
    })
    expect(replay.ok).toBe(true)
    if (first.ok && replay.ok) expect(replay.value.id).toBe(first.value.id)
    expect(usage.filter((row) => row.operation === 'draft')).toHaveLength(1)
    const second = await createWithQuota({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      createdByUserId: 'user',
      goal: 'Two',
      locale: 'en',
      targetPlatforms: ['instagram'],
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('QUOTA_EXCEEDED')
  })
})

function seedApprovedCampaignPhysicians(store: ReturnType<typeof createSocial04TestStore>) {
  const channel = [...store.connections.values()].find((c) => c.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID)!.id
  const scheduledAt = new Date('2026-11-04T15:00:00Z')
  const campaign = createSocialCampaign(store, {
    customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
    createdByUserId: trustedSocialStaffApprover().userId,
    goal: 'Physicians',
    locale: 'en',
    targetPlatforms: ['linkedin'],
  })
  if (!campaign.ok) throw new Error('campaign')
  const rev = addSocialCampaignRevision(store, {
    campaignId: campaign.value.id,
    customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
    captionEn: 'Phys caption',
    targetChannelIds: [channel],
    scheduledAt,
  })
  if (!rev.ok) throw new Error('revision')
  submitSocialCampaignForApproval(store, campaign.value.id, ABMED_PHYSICIANS_ACCOUNT_ID)
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

function seedApprovedCampaign(store: ReturnType<typeof createSocial04TestStore>) {
  const channel = [...store.connections.values()].find((c) => c.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!.id
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
