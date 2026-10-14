import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { OwnerReviewItemForm } from '@/components/dashboard/owner-review-item-form'
import { loadOwnerReviewRows, summarizeOwnerReview } from '@/lib/owner-approval/decisions'
import type { OwnerReviewItemCategory } from '@/lib/owner-approval/types'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { enumLabel } from '@/lib/i18n/labels'

const CATEGORY_ORDER: OwnerReviewItemCategory[] = ['MEDIA', 'CONTENT', 'PRIVACY']

export async function OwnerReviewPanel({
  projectId,
  locale,
  localePrefix,
  copy,
}: {
  projectId: string
  locale: string
  localePrefix: string
  copy: Dictionary['dashboard']['ownerReview']
}) {
  const rows = await loadOwnerReviewRows(projectId)
  if (!rows) return null

  const summary = summarizeOwnerReview(rows)

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={copy.title}>
        <p className="text-sm text-muted-foreground">{copy.intro}</p>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm">
          <li>
            <StatusBadge label={`${copy.summaryPending}: ${summary.pending}`} tone="warn" />
          </li>
          <li>
            <StatusBadge label={`${copy.summaryApproved}: ${summary.approved}`} tone="success" />
          </li>
          <li>
            <StatusBadge label={`${copy.summaryChanges}: ${summary.changes}`} tone="default" />
          </li>
          <li>
            <StatusBadge label={`${copy.summaryNa}: ${summary.notApplicable}`} />
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`${localePrefix}/dashboard/messages`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {copy.goMessages}
          </Link>
          <Link href={`${localePrefix}/dashboard/files`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {copy.goFiles}
          </Link>
          <Link href={`${localePrefix}/dashboard/approvals`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {copy.goApprovals}
          </Link>
          <Link href={`${localePrefix}/dashboard/project`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {copy.goPreview}
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{copy.integrityNote}</p>
      </SectionCard>

      {CATEGORY_ORDER.map((category) => {
        const items = rows.filter((r) => r.category === category)
        if (items.length === 0) return null
        return (
          <SectionCard key={category} title={enumLabel(copy.categories, category)}>
            <ul className="flex flex-col gap-4">
              {items.map((item) => {
                const title = locale === 'es' ? item.titleEs : item.titleEn
                const description = locale === 'es' ? item.descriptionEs : item.descriptionEn
                const pages = locale === 'es' ? item.pagesEs : item.pagesEn
                return (
                  <li key={item.itemKey} className="rounded-lg border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{title}</p>
                      <StatusBadge
                        label={
                          item.frozenOwnerConfirmed
                            ? copy.ownerConfirmed
                            : enumLabel(copy.statuses, item.status)
                        }
                        tone={item.status === 'APPROVED' ? 'success' : item.status === 'CHANGES_REQUESTED' ? 'warn' : 'default'}
                      />
                    </div>
                    <p className="mt-2 text-muted-foreground">{description}</p>
                    {pages && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.pages}: {pages}
                      </p>
                    )}
                    {item.presentation && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.presentation}: {item.presentation}
                      </p>
                    )}
                    {item.recommendedAction && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.recommended}: {item.recommendedAction}
                      </p>
                    )}
                    {item.previewUrl && (
                      <p className="mt-2">
                        <a
                          href={item.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs font-medium hover:underline"
                        >
                          {copy.openSource}
                        </a>
                      </p>
                    )}
                    <OwnerReviewItemForm
                      projectId={projectId}
                      itemKey={item.itemKey}
                      initialStatus={item.status}
                      initialFeedback={item.feedback}
                      frozen={item.frozenOwnerConfirmed}
                      locale={locale}
                      copy={{
                        statusLabel: copy.statusLabel,
                        feedbackLabel: copy.feedbackLabel,
                        feedbackPlaceholder: copy.feedbackPlaceholder,
                        save: copy.save,
                        saved: copy.saved,
                        ownerConfirmed: copy.ownerConfirmed,
                        errors: copy.errors,
                        statuses: copy.statuses,
                      }}
                    />
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        )
      })}
    </div>
  )
}
