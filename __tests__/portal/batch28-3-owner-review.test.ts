import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  ABMED_CLINICAL_RESEARCH_REVIEW_PROJECT_ID,
  abmedOwnerReviewCatalog,
  getOwnerReviewCatalog,
} from '@/lib/owner-approval-checklist'
import { parseOwnerReviewItemStatus } from '@/lib/owner-approval/types'

const hoisted = vi.hoisted(() => ({
  upsert: vi.fn(async () => ({})),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    projectOwnerReviewDecision: {
      findMany: vi.fn(async () => []),
      upsert: hoisted.upsert,
    },
  },
}))

import { upsertOwnerReviewDecision } from '@/lib/owner-approval/decisions'

describe('batch 28.3 owner review', () => {
  beforeEach(() => {
    hoisted.upsert.mockClear()
  })

  it('exposes ABMED catalog only for the clinical research project', () => {
    expect(getOwnerReviewCatalog(ABMED_CLINICAL_RESEARCH_REVIEW_PROJECT_ID)?.length).toBe(abmedOwnerReviewCatalog.length)
    expect(getOwnerReviewCatalog('other-project')).toBeNull()
    expect(abmedOwnerReviewCatalog.some((i) => i.itemKey === 'abmed-media-vimeo-facility-tour')).toBe(true)
    expect(abmedOwnerReviewCatalog.some((i) => i.frozenOwnerConfirmed)).toBe(true)
  })

  it('parses review statuses', () => {
    expect(parseOwnerReviewItemStatus('APPROVED')).toBe('APPROVED')
    expect(parseOwnerReviewItemStatus('bogus')).toBeNull()
  })

  it('blocks mutations on frozen owner-confirmed items', async () => {
    const result = await upsertOwnerReviewDecision({
      projectId: ABMED_CLINICAL_RESEARCH_REVIEW_PROJECT_ID,
      itemKey: 'abmed-content-recruiting-compensation',
      status: 'CHANGES_REQUESTED',
      actorUserId: 'user-1',
    })
    expect(result).toEqual({ ok: false, error: 'frozen' })
    expect(hoisted.upsert).not.toHaveBeenCalled()
  })

  it('persists decisions for open media items', async () => {
    const result = await upsertOwnerReviewDecision({
      projectId: ABMED_CLINICAL_RESEARCH_REVIEW_PROJECT_ID,
      itemKey: 'abmed-media-team',
      status: 'APPROVED',
      feedback: 'We own this photo.',
      actorUserId: 'user-1',
    })
    expect(result).toEqual({ ok: true })
    expect(hoisted.upsert).toHaveBeenCalled()
  })
})
