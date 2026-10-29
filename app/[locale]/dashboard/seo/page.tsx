import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/local-seo-ui/server'
import { SeoOverviewView } from '@/components/local-seo/overview'

export const dynamic = 'force-dynamic'

export default async function SeoOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoOverviewView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
