import { createNotification } from '@/lib/portal/notifications'
import { AUTOMATION_EVENT_REGISTRY } from '@/lib/automation/registry'
import type { NotificationChannel, DeliveryContext, ChannelDeliveryResult } from '@/lib/automation/channels/types'

export const inAppChannel: NotificationChannel = {
  id: 'IN_APP',
  async deliver(ctx: DeliveryContext): Promise<ChannelDeliveryResult> {
    if (!ctx.job.recipientUserId) return { ok: false, error: 'invalid_recipient' }
    const def = AUTOMATION_EVENT_REGISTRY[ctx.event.eventType]
    const notification = await createNotification({
      userId: ctx.job.recipientUserId,
      customerAccountId: ctx.event.customerAccountId ?? undefined,
      type: def.notificationType,
      title: ctx.title,
      body: ctx.body,
      actionUrl: ctx.actionUrl,
    })
    return { ok: true, providerRef: notification.id }
  },
}
