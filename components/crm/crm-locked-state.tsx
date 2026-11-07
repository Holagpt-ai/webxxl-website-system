import { CreditCard, ShieldAlert } from 'lucide-react'
import type { CrmPageEntitlementState, CrmPageLockedCopy } from '@/lib/platform/crm/page-entitlement'

/**
 * Server-rendered CRM locked panel. Contains no client code and no CRM fetch,
 * so an ineligible or unverifiable account never loads CRM data.
 */
export function CrmLockedState({
  state,
  copy,
}: {
  state: Exclude<CrmPageEntitlementState, 'eligible'>
  copy: CrmPageLockedCopy
}) {
  const Icon = state === 'subscription_required' ? CreditCard : ShieldAlert

  return (
    <section
      aria-labelledby="crm-locked-title"
      data-crm-gate={state}
      className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6 text-card-foreground sm:flex-row sm:p-8"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="flex max-w-prose flex-col gap-2">
        <h2 id="crm-locked-title" className="text-lg font-semibold text-balance text-foreground">
          {copy.title}
        </h2>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{copy.body}</p>
      </div>
    </section>
  )
}
