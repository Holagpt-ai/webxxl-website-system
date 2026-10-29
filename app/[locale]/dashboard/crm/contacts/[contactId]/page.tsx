import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmContactDetail } from '@/components/crm/contact-detail'

export const dynamic = 'force-dynamic'

export default async function CrmContactPage({ params }: { params: Promise<{ locale: string; contactId: string }> }) {
  const { contactId } = await params
  return <CrmContactDetail {...await getCrmPageProps(params)} contactId={contactId} />
}
