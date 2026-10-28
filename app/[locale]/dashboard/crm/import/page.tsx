import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmImportExport } from '@/components/crm/import-export'

export const dynamic = 'force-dynamic'

export default async function CrmImportExportPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CrmImportExport {...await getCrmPageProps(params)} />
}
