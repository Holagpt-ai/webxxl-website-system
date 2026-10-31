import { getCrmLeadsPageProps } from '@/lib/crm-ui/server'
import { CrmLeadFunnelDashboard } from '@/components/crm/lead-funnel-dashboard'
import { crmLeadFunnelEn } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'
import { crmLeadFunnelEs } from '@/lib/i18n/dictionaries/crm-lead-funnel-es'

export const dynamic = 'force-dynamic'

export default async function CrmLeadFunnelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { accountId, locale, base, sites } = await getCrmLeadsPageProps(params)
  return (
    <CrmLeadFunnelDashboard
      accountId={accountId}
      locale={locale}
      base={base}
      sites={sites}
      fc={locale === 'es' ? crmLeadFunnelEs : crmLeadFunnelEn}
    />
  )
}
