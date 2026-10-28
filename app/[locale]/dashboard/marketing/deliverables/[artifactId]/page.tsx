import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingDeliverableDetail } from '@/components/marketing-studio/deliverable-detail'

export const dynamic = 'force-dynamic'

export default async function MarketingDeliverablePage({
  params,
}: {
  params: Promise<{ locale: string; artifactId: string }>
}) {
  const { artifactId } = await params
  return <MarketingDeliverableDetail {...await getMarketingPageProps(params)} artifactId={artifactId} />
}
