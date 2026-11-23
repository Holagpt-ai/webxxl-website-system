import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'

export const COMMUNICATIONS_WORKSPACES = {
  inbox: BUSINESS_DESTINATIONS.commsInbox,
  connections: '/dashboard/communications/connections',
  conversation: (conversationId: string) => BUSINESS_DESTINATIONS.commsConversation(conversationId),
} as const

export function communicationsAccountApiPath(suffix: string): string {
  return `/api/v1/communications/${suffix}`
}