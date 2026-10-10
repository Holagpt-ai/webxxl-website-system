import { getManagedSiteAdapter } from '@/lib/managed-sites/adapters'
import type { AbmedRemoteCampaign } from '@/lib/managed-sites/abmed/control-client'
import type { ManagedSiteContext } from '@/lib/managed-sites/adapters'

export async function listAbmedCampaignSummariesForSite(
  site: ManagedSiteContext,
): Promise<{ ok: true; campaigns: AbmedRemoteCampaign[] } | { ok: false; campaigns: [] }> {
  const adapter = getManagedSiteAdapter(site.adapterKey)
  const result = await adapter.readResource(site, 'campaigns.view')
  if (!result.ok) return { ok: false, campaigns: [] }
  const campaigns = result.metadata?.campaigns
  return { ok: true, campaigns: Array.isArray(campaigns) ? (campaigns as AbmedRemoteCampaign[]) : [] }
}
