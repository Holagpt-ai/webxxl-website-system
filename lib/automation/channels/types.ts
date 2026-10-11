import type { AutomationDeliveryJob, AutomationEvent } from '@prisma/client'

export type DeliveryContext = {
  job: AutomationDeliveryJob
  event: AutomationEvent
  title: string
  body: string
  actionUrl?: string
  locale: 'en' | 'es'
}

export type ChannelDeliveryResult =
  | { ok: true; providerRef?: string }
  | { ok: false; error: 'not_configured' | 'disabled' | 'invalid_recipient' | 'provider_rejected' | 'unknown' }

export interface NotificationChannel {
  id: string
  deliver(ctx: DeliveryContext): Promise<ChannelDeliveryResult>
}
