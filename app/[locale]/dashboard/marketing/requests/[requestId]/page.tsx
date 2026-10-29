import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingRequestDetail } from '@/components/marketing-studio/request-detail'

export const dynamic = 'force-dynamic'

export default async function MarketingRequestPage({ params }: { params: Promise<{ locale: string; requestId: string }> }) {
  const { requestId } = await params
  return <MarketingRequestDetail {...await getMarketingPageProps(params)} requestId={requestId} />
}
