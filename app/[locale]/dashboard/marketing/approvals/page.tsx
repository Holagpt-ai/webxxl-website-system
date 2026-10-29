import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingApprovals } from '@/components/marketing-studio/approvals'

export const dynamic = 'force-dynamic'

export default async function MarketingApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingApprovals {...await getMarketingPageProps(params)} />
}
