import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/seo-workspace-ui/server'
import { SeoConnectionsView } from '@/components/seo-workspace/connections'

export const dynamic = 'force-dynamic'

export default async function SeoConnectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoConnectionsView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
