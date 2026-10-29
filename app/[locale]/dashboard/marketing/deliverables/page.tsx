import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingDeliverables } from '@/components/marketing-studio/deliverables'

export const dynamic = 'force-dynamic'

export default async function MarketingDeliverablesPage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingDeliverables {...await getMarketingPageProps(params)} />
}
