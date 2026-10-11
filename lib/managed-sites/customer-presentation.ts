import type { AbmedRemoteCampaign } from '@/lib/managed-sites/abmed/control-client'
import type { EffectiveCapability } from '@/lib/managed-sites/capabilities'
import { getCapabilityDefinition } from '@/lib/managed-sites/capabilities'

export const CAMPAIGN_CAPABILITY_KEYS = [
  'campaigns.view',
  'campaigns.manage',
  'popups.view',
  'popups.manage',
] as const

export type CampaignCapabilityKey = (typeof CAMPAIGN_CAPABILITY_KEYS)[number]

export const DEVICE_TARGET_VALUES = ['all', 'desktop', 'mobile'] as const
export type DeviceTargetValue = (typeof DEVICE_TARGET_VALUES)[number]

export type CampaignFormFields = {
  name: string
  slug: string
  headline: string
  body: string
  ctaText: string
  ctaDestination: string
  startAt: string
  endAt: string
  delaySeconds: string
  frequencyDays: string
  deviceTargeting: DeviceTargetValue
}

export type CampaignPresentationLabels = {
  campaignStateDraft: string
  campaignStatePendingApproval: string
  campaignStateScheduled: string
  campaignStateLive: string
  campaignStatePaused: string
  campaignStateEnded: string
  campaignStateArchived: string
  campaignStateApprovedNotLive: string
  campaignStateUnknown: string
}

export type ChangePresentationLabels = {
  changeStatusDraft: string
  changeStatusAwaitingApproval: string
  changeStatusApproved: string
  changeStatusAppliedAbmed: string
  changeStatusFailed: string
  changeStatusEscalated: string
  changeStatusCancelled: string
  activityTitlePopupDraft: string
  activityTitleCampaignUpdate: string
  activityTitleContentUpdate: string
  activityTitleCustomWork: string
}

export function isCampaignCapabilityKey(key: string): boolean {
  return (CAMPAIGN_CAPABILITY_KEYS as readonly string[]).includes(key)
}

export function resolveUnifiedCampaignSection(capabilities: { capabilityKey: string; enabled: boolean }[]): {
  show: boolean
  writeCapabilityKey: 'popups.manage' | 'campaigns.manage' | null
} {
  const enabled = new Set(
    capabilities.filter((item) => item.enabled).map((item) => item.capabilityKey),
  )
  const show = CAMPAIGN_CAPABILITY_KEYS.some((key) => enabled.has(key))
  let writeCapabilityKey: 'popups.manage' | 'campaigns.manage' | null = null
  if (enabled.has('popups.manage')) writeCapabilityKey = 'popups.manage'
  else if (enabled.has('campaigns.manage')) writeCapabilityKey = 'campaigns.manage'
  return { show, writeCapabilityKey }
}

export function filterWebsiteChangeCapabilities(capabilities: EffectiveCapability[]): EffectiveCapability[] {
  return capabilities.filter((item) => !isCampaignCapabilityKey(item.key))
}

export function formatCampaignCustomerState(
  campaign: Pick<AbmedRemoteCampaign, 'status' | 'derivedState' | 'publishedAt' | 'approvedAt'>,
  labels: CampaignPresentationLabels,
): string {
  const status = campaign.status.toLowerCase()
  const derived = campaign.derivedState.toLowerCase()

  if (status === 'draft') return labels.campaignStateDraft
  if (status === 'pending_approval') return labels.campaignStatePendingApproval
  if (status === 'paused') return labels.campaignStatePaused
  if (status === 'archived') return labels.campaignStateArchived
  if (derived === 'expired') return labels.campaignStateEnded
  if (status === 'approved' && !campaign.publishedAt) return labels.campaignStateApprovedNotLive
  if (derived === 'scheduled') return labels.campaignStateScheduled
  if (derived === 'active' && campaign.publishedAt) return labels.campaignStateLive
  return labels.campaignStateUnknown
}

export function delayMsToDisplaySeconds(delayMs: number): number {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return 0
  return Math.round(delayMs / 1000)
}

export function displaySecondsToDelayMs(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  return Math.round(seconds * 1000)
}

