import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmOverview } from '@/components/crm/overview'

export const dynamic = 'force-dynamic'

export default async function CrmOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmOverview {...await getCrmPageProps(params)} />
}
