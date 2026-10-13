export const WEBSITE_PREVIEW_PROVIDERS = ['VERCEL', 'NETLIFY', 'CLOUDFLARE_PAGES', 'OTHER'] as const
export type WebsitePreviewProviderId = (typeof WEBSITE_PREVIEW_PROVIDERS)[number]

export const STAFF_PREVIEW_STATUSES = ['DEVELOPMENT', 'READY_FOR_REVIEW'] as const
export type StaffPreviewStatus = (typeof STAFF_PREVIEW_STATUSES)[number]

export function isWebsitePreviewProvider(value: string): value is WebsitePreviewProviderId {
  return (WEBSITE_PREVIEW_PROVIDERS as readonly string[]).includes(value)
}

export function isStaffPreviewStatus(value: string): value is StaffPreviewStatus {
  return (STAFF_PREVIEW_STATUSES as readonly string[]).includes(value)
}
