import { getCommsPageProps } from '@/lib/comms-ui/server'
import { CommsConversationDetail } from '@/components/communications/conversation-detail'

export const dynamic = 'force-dynamic'

export default async function CommunicationsConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { id } = await params
  return <CommsConversationDetail {...await getCommsPageProps(params)} conversationId={id} />
}
