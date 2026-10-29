import { Suspense } from 'react'
import { getCommsPageProps } from '@/lib/comms-ui/server'
import { CommsInbox } from '@/components/communications/inbox'

export const dynamic = 'force-dynamic'

export default async function CommunicationsInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const props = await getCommsPageProps(params)
  return (
    <Suspense fallback={null}>
      <CommsInbox {...props} />
    </Suspense>
  )
}
