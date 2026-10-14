import { prisma } from '@/lib/db'
import { getOwnerReviewCatalog } from '@/lib/owner-approval-checklist'
import type { OwnerReviewCatalogItem, OwnerReviewItemStatus } from '@/lib/owner-approval/types'

export type OwnerReviewRow = OwnerReviewCatalogItem & {
  status: OwnerReviewItemStatus
  feedback: string | null
  decidedAt: Date | null
}

export async function loadOwnerReviewRows(projectId: string): Promise<OwnerReviewRow[] | null> {
  const catalog = getOwnerReviewCatalog(projectId)
  if (!catalog) return null

  const decisions = await prisma.projectOwnerReviewDecision.findMany({
    where: { projectId },
  })
  const byKey = new Map(decisions.map((d) => [d.itemKey, d]))

  return catalog.map((item) => {
    const stored = byKey.get(item.itemKey)
    const status: OwnerReviewItemStatus = item.frozenOwnerConfirmed
      ? 'APPROVED'
      : (stored?.status as OwnerReviewItemStatus) ?? 'PENDING'
    return {
      ...item,
      status,
      feedback: stored?.feedback ?? null,
      decidedAt: stored?.decidedAt ?? null,
    }
  })
}

export function summarizeOwnerReview(rows: OwnerReviewRow[]) {
  const actionable = rows.filter((r) => !r.frozenOwnerConfirmed)
  const pending = actionable.filter((r) => r.status === 'PENDING').length
  const approved = actionable.filter((r) => r.status === 'APPROVED').length
  const changes = actionable.filter((r) => r.status === 'CHANGES_REQUESTED').length
  const na = rows.filter((r) => r.status === 'NOT_APPLICABLE').length
  return { pending, approved, changes, notApplicable: na, total: rows.length }
}

export async function upsertOwnerReviewDecision(input: {
  projectId: string
  itemKey: string
  status: OwnerReviewItemStatus
  feedback?: string
  actorUserId: string
}): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'frozen' | 'invalid_item' }> {
  const catalog = getOwnerReviewCatalog(input.projectId)
  const item = catalog?.find((i) => i.itemKey === input.itemKey)
  if (!item) return { ok: false, error: 'invalid_item' }
  if (item.frozenOwnerConfirmed) return { ok: false, error: 'frozen' }

  const feedback = input.feedback?.trim() || null
  const decidedAt = input.status === 'PENDING' ? null : new Date()

  await prisma.projectOwnerReviewDecision.upsert({
    where: { projectId_itemKey: { projectId: input.projectId, itemKey: input.itemKey } },
    create: {
      projectId: input.projectId,
      itemKey: input.itemKey,
      status: input.status,
      feedback,
      decidedByUserId: input.actorUserId,
      decidedAt,
    },
    update: {
      status: input.status,
      feedback,
      decidedByUserId: input.actorUserId,
      decidedAt,
    },
  })

  return { ok: true }
}
