import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/seo-workspace-ui/server'
import { SeoPagesView } from '@/components/seo-workspace/pages'

export const dynamic = 'force-dynamic'

export default async function SeoPagesPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoPagesView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
