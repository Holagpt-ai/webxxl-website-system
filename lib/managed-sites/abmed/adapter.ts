import type { ManagedSiteAdapter, ManagedSiteContext, AdapterConnectionStatus, AdapterResult } from '@/lib/managed-sites/adapters'
import { parseAbmedCampaignStructuredPayload } from '@/lib/managed-sites/abmed/campaign-payload'
import {
  createAbmedRemoteDraft,
  isAbmedControlConfigured,
  listAbmedRemoteCampaigns,
  requestAbmedRemoteApproval,
  updateAbmedRemoteDraft,
} from '@/lib/managed-sites/abmed/control-client'
import { resolveAbmedCampaignSiteSlug } from '@/lib/managed-sites/abmed/site-slug'

const VIEW_CAPABILITIES = new Set(['campaigns.view', 'popups.view'])
const MANAGE_CAPABILITIES = new Set(['campaigns.manage', 'popups.manage'])

function siteSlug(site: ManagedSiteContext) {
  return resolveAbmedCampaignSiteSlug(site.connectionRef)
}

function actorFromPayload(payload: Record<string, unknown> | null): string {
  const actor = payload?.actorUserId
  return typeof actor === 'string' && actor.trim() ? actor.trim().slice(0, 120) : 'webxxl-system'
}

export const abmedCampaignAdapter: ManagedSiteAdapter = {
  key: 'abmed',
  async connectionStatus(site: ManagedSiteContext): Promise<AdapterConnectionStatus> {
    if (!isAbmedControlConfigured() || !siteSlug(site)) {
      return {
        state: 'not_connected',
        detail: 'ABMED campaign control is not configured for this site.',
      }
    }
    return {
      state: 'connected',
      detail: 'ABMED campaign control is configured. Changes still require WebXXL approval before ABMED review.',
    }
  },
  async listCapabilities() {
    return ['campaigns.view', 'popups.view', 'campaigns.manage', 'popups.manage']
  },
  async readResource(site, capabilityKey) {
    if (!VIEW_CAPABILITIES.has(capabilityKey)) return { ok: false, reason: 'unavailable' }
    const slug = siteSlug(site)
    if (!slug) return { ok: false, reason: 'not_connected' }
    const listed = await listAbmedRemoteCampaigns(slug, 'webxxl-read')
    if (!listed.ok) return { ok: false, reason: listed.code === 'not_connected' ? 'not_connected' : 'unavailable' }
    return { ok: true, metadata: { campaigns: listed.data.campaigns } }
  },
  async validateChange(site, capabilityKey, payload) {
    if (!MANAGE_CAPABILITIES.has(capabilityKey)) return { ok: false, reason: 'unavailable' }
    const parsed = parseAbmedCampaignStructuredPayload(payload)
    if (!parsed || !siteSlug(site)) return { ok: false, reason: 'invalid' }
    return { ok: true }
  },
  async createPreview(site, capabilityKey, payload) {
    const validated = await this.validateChange(site, capabilityKey, payload)
    if (!validated.ok) return validated
    return { ok: true, metadata: { preview: true } }
  },
  async applyChange(site, capabilityKey, payload) {
    if (!MANAGE_CAPABILITIES.has(capabilityKey)) return { ok: false, reason: 'unavailable' }
    const parsed = parseAbmedCampaignStructuredPayload(payload)
    const slug = siteSlug(site)
    if (!parsed || !slug) return { ok: false, reason: 'invalid' }
    const actorUserId = actorFromPayload(payload)

    let campaignId = parsed.remoteCampaignId
    let remoteVersion = parsed.expectedVersion
    let remoteStatus = 'draft'

    if (parsed.action === 'create_campaign_draft') {
      const created = await createAbmedRemoteDraft(slug, actorUserId, parsed.fields)
      if (!created.ok) {
        return { ok: false, reason: created.code === 'version_conflict' ? 'version_conflict' : 'unavailable' }
      }
      campaignId = created.data.campaign.id
      remoteVersion = created.data.campaign.currentVersion
      remoteStatus = created.data.campaign.status
    } else {
      if (!campaignId || remoteVersion == null) return { ok: false, reason: 'invalid' }
      const updated = await updateAbmedRemoteDraft(slug, actorUserId, campaignId, remoteVersion, parsed.fields)
      if (!updated.ok) {
        return { ok: false, reason: updated.code === 'version_conflict' ? 'version_conflict' : 'unavailable' }
      }
      remoteVersion = updated.data.campaign.currentVersion
      remoteStatus = updated.data.campaign.status
      campaignId = updated.data.campaign.id
    }

    const approval = await requestAbmedRemoteApproval(slug, actorUserId, campaignId!)
    if (!approval.ok) {
      return { ok: false, reason: approval.code === 'version_conflict' ? 'version_conflict' : 'unavailable' }
    }

    return {
      ok: true,
      metadata: {
        remoteCampaignId: campaignId,
        remoteVersion: approval.data.campaign.currentVersion ?? remoteVersion,
        remoteStatus: approval.data.campaign.status ?? remoteStatus,
        requestedApproval: true,
      },
    }
  },
}
