import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingCampaigns } from '@/components/marketing-studio/campaigns'

export const dynamic = 'force-dynamic'

export default async function MarketingCampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingCampaigns {...await getMarketingPageProps(params)} />
}
