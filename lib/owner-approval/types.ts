export type OwnerReviewItemCategory = 'MEDIA' | 'CONTENT' | 'PRIVACY'

export type OwnerReviewItemStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'NOT_APPLICABLE'

export type OwnerReviewCatalogItem = {
  itemKey: string
  category: OwnerReviewItemCategory
  dependencyId?: string
  titleEn: string
  titleEs: string
  descriptionEn: string
  descriptionEs: string
  assetPath?: string | null
  previewUrl?: string | null
  pagesEn?: string
  pagesEs?: string
  presentation?: string
  rightsEvidence?: string | null
  recommendedAction?: string
  /** Owner already confirmed — show read-only, no customer status mutation. */
  frozenOwnerConfirmed?: boolean
}

export const OWNER_REVIEW_STATUSES: OwnerReviewItemStatus[] = [
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'NOT_APPLICABLE',
]

export function parseOwnerReviewItemStatus(value: unknown): OwnerReviewItemStatus | null {
  if (typeof value !== 'string') return null
  return OWNER_REVIEW_STATUSES.includes(value as OwnerReviewItemStatus) ? (value as OwnerReviewItemStatus) : null
}
