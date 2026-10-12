import type { AutomationEvent } from '@prisma/client'
import type { Locale } from '@/lib/i18n/config'
import { isNotificationTemplateKey, renderSystemNotification, templateVars } from '@/lib/i18n/notifications'

type Payload = Record<string, unknown>

/** System copy follows the recipient locale. Stored free text is not rewritten. */
export function resolveEventContent(event: AutomationEvent, locale: Locale) {
  const p = event.payload as Payload
  const actionUrl = typeof p.actionUrl === 'string' ? p.actionUrl : undefined
  if (isNotificationTemplateKey(p.templateKey)) {
    const rendered = renderSystemNotification(locale, p.templateKey, templateVars(p.templateVars))
    return { title: rendered.title, body: rendered.body, actionUrl, locale }
  }
  const title = String(p.title ?? p.subject ?? event.eventType)
  const body = String(p.body ?? p.summary ?? '')
  return { title, body, actionUrl, locale }
}
