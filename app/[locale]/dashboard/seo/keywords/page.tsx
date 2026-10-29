import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/local-seo-ui/server'
import { SeoKeywordsView } from '@/components/local-seo/keywords'

export const dynamic = 'force-dynamic'

export default async function SeoKeywordsPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoKeywordsView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
