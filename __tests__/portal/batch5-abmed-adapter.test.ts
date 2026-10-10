import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abmedCampaignAdapter } from '@/lib/managed-sites/abmed/adapter'
import { parseAbmedCampaignStructuredPayload } from '@/lib/managed-sites/abmed/campaign-payload'
import { resolveAbmedCampaignSiteSlug } from '@/lib/managed-sites/abmed/site-slug'
import { submitManagedSiteCampaignDraft, approveManagedSiteChange } from '@/lib/managed-sites/operations'

const hoisted = vi.hoisted(() => ({
  prisma: {
    managedSiteChange: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: hoisted.prisma }))

const site = {
  id: 'managed-site-abmed-aesthetics',
  name: 'ABMED Aesthetics',
  domain: 'abmedaesthetics.com',
  projectId: 'proj-1',
  customerAccountId: 'acct-1',
  adapterKey: 'abmed',
  connectionType: 'EXTERNAL_ADMIN' as const,
  connectionRef: 'managed-site-abmed-aesthetics',
}

describe('ABMED adapter wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ABMED_CONTROL_API_BASE
    delete process.env.ABMED_CONTROL_API_SECRET
    hoisted.prisma.managedSiteChange.create.mockResolvedValue({ id: 'chg-1', status: 'AWAITING_APPROVAL' })
    hoisted.prisma.managedSiteChange.update.mockResolvedValue({ id: 'chg-1', status: 'APPROVED' })
  })

  it('maps production connectionRef values to ABMED site slugs', () => {
    expect(resolveAbmedCampaignSiteSlug('aesthetics')).toBe('aesthetics')
    expect(resolveAbmedCampaignSiteSlug('physicians')).toBe('physicians')
    expect(resolveAbmedCampaignSiteSlug('managed-site-abmed-aesthetics')).toBe('aesthetics')
    expect(resolveAbmedCampaignSiteSlug('unknown-ref')).toBeNull()
  })

  it('stores structured campaign drafts for approval without calling ABMED when unconfigured', async () => {
    const payload = parseAbmedCampaignStructuredPayload({
      action: 'create_campaign_draft',
      fields: {
        slug: 'october-popup',
        name: 'October popup',
        headline: '20% off',
        body: 'Limited time offer',
        ctaText: 'Book now',
        ctaDestination: 'lead:offer',
      },
    })
    expect(payload).not.toBeNull()
    const saved = await submitManagedSiteCampaignDraft({
      actorUserId: 'cust-1',
      actor: 'customer',
      site,
      assignments: [{ capabilityKey: 'popups.manage', enabled: true, executionMode: null }],
      capabilityKey: 'popups.manage',
      structuredPayload: payload!,
    })
    expect(saved).toMatchObject({ ok: true, status: 'AWAITING_APPROVAL', applied: false })
    expect(hoisted.prisma.managedSiteChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ structuredPayload: payload, status: 'AWAITING_APPROVAL' }),
    })
  })

  it('does not mark a change applied when the remote adapter is unavailable', async () => {
    const status = await abmedCampaignAdapter.connectionStatus(site)
    expect(status.state).toBe('not_connected')
    const applied = await abmedCampaignAdapter.applyChange(site, 'popups.manage', {
      action: 'create_campaign_draft',
      fields: {
        slug: 'popup',
        name: 'Popup',
        headline: 'Headline',
        body: 'Body',
        ctaText: 'CTA',
        ctaDestination: 'lead:offer',
      },
      actorUserId: 'staff-1',
    })
    expect(applied.ok).toBe(false)
    const approved = await approveManagedSiteChange({
      actorUserId: 'staff-1',
      change: {
        id: 'chg-1',
        status: 'AWAITING_APPROVAL',
        capabilityKey: 'popups.manage',
        managedSiteId: site.id,
        structuredPayload: {
          action: 'create_campaign_draft',
          fields: {
            slug: 'popup',
            name: 'Popup',
            headline: 'Headline',
            body: 'Body',
            ctaText: 'CTA',
            ctaDestination: 'lead:offer',
          },
        },
      },
      site,
    })
    expect(approved).toMatchObject({ ok: false, applied: false, status: 'APPROVED' })
  })
})
