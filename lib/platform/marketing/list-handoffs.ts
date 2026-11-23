import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'

export type MarketingNavigationDestination = { path: string }

export const MARKETING_STUDIO_WORKSPACES = {
  requests: '/dashboard/marketing/requests',
  deliverables: '/dashboard/marketing/deliverables',
  approvals: '/dashboard/marketing/approvals',
} as const

export function marketingArtifactListDestination(artifactId: string): MarketingNavigationDestination {
  return { path: BUSINESS_DESTINATIONS.marketingDeliverable(artifactId) }
}

export function marketingReviewListDestination(
  reviewId: string,
  marketingArtifactId: string,
): MarketingNavigationDestination {
  return { path: BUSINESS_DESTINATIONS.marketingDeliverableReview(marketingArtifactId, reviewId) }
}