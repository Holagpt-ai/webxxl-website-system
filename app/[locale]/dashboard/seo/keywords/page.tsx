import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/seo-workspace-ui/server'
import { SeoKeywordsView } from '@/components/seo-workspace/keywords'

export const dynamic = 'force-dynamic'

export default async function SeoKeywordsPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoKeywordsView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
