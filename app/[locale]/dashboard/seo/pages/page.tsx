import { Suspense } from 'react'
import { getSeoPageProps } from '@/lib/local-seo-ui/server'
import { SeoPagesView } from '@/components/local-seo/pages'

export const dynamic = 'force-dynamic'

export default async function SeoPagesPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={null}>
      <SeoPagesView {...await getSeoPageProps(params)} />
    </Suspense>
  )
}
