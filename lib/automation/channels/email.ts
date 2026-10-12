import { sendEmail } from '@/lib/integrations/email'
import { isEnabled } from '@/config/features'
import type { NotificationChannel, DeliveryContext, ChannelDeliveryResult } from '@/lib/automation/channels/types'
import { buildAutomationEmail } from '@/lib/automation/templates/email'
import { localizePath } from '@/lib/i18n/localize'

export const emailChannel: NotificationChannel = {
  id: 'EMAIL',
  async deliver(ctx: DeliveryContext): Promise<ChannelDeliveryResult> {
    if (!isEnabled('automationEmailChannel')) return { ok: false, error: 'disabled' }
    const to = ctx.job.recipientEmail?.trim()
    if (!to) return { ok: false, error: 'invalid_recipient' }
    const mail = buildAutomationEmail({
      locale: ctx.locale,
      title: ctx.title,
      body: ctx.body,
      actionUrl: ctx.actionUrl ? localizePath(ctx.locale, ctx.actionUrl) : undefined,
    })
    const result = await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html })
    if (!result.ok) {
      if (result.reason === 'not_configured') return { ok: false, error: 'not_configured' }
      return { ok: false, error: 'provider_rejected' }
    }
    return { ok: true, providerRef: result.id }
  },
}
