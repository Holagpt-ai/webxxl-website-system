import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/local-seo-ui/server'
import { SeoLocalMarketView } from '@/components/local-seo/local-market'

export const dynamic = 'force-dynamic'

export default async function SeoLocalMarketPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoLocalMarketView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
