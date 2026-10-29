import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmContacts } from '@/components/crm/contacts'

export const dynamic = 'force-dynamic'

export default async function CrmContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmContacts {...await getCrmPageProps(params)} />
}
