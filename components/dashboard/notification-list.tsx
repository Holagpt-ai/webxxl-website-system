'use client'

import { useTransition } from 'react'
import { LocaleLink } from '@/components/site/primitives'
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/automation/customer-actions'
import { Button } from '@/components/ui/button'
import { enumLabel } from '@/lib/i18n/labels'

type Item = {
  id: string
  title: string
  body: string
  actionUrl: string | null
  readAt: Date | null
  createdAt: Date
  deliveryStatus?: string | null
}

type Props = {
  locale: 'en' | 'es'
  items: Item[]
  markReadLabel: string
  markAllReadLabel: string
  deliveryLabel: string
  unreadLabel: string
  openLabel: string
  deliveryStatuses: { [key: string]: string }
}

export function NotificationList({
  locale,
  items,
  markReadLabel,
  markAllReadLabel,
  deliveryLabel,
  unreadLabel,
  openLabel,
  deliveryStatuses,
}: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => void markAllNotificationsReadAction())}
      >
        {markAllReadLabel}
      </Button>
      <ul className="flex flex-col gap-3 text-sm">
        {items.map((n) => (
          <li key={n.id} className={`rounded-lg border p-3 ${n.readAt ? 'opacity-80' : 'border-primary/40'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{n.title}</p>
              {!n.readAt && <span className="text-xs font-medium text-primary">{unreadLabel}</span>}
            </div>
            <p className="mt-1 text-muted-foreground">{n.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">{n.createdAt.toLocaleString(locale === 'es' ? 'es-US' : 'en-US')}</p>
            {n.deliveryStatus && (
              <p className="text-xs text-muted-foreground">
                {deliveryLabel}: {enumLabel(deliveryStatuses, n.deliveryStatus)}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {n.actionUrl && (
                <LocaleLink locale={locale} href={n.actionUrl} className="text-xs text-primary underline">
                  {openLabel}
                </LocaleLink>
              )}
              {!n.readAt && (
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void markNotificationReadAction(n.id))
                  }
                >
                  {markReadLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
