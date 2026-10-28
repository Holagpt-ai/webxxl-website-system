import { getCrmPageProps } from '@/lib/crm-ui/server'
import { CrmSettings } from '@/components/crm/settings'

export const dynamic = 'force-dynamic'

export default async function CrmSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { copy } = await getCrmPageProps(params)
  return <CrmSettings copy={copy} />
}
