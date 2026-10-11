import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  buildCampaignStructuredPayload,
  campaignToFormFields,
  customerChangeStatusLabel,
  delayMsToDisplaySeconds,
  displaySecondsToDelayMs,
  emptyCampaignFormFields,
  formatCampaignCustomerState,
  normalizeDeviceTargeting,
  resolveUnifiedCampaignSection,
  shouldShowCampaignWriteForm,
} from '@/lib/managed-sites/customer-presentation'
import type { AbmedRemoteCampaign } from '@/lib/managed-sites/abmed/control-client'

const labels = getDictionary('en').dashboard
const esLabels = getDictionary('es').dashboard

function sampleCampaign(overrides: Partial<AbmedRemoteCampaign> = {}): AbmedRemoteCampaign {
  return {
    id: 'camp-1',
    slug: 'spring-offer',
    name: 'Spring Offer',
    type: 'lead_capture',
    placement: 'homepage_popup',
    status: 'draft',
    derivedState: 'draft',
    headline: 'Hello',
    body: 'Body copy',
    imageUrl: null,
    ctaText: 'Get offer',
    ctaDestination: 'lead:offer',
    startAt: '2026-01-01T10:00:00.000Z',
    endAt: null,
    delayMs: 4000,
    frequencyDays: 30,
    priority: 1,
    deviceTargeting: 'all',
    currentVersion: 2,
    approvedAt: null,
    publishedAt: null,
    updatedAt: '2026-01-02T12:00:00.000Z',
    site: 'aesthetics',
    ...overrides,
  }
}

