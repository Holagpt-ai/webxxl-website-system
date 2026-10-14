import { SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { loadOwnerReviewRows, summarizeOwnerReview } from '@/lib/owner-approval/decisions'
import { hasOwnerReviewPackage } from '@/lib/owner-approval-checklist'
import { enumLabel } from '@/lib/i18n/labels'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

export async function OwnerReviewAdminSummary({
  projectId,
  locale,
  dashboard,
}: {
  projectId: string
  locale: string
  dashboard: Dictionary['dashboard']
}) {
  if (!hasOwnerReviewPackage(projectId)) return null
  const rows = await loadOwnerReviewRows(projectId)
  if (!rows) return null
  const summary = summarizeOwnerReview(rows)
  const copy = dashboard.ownerReview

  return (
    <SectionCard title={copy.title}>
      <p className="text-sm text-muted-foreground">{copy.intro}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label={`${copy.summaryPending}: ${summary.pending}`} tone="warn" />
        <StatusBadge label={`${copy.summaryApproved}: ${summary.approved}`} tone="success" />
        <StatusBadge label={`${copy.summaryChanges}: ${summary.changes}`} />
      </div>
      <ul className="mt-4 max-h-64 overflow-y-auto text-sm">
        {rows
          .filter((r) => !r.frozenOwnerConfirmed && r.status !== 'PENDING')
          .map((r) => (
            <li key={r.itemKey} className="border-t py-2">
              <span className="font-medium">{locale === 'es' ? r.titleEs : r.titleEn}</span>
              <span className="text-muted-foreground"> — {enumLabel(copy.statuses, r.status)}</span>
              {r.feedback && <p className="text-xs text-muted-foreground">{r.feedback}</p>}
            </li>
          ))}
      </ul>
      {rows.every((r) => r.frozenOwnerConfirmed || r.status === 'PENDING') && (
        <p className="mt-2 text-xs text-muted-foreground">No customer decisions recorded yet.</p>
      )}
    </SectionCard>
  )
}