export function normalizeDeviceTargeting(value: string): DeviceTargetValue {
  if (value === 'desktop' || value === 'mobile') return value
  return 'all'
}

export function emptyCampaignFormFields(): CampaignFormFields {
  return {
    name: '',
    slug: '',
    headline: '',
    body: '',
    ctaText: '',
    ctaDestination: 'lead:offer',
    startAt: '',
    endAt: '',
    delaySeconds: '4',
    frequencyDays: '30',
    deviceTargeting: 'all',
  }
}

export function campaignToFormFields(campaign: AbmedRemoteCampaign): CampaignFormFields {
  return {
    name: campaign.name,
    slug: campaign.slug,
    headline: campaign.headline,
    body: campaign.body,
    ctaText: campaign.ctaText,
    ctaDestination: campaign.ctaDestination || 'lead:offer',
    startAt: campaign.startAt?.slice(0, 16) ?? '',
    endAt: campaign.endAt?.slice(0, 16) ?? '',
    delaySeconds: String(delayMsToDisplaySeconds(campaign.delayMs)),
    frequencyDays: String(campaign.frequencyDays ?? 30),
    deviceTargeting: normalizeDeviceTargeting(campaign.deviceTargeting),
  }
}

export function buildCampaignStructuredPayload(
  fields: CampaignFormFields,
  editTarget: AbmedRemoteCampaign | null,
): Record<string, unknown> {
  const payloadFields = {
    name: fields.name.trim(),
    slug: fields.slug.trim(),
    type: 'lead_capture',
    placement: 'homepage_popup',
    headline: fields.headline.trim(),
    body: fields.body.trim(),
    ctaText: fields.ctaText.trim(),
    ctaDestination: fields.ctaDestination.trim() || 'lead:offer',
    startAt: fields.startAt.trim() || null,
    endAt: fields.endAt.trim() || null,
    delayMs: displaySecondsToDelayMs(Number(fields.delaySeconds)),
    frequencyDays: Number(fields.frequencyDays),
    deviceTargeting: normalizeDeviceTargeting(fields.deviceTargeting),
  }

  if (editTarget) {
    return {
      action: 'update_campaign_draft',
      remoteCampaignId: editTarget.id,
      expectedVersion: editTarget.currentVersion,
      fields: payloadFields,
    }
  }

  return {
    action: 'create_campaign_draft',
    fields: payloadFields,
  }
}

export function customerActivityTitle(capabilityKey: string, labels: ChangePresentationLabels, locale: 'en' | 'es'): string {
  if (capabilityKey === 'popups.manage') return labels.activityTitlePopupDraft
  if (capabilityKey === 'campaigns.manage') return labels.activityTitleCampaignUpdate
  if (capabilityKey === 'content.edit') return labels.activityTitleContentUpdate
  if (capabilityKey === 'site.custom_work') return labels.activityTitleCustomWork
  const definition = getCapabilityDefinition(capabilityKey)
  if (definition) return definition.label[locale]
  return capabilityKey
}

export function customerChangeStatusLabel(
  status: string,
  capabilityKey: string,
  adapterKey: string,
  labels: ChangePresentationLabels,
): string {
  switch (status) {
    case 'DRAFT':
      return labels.changeStatusDraft
    case 'AWAITING_APPROVAL':
      return labels.changeStatusAwaitingApproval
    case 'APPROVED':
      return labels.changeStatusApproved
    case 'APPLIED':
      if (adapterKey === 'abmed' && isCampaignCapabilityKey(capabilityKey)) {
        return labels.changeStatusAppliedAbmed
      }
      return labels.changeStatusApproved
    case 'FAILED':
      return labels.changeStatusFailed
    case 'ESCALATED':
      return labels.changeStatusEscalated
    case 'CANCELLED':
      return labels.changeStatusCancelled
    default:
      return status
  }
}

export function shouldShowCampaignWriteForm(connected: boolean, canWrite: boolean): boolean {
  return connected && canWrite
}

export function connectionStateCustomerLabel(
  state: string,
  labels: { connected: string; manual: string; unavailable: string },
): string {
  if (state === 'connected') return labels.connected
  if (state === 'manual') return labels.manual
  return labels.unavailable
}
