import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { DependencyResolveButton } from '@/components/dashboard/forms'
import { StatusBadge } from '@/components/dashboard/primitives'
import { enumLabel } from '@/lib/i18n/labels'
import {
  dependencyActionHref,
  parseDependencyCustomerActionKey,
  type DependencyCustomerActionKey,
} from '@/lib/portal/dependency-actions'
import { cn } from '@/lib/utils'

type DependencyRow = {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: Date | null
  customerActionKey: string | null
  allowsCustomerAck: boolean
  milestone?: { title: string } | null
}

function fmtDate(d: Date | null, locale: string) {
  if (!d) return null
  return new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { dateStyle: 'medium' }).format(d)
}

export function DependencyActionCenter({
  dependencies,
  localePrefix,
  locale,
  copy,
}: {
  dependencies: DependencyRow[]
  localePrefix: string
  locale: string
  copy: {
    dependencyStatuses: Record<string, string>
    actionOpen: string
    resolve: string
    dueDate: string
    relatedMilestone: string
    noOpenActions: string
    dependencyActionLabels: Record<DependencyCustomerActionKey, string>
  }
}) {
  const open = dependencies.filter((d) => d.status === 'REQUESTED' || d.status === 'IN_PROGRESS')
  if (open.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.noOpenActions}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {open.map((dep) => {
        const actionKey = parseDependencyCustomerActionKey(dep.customerActionKey)
        const href = dependencyActionHref(actionKey, localePrefix)
        const due = fmtDate(dep.dueDate, locale)
        return (
          <li key={dep.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{dep.title}</p>
              <StatusBadge label={enumLabel(copy.dependencyStatuses, dep.status)} />
            </div>
            {dep.description && <p className="mt-1 text-pretty text-muted-foreground">{dep.description}</p>}
            {dep.milestone && (
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.relatedMilestone}: {dep.milestone.title}
              </p>
            )}
            {due && (
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.dueDate}: {due}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {href && (
                <Link href={href} className={cn(buttonVariants({ size: 'sm' }))}>
                  {actionKey ? copy.dependencyActionLabels[actionKey] : copy.actionOpen}
                </Link>
              )}
              {dep.allowsCustomerAck && <DependencyResolveButton dependencyId={dep.id} label={copy.resolve} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
