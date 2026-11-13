import Link from 'next/link'
import { CircleSlash } from 'lucide-react'
import { StatusPill, type PillTone } from '@/components/commerce/ui'
import { cn } from '@/lib/utils'

export function Panel({
  title,
  note,
  action,
  children,
  className,
}: {
  title: string
  note?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-lg border bg-background p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function Metric({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <span className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground hyphens-auto">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
    </>
  )
  const base = 'flex min-w-0 flex-col gap-1 rounded-lg border bg-background p-4'
  return href ? (
    <Link href={href} className={cn(base, 'transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring')}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

export function MetricSkeleton({ count, label }: { count: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border bg-background p-4">
          <span className="h-3 w-24 animate-pulse rounded bg-muted" />
          <span className="h-7 w-12 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function FactRow({ label, value, tone }: { label: string; value: string; tone?: PillTone }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b py-2 text-sm last:border-0">
      <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
      <dd className="ml-auto text-right">{tone ? <StatusPill label={value} tone={tone} /> : <span className="font-medium tabular-nums text-foreground">{value}</span>}</dd>
    </div>
  )
}

export function SliceUnavailable({
  title,
  reasonLabel,
  reason,
  reasonCode,
  message,
  serverMessageLabel,
}: {
  title: string
  reasonLabel: string
  reason?: string
  reasonCode?: string
  message?: string
  serverMessageLabel: string
}) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-dashed bg-muted px-4 py-3 text-sm">
      <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {reason && <p className="leading-relaxed text-muted-foreground">{reason}</p>}
        {message && message !== reason && (
          <p className="text-xs text-muted-foreground">
            {serverMessageLabel}: {message}
          </p>
        )}
        {reasonCode && (
          <p className="text-xs text-muted-foreground">
            {reasonLabel}: <code className="font-mono">{reasonCode}</code>
          </p>
        )}
      </div>
    </div>
  )
}
