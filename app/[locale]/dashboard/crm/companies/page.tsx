import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmCompanies } from '@/components/crm/companies'

export const dynamic = 'force-dynamic'

export default async function CrmCompaniesPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmCompanies {...await getCrmPageProps(params)} />
}
