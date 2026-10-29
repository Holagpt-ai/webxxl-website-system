import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/local-seo-ui/server'
import { SeoOpportunitiesView } from '@/components/local-seo/opportunities'

export const dynamic = 'force-dynamic'

export default async function SeoOpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoOpportunitiesView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
