export const ABMED_CONNECTION_REF_TO_SITE = {
  'managed-site-abmed-aesthetics': 'aesthetics',
  'managed-site-abmed-physicians': 'physicians',
  aesthetics: 'aesthetics',
  physicians: 'physicians',
} as const

export type AbmedCampaignSiteSlug = (typeof ABMED_CONNECTION_REF_TO_SITE)[keyof typeof ABMED_CONNECTION_REF_TO_SITE]

export function resolveAbmedCampaignSiteSlug(connectionRef: string | null): AbmedCampaignSiteSlug | null {
  if (!connectionRef) return null
  const key = connectionRef.trim() as keyof typeof ABMED_CONNECTION_REF_TO_SITE
  return ABMED_CONNECTION_REF_TO_SITE[key] ?? null
}
