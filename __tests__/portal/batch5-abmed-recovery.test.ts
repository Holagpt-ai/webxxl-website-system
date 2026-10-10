import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abmedCampaignAdapter } from '@/lib/managed-sites/abmed/adapter'
import {
  approveManagedSiteChange,
  retryManagedSiteApprovalHandoff,
} from '@/lib/managed-sites/operations'

const remote = vi.hoisted(() => ({
  createAbmedRemoteDraft: vi.fn(),
  updateAbmedRemoteDraft: vi.fn(),
  requestAbmedRemoteApproval: vi.fn(),
  isAbmedControlConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/managed-sites/abmed/control-client', () => remote)
const prisma = vi.hoisted(() => ({
  managedSiteChange: {
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'chg-1', ...data })),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

const site = {
  id: 'site-1',
  name: 'ABMED Aesthetics',
  domain: 'abmedaesthetics.com',
  projectId: 'proj-1',
  customerAccountId: 'acct-1',
  adapterKey: 'abmed',
  connectionType: 'EXTERNAL_ADMIN' as const,
  connectionRef: 'aesthetics',
}

const structuredCreate = {
  action: 'create_campaign_draft',
  fields: {
    slug: 'october-popup',
    name: 'October popup',
    headline: '20% off',
    body: 'Limited time offer',
    ctaText: 'Book now',
    ctaDestination: 'lead:offer',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  remote.isAbmedControlConfigured.mockReturnValue(true)
})

describe('ABMED approval handoff recovery', () => {
  it('stores remote draft metadata when request approval fails after create', async () => {
    remote.createAbmedRemoteDraft.mockResolvedValue({
      ok: true,
      data: { campaign: { id: 'camp-1', currentVersion: 2, status: 'draft' } },
    })
    remote.requestAbmedRemoteApproval.mockResolvedValue({ ok: false, code: 'unavailable', status: 503 })

    const applied = await abmedCampaignAdapter.applyChange(site, 'popups.manage', {
      ...structuredCreate,
      actorUserId: 'staff-1',
    })
    expect(applied.ok).toBe(false)
    expect(applied.metadata).toMatchObject({
      remoteCampaignId: 'camp-1',
      remoteVersion: 2,
      draftApplied: true,
      requestedApproval: false,
      recoveryStage: 'request_approval',
    })

  })

  it('persists recovery metadata on approve when approval handoff fails', async () => {
    remote.createAbmedRemoteDraft.mockResolvedValue({
      ok: true,
      data: { campaign: { id: 'camp-1', currentVersion: 2, status: 'draft' } },
    })
    remote.requestAbmedRemoteApproval.mockResolvedValue({ ok: false, code: 'unavailable', status: 503 })

    const approved = await approveManagedSiteChange({
      actorUserId: 'staff-1',
      change: {
        id: 'chg-1',
        status: 'AWAITING_APPROVAL',
        capabilityKey: 'popups.manage',
        managedSiteId: site.id,
        structuredPayload: structuredCreate,
      },
      site,
    })
    expect(approved).toMatchObject({ ok: false, status: 'APPROVED', applied: false })
    expect(prisma.managedSiteChange.update).toHaveBeenCalledWith({
      where: { id: 'chg-1' },
      data: expect.objectContaining({
        resultMetadata: expect.objectContaining({
          remoteCampaignId: 'camp-1',
          remoteVersion: 2,
          draftApplied: true,
          recoveryStage: 'request_approval',
        }),
      }),
    })
  })

  it('retries only request approval without create or update', async () => {
    remote.requestAbmedRemoteApproval.mockResolvedValue({
      ok: true,
      data: { campaign: { id: 'camp-1', currentVersion: 2, status: 'pending_approval' } },
    })

    const result = await retryManagedSiteApprovalHandoff({
      actorUserId: 'staff-1',
      change: {
        id: 'chg-1',
        status: 'APPROVED',
        managedSiteId: site.id,
        resultMetadata: {
          remoteCampaignId: 'camp-1',
          remoteVersion: 2,
          remoteStatus: 'draft',
          draftApplied: true,
          requestedApproval: false,
          recoveryStage: 'request_approval',
        },
      },
      site,
    })

    expect(result).toMatchObject({ ok: true, applied: true, status: 'APPLIED' })
    expect(remote.createAbmedRemoteDraft).not.toHaveBeenCalled()
    expect(remote.updateAbmedRemoteDraft).not.toHaveBeenCalled()
    expect(remote.requestAbmedRemoteApproval).toHaveBeenCalledWith('aesthetics', 'staff-1', 'camp-1', 2)
  })

  it('preserves recovery metadata when retry approval fails with version conflict', async () => {
    remote.requestAbmedRemoteApproval.mockResolvedValue({ ok: false, code: 'version_conflict', status: 409 })

    const result = await retryManagedSiteApprovalHandoff({
      actorUserId: 'staff-1',
      change: {
        id: 'chg-1',
        status: 'APPROVED',
        managedSiteId: site.id,
        resultMetadata: {
          remoteCampaignId: 'camp-2',
          remoteVersion: 4,
          remoteStatus: 'draft',
          draftApplied: true,
          requestedApproval: false,
          recoveryStage: 'request_approval',
        },
      },
      site,
    })

    expect(result).toMatchObject({ ok: false, error: 'version_conflict', status: 'APPROVED', applied: false })
    expect(remote.createAbmedRemoteDraft).not.toHaveBeenCalled()
    expect(remote.updateAbmedRemoteDraft).not.toHaveBeenCalled()
  })

  it('stores remote version after update when request approval fails', async () => {
    remote.updateAbmedRemoteDraft.mockResolvedValue({
      ok: true,
      data: { campaign: { id: 'camp-9', currentVersion: 5, status: 'draft' } },
    })
    remote.requestAbmedRemoteApproval.mockResolvedValue({ ok: false, code: 'unavailable', status: 503 })

    const applied = await abmedCampaignAdapter.applyChange(site, 'popups.manage', {
      action: 'update_campaign_draft',
      remoteCampaignId: 'camp-9',
      expectedVersion: 4,
      fields: { headline: 'Updated headline' },
      actorUserId: 'staff-1',
    })

    expect(applied.ok).toBe(false)
    expect(applied.metadata).toMatchObject({ remoteCampaignId: 'camp-9', remoteVersion: 5, draftApplied: true })
    expect(remote.updateAbmedRemoteDraft).toHaveBeenCalledTimes(1)
    expect(remote.createAbmedRemoteDraft).not.toHaveBeenCalled()
  })
})
