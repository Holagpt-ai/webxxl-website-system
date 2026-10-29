import { getCommsPageProps } from '@/lib/comms-ui/server'
import { CommsConnections } from '@/components/communications/connections'

export const dynamic = 'force-dynamic'

export default async function CommunicationsConnectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  return <CommsConnections {...await getCommsPageProps(params)} />
}