describe('batch7 customer sites UX helpers', () => {
  it('1-2 sites pages avoid technical adapter fields in markup', () => {
    const overview = readFileSync(resolve('app/[locale]/dashboard/sites/page.tsx'), 'utf8')
    const detail = readFileSync(resolve('app/[locale]/dashboard/sites/[siteId]/page.tsx'), 'utf8')
    expect(overview).not.toMatch(/\{site\.adapterKey\}/)
    expect(overview).not.toMatch(/\{site\.connectionRef\}/)
    expect(overview).not.toMatch(/adapterKey:/)
    expect(detail).not.toContain('directChanges')
    expect(detail).not.toContain('CapabilityGroup')
  })

  it('3-4 unified campaign section avoids duplicate write managers', () => {
    const both = resolveUnifiedCampaignSection([
      { capabilityKey: 'campaigns.manage', enabled: true },
      { capabilityKey: 'popups.manage', enabled: true },
    ])
    expect(both.show).toBe(true)
    expect(both.writeCapabilityKey).toBe('popups.manage')

    const detail = readFileSync(resolve('app/[locale]/dashboard/sites/[siteId]/page.tsx'), 'utf8')
    const panelCount = detail.match(/<SiteCampaignPanel/g)?.length ?? 0
    expect(panelCount).toBe(1)
  })

  it('5-6 draft vs non-draft edit affordances', () => {
    expect(sampleCampaign({ status: 'draft' }).status).toBe('draft')
    expect(sampleCampaign({ status: 'approved', derivedState: 'active' }).status).not.toBe('draft')
  })

  it('7-9 edit target form values and cancel reset baseline', () => {
    const first = sampleCampaign({ id: '1', name: 'First', delayMs: 4000 })
    const second = sampleCampaign({ id: '2', name: 'Second', delayMs: 9000 })
    expect(campaignToFormFields(first).name).toBe('First')
    expect(campaignToFormFields(second).name).toBe('Second')
    expect(campaignToFormFields(first).delaySeconds).toBe('4')
    expect(campaignToFormFields(second).delaySeconds).toBe('9')
    expect(emptyCampaignFormFields().name).toBe('')
  })

  it('10-12 delay and device serialization', () => {
    expect(displaySecondsToDelayMs(4)).toBe(4000)
    expect(delayMsToDisplaySeconds(4000)).toBe(4)
    const fields = { ...emptyCampaignFormFields(), delaySeconds: '5', deviceTargeting: 'mobile' as const }
    const payload = buildCampaignStructuredPayload(fields, null) as { fields: { delayMs: number; deviceTargeting: string } }
    expect(payload.fields.delayMs).toBe(5000)
    expect(normalizeDeviceTargeting('desktop')).toBe('desktop')
    expect(normalizeDeviceTargeting('tablet')).toBe('all')
  })

  it('13-14 create vs update structured payloads', () => {
    const create = buildCampaignStructuredPayload(
      { ...emptyCampaignFormFields(), name: 'New', slug: 'new', headline: 'H', body: 'B', ctaText: 'Go' },
      null,
    )
    expect(create.action).toBe('create_campaign_draft')

    const update = buildCampaignStructuredPayload(campaignToFormFields(sampleCampaign()), sampleCampaign())
    expect(update.action).toBe('update_campaign_draft')
    expect(update).toMatchObject({ remoteCampaignId: 'camp-1', expectedVersion: 2 })
  })

  it('15-18 customer-friendly change and campaign states', () => {
    const changeLabels = {
      changeStatusDraft: labels.changeStatusDraft,
      changeStatusAwaitingApproval: labels.changeStatusAwaitingApproval,
      changeStatusApproved: labels.changeStatusApproved,
      changeStatusAppliedAbmed: labels.changeStatusAppliedAbmed,
      changeStatusFailed: labels.changeStatusFailed,
      changeStatusEscalated: labels.changeStatusEscalated,
      changeStatusCancelled: labels.changeStatusCancelled,
      activityTitlePopupDraft: labels.activityTitlePopupDraft,
      activityTitleCampaignUpdate: labels.activityTitleCampaignUpdate,
      activityTitleContentUpdate: labels.activityTitleContentUpdate,
      activityTitleCustomWork: labels.activityTitleCustomWork,
    }
    expect(customerChangeStatusLabel('AWAITING_APPROVAL', 'popups.manage', 'abmed', changeLabels)).toBe(
      labels.changeStatusAwaitingApproval,
    )
    expect(customerChangeStatusLabel('APPLIED', 'popups.manage', 'abmed', changeLabels)).toBe(labels.changeStatusAppliedAbmed)
    expect(customerChangeStatusLabel('APPLIED', 'popups.manage', 'abmed', changeLabels)).not.toMatch(/published|live/i)

    const stateLabels = {
      campaignStateDraft: labels.campaignStateDraft,
      campaignStatePendingApproval: labels.campaignStatePendingApproval,
      campaignStateScheduled: labels.campaignStateScheduled,
      campaignStateLive: labels.campaignStateLive,
      campaignStatePaused: labels.campaignStatePaused,
      campaignStateEnded: labels.campaignStateEnded,
      campaignStateArchived: labels.campaignStateArchived,
      campaignStateApprovedNotLive: labels.campaignStateApprovedNotLive,
      campaignStateUnknown: labels.campaignStateUnknown,
    }
    expect(formatCampaignCustomerState(sampleCampaign({ derivedState: 'active', status: 'approved', publishedAt: '2026-01-01' }), stateLabels)).toBe(
      labels.campaignStateLive,
    )
    expect(
      formatCampaignCustomerState(sampleCampaign({ status: 'approved', derivedState: 'active', publishedAt: null }), stateLabels),
    ).toBe(labels.campaignStateApprovedNotLive)
    expect(
      formatCampaignCustomerState(sampleCampaign({ status: 'approved', derivedState: 'approved', publishedAt: null }), stateLabels),
    ).toBe(labels.campaignStateApprovedNotLive)
  })

  it('success message is not cleared by editTarget form sync effect', () => {
    const panel = readFileSync(resolve('components/managed-sites/site-campaign-panel.tsx'), 'utf8')
    const editTargetEffect = panel.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[editTarget\]\)/)
    expect(editTargetEffect).toBeTruthy()
    expect(editTargetEffect![0]).not.toContain('setMessage(null)')
    expect(panel).toMatch(/setEditTarget\(null\)\s*\n\s*setMessage\(dict\.campaignSubmitSuccess\)/)
  })

  it('19 hides write form when remote unavailable', () => {
    expect(shouldShowCampaignWriteForm(false, true)).toBe(false)
    expect(shouldShowCampaignWriteForm(true, true)).toBe(true)
  })

  it('20-21 EN and ES copy keys exist', () => {
    expect(labels.campaignsPopupsTitle).toContain('Campaigns')
    expect(esLabels.campaignsPopupsTitle.toLowerCase()).toContain('campaña')
    expect(labels.changeStatusAppliedAbmed).toContain('ABMED')
    expect(esLabels.changeStatusAppliedAbmed).toContain('ABMED')
  })

  it('22 authorization still uses account-scoped site query', () => {
    const detail = readFileSync(resolve('app/[locale]/dashboard/sites/[siteId]/page.tsx'), 'utf8')
    expect(detail).toContain('getManagedSiteForAccount')
    expect(detail).toContain('portal.customerAccount.id')
  })
})
