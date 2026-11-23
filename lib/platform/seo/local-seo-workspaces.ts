export const LOCAL_SEO_WORKSPACES = {
  overview: '/dashboard/seo',
  keywords: '/dashboard/seo/keywords',
  opportunities: '/dashboard/seo/opportunities',
  pages: '/dashboard/seo/pages',
  localMarket: '/dashboard/seo/local-market',
  connections: '/dashboard/seo/connections',
} as const

export function localSeoSiteApiPath(managedSiteId: string, suffix: string): string {
  return `/api/v1/seo/sites/${encodeURIComponent(managedSiteId)}/${suffix}`
}