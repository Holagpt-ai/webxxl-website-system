import { getCrmLeadsPageProps } from '@/lib/crm-ui/server'
import { CrmLeadInbox } from '@/components/crm/lead-inbox'

export const dynamic = 'force-dynamic'

export default async function CrmLeadsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmLeadInbox {...await getCrmLeadsPageProps(params)} />
}
