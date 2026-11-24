import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmCompanyDetail } from '@/components/crm/company-detail'

export const dynamic = 'force-dynamic'

export default async function CrmCompanyPage({ params }: { params: Promise<{ locale: string; companyId: string }> }) {
  const { companyId } = await params
  return <CrmCompanyDetail {...await getCrmPageProps(params)} companyId={companyId} />
}
