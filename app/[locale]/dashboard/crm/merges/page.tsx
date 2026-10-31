import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmMergeReview } from '@/components/crm/merge-review'

export const dynamic = 'force-dynamic'

export default async function CrmMergesPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmMergeReview {...await getCrmPageProps(params)} />
}
