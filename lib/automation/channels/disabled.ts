import type { NotificationChannel, DeliveryContext, ChannelDeliveryResult } from '@/lib/automation/channels/types'

function disabledChannel(id: string): NotificationChannel {
  return {
    id,
    deliver: async (_ctx: DeliveryContext): Promise<ChannelDeliveryResult> => ({ ok: false, error: 'disabled' }),
  }
}

export const smsChannel = disabledChannel('SMS')
export const whatsappChannel = disabledChannel('WHATSAPP')
export const pushChannel = disabledChannel('PUSH')
