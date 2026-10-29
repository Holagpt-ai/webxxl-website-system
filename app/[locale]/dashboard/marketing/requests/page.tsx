import { Suspense } from 'react'
import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingRequests } from '@/components/marketing-studio/requests'

export const dynamic = 'force-dynamic'

export default async function MarketingRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <MarketingRequests {...await getMarketingPageProps(params)} />
    </Suspense>
  )
}
