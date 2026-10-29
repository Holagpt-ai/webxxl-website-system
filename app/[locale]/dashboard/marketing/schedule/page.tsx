import { getMarketingPageProps } from '@/lib/marketing-studio-ui/server'
import { MarketingSchedule } from '@/components/marketing-studio/schedule'

export const dynamic = 'force-dynamic'

export default async function MarketingSchedulePage({ params }: { params: Promise<{ locale: string }> }) {
  return <MarketingSchedule {...await getMarketingPageProps(params)} />
}
