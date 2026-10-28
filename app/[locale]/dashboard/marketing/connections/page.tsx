import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingConnections } from '@/components/marketing-studio/connections'

export const dynamic = 'force-dynamic'

export default async function MarketingConnectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingConnections {...await getMarketingPageProps(params)} />
}
