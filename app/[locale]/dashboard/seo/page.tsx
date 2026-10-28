import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/seo-workspace-ui/server'
import { SeoOverviewView } from '@/components/seo-workspace/overview'

export const dynamic = 'force-dynamic'

export default async function SeoOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoOverviewView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
