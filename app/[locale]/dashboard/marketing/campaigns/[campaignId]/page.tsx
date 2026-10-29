import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingCampaignDetail } from '@/components/marketing-studio/campaign-detail'

export const dynamic = 'force-dynamic'

export default async function MarketingCampaignPage({
  params,
}: {
  params: Promise<{ locale: string; campaignId: string }>
}) {
  const { campaignId } = await params
  return <MarketingCampaignDetail {...await getMarketingPageProps(params)} campaignId={campaignId} />
}
