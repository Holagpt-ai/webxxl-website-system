import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingOverview } from '@/components/marketing-studio/overview'

export const dynamic = 'force-dynamic'

export default async function MarketingOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingOverview {...await getMarketingPageProps(params)} />
}
