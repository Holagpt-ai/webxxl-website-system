import type { AutomationEvent } from '@prisma/client'

type Payload = Record<string, unknown>

export function resolveEventContent(event: AutomationEvent, locale: 'en' | 'es') {
  const p = event.payload as Payload
  const title = String(p.title ?? p.subject ?? event.eventType)
  const body = String(p.body ?? p.summary ?? '')
  const actionUrl = typeof p.actionUrl === 'string' ? p.actionUrl : undefined
  return { title, body, actionUrl, locale: (p.locale === 'es' ? 'es' : locale) as 'en' | 'es' }
}
