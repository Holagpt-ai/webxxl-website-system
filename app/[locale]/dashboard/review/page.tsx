import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership, getActiveProject } from '@/lib/portal/authz'
import { PageTitle, EmptyState } from '@/components/dashboard/primitives'
import { OwnerReviewPanel } from '@/components/dashboard/owner-review-panel'
import { hasOwnerReviewPackage } from '@/lib/owner-approval-checklist'

export const dynamic = 'force-dynamic'

export default async function OwnerReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const project = await getActiveProject(portal.customerAccount.id)
  const d = dict.dashboard
  const prefix = locale === 'es' ? '/es' : ''

  if (!project || !hasOwnerReviewPackage(project.id)) {
    return (
      <>
        <PageTitle title={d.ownerReview.title} />
        <EmptyState title={d.ownerReview.emptyTitle} body={d.ownerReview.emptyBody} />
      </>
    )
  }

  return (
    <>
      <PageTitle title={d.ownerReview.title} description={d.ownerReview.pageDescription} />
      <OwnerReviewPanel projectId={project.id} locale={locale} localePrefix={prefix} copy={d.ownerReview} />
    </>
  )
}
