import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { assertMarketingRequestApprovedForSocialExecution } from '@/lib/platform/marketing/social-execution-gate'
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
import { mapPostizPostStateToReconcileOutcome } from '@/lib/platform/social/publication-reconcile-policy'
import { prepareGuardedSchedulingIntent } from '@/lib/platform/social/prepare-guarded-scheduling'
import { reconcileSocialPublication } from '@/lib/platform/social/scheduling-gateway'
import { createSocial04TestStore, trustedSocialStaffApprover } from '@/lib/platform/social/test-fixtures'
import {
  createMarketingArtifact,
  createMarketingRequest,
} from '@/lib/platform/social/marketing-requests'

function aestheticsChannelId(store: ReturnType<typeof createSocial04TestStore>) {
  return [...store.connections.values()].find((c) => c.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!.id
}

function seedApprovedCampaign(store: ReturnType<typeof createSocial04TestStore>) {
  const campaign = createSocialCampaign(store, {
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    createdByUserId: trustedSocialStaffApprover().userId,
    goal: 'Batch34',
    locale: 'en',
    targetPlatforms: ['instagram'],
  })
  if (!campaign.ok) throw new Error('campaign')
  const channel = aestheticsChannelId(store)
  const scheduledAt = new Date('2026-11-02T15:00:00Z')
  const rev = addSocialCampaignRevision(store, {
    campaignId: campaign.value.id,
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    captionEn: 'Guarded prep',
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
  return { campaign: campaign.value, approval, channel, scheduledAt, revision: rev.value }
}

describe('Batch 34 — Marketing Studio execution gates', () => {
  beforeEach(() => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'true')
    vi.stubEnv('SOCIAL_EXECUTION_GATES_ENABLED', 'true')
    vi.stubEnv('POSTIZ_API_ENABLED', 'false')
    vi.stubEnv('POSTIZ_LIVE_PUBLISHING_ENABLED', 'false')
    vi.stubEnv('MARKETING_STUDIO_SCHEDULES_PER_MONTH', '100')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('denies cross-tenant idempotency replay on guarded prep', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const input = {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'cross-tenant-key',
      scheduledAt,
    }
    const first = prepareGuardedSchedulingIntent(store, input)
    expect(first.ok).toBe(true)
    const second = prepareGuardedSchedulingIntent(store, {
      ...input,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(['NOT_FOUND', 'IDEMPOTENCY_CONFLICT']).toContain(second.code)
  })

  it('rejects stale expired approval on guarded prep', () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const row = store.approvals.get(approval.id)
    if (row) row.expiresAt = new Date(Date.now() - 1000)
    const res = prepareGuardedSchedulingIntent(store, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'stale-approval',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('APPROVAL_EXPIRED')
  })

  it('dedupes duplicate guarded scheduling via idempotency key', () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const payload = {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'dup-guarded',
      scheduledAt,
    }
    const a = prepareGuardedSchedulingIntent(store, payload)
    const b = prepareGuardedSchedulingIntent(store, payload)
    expect(a.ok && b.ok).toBe(true)
    expect(store.schedulingByIdempotency.size).toBe(1)
    if (a.ok && b.ok) {
      expect(a.value.publication.status).toBe('PENDING')
      expect(store.campaigns.get(campaign.id)?.status).toBe('APPROVED')
      expect(a.value.dispatchBlocked.code).toBe('NOT_CONFIGURED')
    }
  })

  it('blocks revoked channel on guarded prep', () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    const conn = store.connections.get(channel)
    if (conn) conn.connectionState = 'REVOKED'
    const res = prepareGuardedSchedulingIntent(store, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'revoked-channel',
      scheduledAt,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('CHANNEL_REVOKED')
  })

  it('requires marketing request approval for social execution gate', () => {
    const store = createSocial04TestStore()
    const req = createMarketingRequest(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      requestType: 'SOCIAL_POST',
      brief: 'Promo post EN',
      locale: 'en',
      createdByUserId: trustedSocialStaffApprover().userId,
    })
    expect(req.ok).toBe(true)
    if (!req.ok) return
    const blocked = assertMarketingRequestApprovedForSocialExecution(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      marketingRequestId: req.value.id,
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.code).toBe('MARKETING_NOT_APPROVED')
    req.value.status = 'APPROVED'
    const art = createMarketingArtifact(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      artifactType: 'SOCIAL_POST',
      payload: { captionEn: 'Hello' },
      provenance: 'test',
    })
    expect(art.ok).toBe(true)
    if (art.ok) req.value.artifactIds.push(art.value.id)
    const ok = assertMarketingRequestApprovedForSocialExecution(store, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      marketingRequestId: req.value.id,
      expectedRevisionHash: art.ok ? art.value.revisionHash : undefined,
    })
    expect(ok.ok).toBe(true)
  })

  it('maps unknown provider reconcile outcomes to reconciliation required', async () => {
    const store = createSocial04TestStore()
    const { campaign, approval, channel, scheduledAt } = seedApprovedCampaign(store)
    vi.stubEnv('POSTIZ_API_ENABLED', 'true')
    const transport: PostizHttpTransport = async (req) => {
      if (req.method === 'GET') {
        return {
          status: 200,
          json: { posts: [{ id: 'post_unknown', state: 'PUBLISHED' }] },
        }
      }
      return { status: 200, json: { posts: [] } }
    }
    const publisher = createPostizSocialPublisher({
      transport,
      secretResolver: () => 'test-key',
      ignoreEnvGates: true,
    })
    const prep = prepareGuardedSchedulingIntent(store, {
      campaignId: campaign.id,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorUserId: trustedSocialStaffApprover().userId,
      channelId: channel,
      approvalId: approval.id,
      idempotencyKey: 'reconcile-unknown',
      scheduledAt,
    })
    expect(prep.ok).toBe(true)
    if (!prep.ok) return
    prep.value.publication.externalPostRef = 'post_unknown'
    prep.value.publication.status = 'SCHEDULED'
    const reconciled = await reconcileSocialPublication(
      store,
      publisher,
      prep.value.publication.id,
      ABMED_AESTHETICS_ACCOUNT_ID,
    )
    expect(reconciled.ok).toBe(false)
    if (!reconciled.ok) expect(reconciled.code).toBe('RECONCILIATION_REQUIRED')
  })

  it('never maps QUEUE to published in reconcile policy', () => {
    const outcome = mapPostizPostStateToReconcileOutcome({ state: 'QUEUE' })
    expect(outcome.kind).toBe('SCHEDULED')
    const publishedWithoutUrl = mapPostizPostStateToReconcileOutcome({ state: 'PUBLISHED' })
    expect(publishedWithoutUrl.kind).toBe('RECONCILIATION_REQUIRED')
  })

  it('schedule HTTP route returns 503 DISPATCH_BLOCKED without implying intent persistence', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/social/campaigns/[id]/schedule/route.ts'),
      'utf8',
    )
    expect(route).toContain("code: 'DISPATCH_BLOCKED'")
    expect(route).toContain('status: 503')
    expect(route).toContain('intentPersisted: false')
    expect(route).toContain('No scheduling intent was persisted')
    expect(route).not.toContain('status: 202')
  })
})
