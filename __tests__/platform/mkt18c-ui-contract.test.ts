import { describe, expect, it } from 'vitest'
import {
  ARTIFACT_REVIEW_STATUSES,
  ARTIFACT_TYPES,
  MKT_API,
  MKT_PAGE_SIZE,
  REVIEW_INBOX_STATUSES,
} from '@/lib/marketing-studio-ui/types'

describe('MKT-18C UI/API contract alignment', () => {
  it('artifact list endpoint and page size match Batch 18A defaults', () => {
    expect(MKT_API.artifacts).toBe('/api/v1/marketing/artifacts')
    expect(MKT_API.reviews).toBe('/api/v1/marketing/reviews')
    expect(MKT_PAGE_SIZE).toBe(50)
  })

  it('filter enums match backend artifact list validation', () => {
    expect(ARTIFACT_TYPES).toEqual([
      'SOCIAL_CAMPAIGN',
      'SOCIAL_POST',
      'LANDING_PAGE',
      'AD_CREATIVE',
      'SEO_FIX',
      'CAMPAIGN_PLAN',
    ])
    expect(ARTIFACT_REVIEW_STATUSES).toContain('SUBMITTED')
    expect(REVIEW_INBOX_STATUSES).toEqual(['SUBMITTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED'])
  })
})
