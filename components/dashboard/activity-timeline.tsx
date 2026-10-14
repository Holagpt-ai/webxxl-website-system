import { localizeStoredActivity } from '@/lib/i18n/labels'

type ActivityRow = {
  id: string
  eventType: string
  summary: string
  createdAt: Date
}

export function ActivityTimeline({
  activities,
  locale,
  activityLabels,
  emptyLabel,
}: {
  activities: ActivityRow[]
  locale: string
  activityLabels: Record<string, string>
  emptyLabel: string
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }
  const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {activities.map((activity) => (
        <li key={activity.id} className="border-b border-border/60 pb-2 last:border-0">
          <p>{localizeStoredActivity(activity.summary, activity.eventType, activityLabels)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{fmt.format(activity.createdAt)}</p>
        </li>
      ))}
    </ul>
  )
}
