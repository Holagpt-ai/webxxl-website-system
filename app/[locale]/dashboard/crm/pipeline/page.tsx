import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmPipelineView } from '@/components/crm/pipeline'

export const dynamic = 'force-dynamic'

export default async function CrmPipelinePage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmPipelineView {...await getCrmPageProps(params)} />
}
