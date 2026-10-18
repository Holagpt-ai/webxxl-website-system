import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { SocialCampaignRecord, SocialCampaignRevisionRecord } from '@/lib/platform/social/types'

export type CalendarEntry = {
  campaignId: string
  revisionId?: string
  date: string
  status: string
  locale: 'en' | 'es'
  platforms: string[]
  theme?: string
}

export function buildAccountMarketingCalendar(
  store: SocialStore,
  customerAccountId: string,
  from: Date,
  to: Date,
): CalendarEntry[] {
  const entries: CalendarEntry[] = []
  for (const campaign of store.campaigns.values()) {
    if (campaign.customerAccountId !== customerAccountId) continue
    const revision = campaign.activeRevisionId ? store.revisions.get(campaign.activeRevisionId) : undefined
    const date = revision?.scheduledAt ?? campaign.startDate
    if (!date || date < from || date > to) continue
    entries.push({
      campaignId: campaign.id,
      revisionId: revision?.id,
      date: date.toISOString().slice(0, 10),
      status: campaign.status,
      locale: campaign.locale,
      platforms: campaign.targetPlatforms,
      theme: campaign.goal,
    })
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

export function summarizeCampaignPlan(
  campaigns: SocialCampaignRecord[],
  revisions: Map<string, SocialCampaignRevisionRecord>,
): { total: number; awaitingApproval: number; scheduled: number } {
  return {
    total: campaigns.length,
    awaitingApproval: campaigns.filter((c) => c.status === 'AWAITING_APPROVAL').length,
    scheduled: campaigns.filter((c) => c.status === 'SCHEDULED' || c.status === 'PUBLISHING').length,
  }
}
