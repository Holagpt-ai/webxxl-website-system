'use server'

import { revalidatePath } from 'next/cache'
import { requireProjectAccess } from '@/lib/portal/authz'
import { writeProjectActivity, formatActivitySummary } from '@/lib/portal/activity'
import { getOwnerReviewCatalog } from '@/lib/owner-approval-checklist'
import { upsertOwnerReviewDecision } from '@/lib/owner-approval/decisions'
import { parseOwnerReviewItemStatus } from '@/lib/owner-approval/types'

export type OwnerReviewActionResult = { ok: true } | { ok: false; error: string }

function revalidateOwnerReview(locale?: string) {
  revalidatePath('/dashboard/review')
  revalidatePath('/dashboard/project')
  if (locale === 'es') {
    revalidatePath('/es/dashboard/review')
    revalidatePath('/es/dashboard/project')
  }
}

export async function recordOwnerReviewDecisionAction(
  projectId: string,
  itemKey: string,
  statusRaw: string,
  feedback: string,
  locale: string,
): Promise<OwnerReviewActionResult> {
  const status = parseOwnerReviewItemStatus(statusRaw)
  if (!status) return { ok: false, error: 'invalid_status' }

  try {
    const { portal, project } = await requireProjectAccess(projectId)
    const catalog = getOwnerReviewCatalog(project.id)
    const item = catalog?.find((i) => i.itemKey === itemKey)
    if (!item) return { ok: false, error: 'not_found' }

    const result = await upsertOwnerReviewDecision({
      projectId: project.id,
      itemKey,
      status,
      feedback,
      actorUserId: portal.id,
    })
    if (!result.ok) {
      if (result.error === 'frozen') return { ok: false, error: 'frozen' }
      return { ok: false, error: 'not_found' }
    }

    await writeProjectActivity({
      projectId: project.id,
      actorUserId: portal.id,
      eventType: 'OWNER_REVIEW_ITEM_UPDATED',
      summary: formatActivitySummary('OWNER_REVIEW_ITEM_UPDATED', `${itemKey}:${status}`),
      metadata: { itemKey, status, category: item.category },
    })

    revalidateOwnerReview(locale)
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
