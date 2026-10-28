import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmSegments } from '@/components/crm/segments'

export const dynamic = 'force-dynamic'

export default async function CrmSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmSegments {...await getCrmPageProps(params)} />
}
