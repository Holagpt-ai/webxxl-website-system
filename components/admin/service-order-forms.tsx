'use client'

import { useState, useTransition } from 'react'
import type { ServiceOrderStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  activateServiceOrderEntitlementAction,
  assignServiceOrderAction,
  setServiceOrderQuoteAction,
  updateServiceOrderStatusAction,
} from '@/lib/marketplace/admin-actions'
import { SERVICE_ORDER_STATUSES } from '@/lib/marketplace/transitions'
import { useAdminCopy } from '@/components/admin/locale'
import { actionErrorLabel, enumLabel } from '@/lib/i18n/labels'

export function ServiceOrderStatusForm({ orderId, current }: { orderId: string; current: ServiceOrderStatus }) {
  const [pending, startTransition] = useTransition()
  const { admin: copy, dashboard: dash } = useAdminCopy()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const status = new FormData(e.currentTarget).get('status') as ServiceOrderStatus
        startTransition(async () => {
          await updateServiceOrderStatusAction(orderId, status)
        })
      }}
    >
      <select name="status" defaultValue={current} className="rounded-md border px-2 py-1 text-sm" disabled={pending}>
        {SERVICE_ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {enumLabel(dash.marketplaceOrderStatusLabels, s)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.serviceOrders.updateStatus}
      </Button>
    </form>
  )
}

export function ServiceOrderAssignForm({
  orderId,
  currentAssigneeId,
  staff,
}: {
  orderId: string
  currentAssigneeId: string | null
  staff: { id: string; email: string; name: string | null }[]
}) {
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const assignedToId = new FormData(e.currentTarget).get('assignedToId') as string
        startTransition(async () => {
          await assignServiceOrderAction(orderId, assignedToId || null)
        })
      }}
    >
      <select name="assignedToId" defaultValue={currentAssigneeId ?? ''} className="rounded-md border px-2 py-1 text-sm">
        <option value="">{copy.unassigned}</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name || member.email}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.assign}
      </Button>
    </form>
  )
}

export function ServiceOrderQuoteForm({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const dollars = data.get('quoteDollars') as string
        const cents = dollars ? Math.round(parseFloat(dollars) * 100) : null
        startTransition(async () => {
          await setServiceOrderQuoteAction({
            orderId,
            quoteAmountCents: Number.isFinite(cents as number) ? (cents as number) : null,
            quoteNotes: (data.get('quoteNotes') as string) || undefined,
          })
        })
      }}
    >
      <Label htmlFor={`quote-${orderId}`}>{copy.serviceOrders.quoteLabel}</Label>
      <Input id={`quote-${orderId}`} name="quoteDollars" type="number" step="0.01" min="0" disabled={pending} />
      <Textarea name="quoteNotes" rows={2} placeholder={copy.serviceOrders.quoteNotes} disabled={pending} />
      <Button type="submit" size="sm" disabled={pending}>
        {copy.serviceOrders.saveQuote}
      </Button>
    </form>
  )
}

export function ServiceOrderActivateEntitlementButton({
  orderId,
  status,
  hasEntitlement,
}: {
  orderId: string
  status: ServiceOrderStatus
  hasEntitlement: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const { admin: copy } = useAdminCopy()
  if (hasEntitlement) return <p className="text-sm text-muted-foreground">{copy.serviceOrders.entitlementLinked}</p>
  if (status !== 'COMPLETED') {
    return <p className="text-sm text-muted-foreground">{copy.serviceOrders.completeBeforeActivate}</p>
  }
  return (
    <div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await activateServiceOrderEntitlementAction(orderId)
            setMessage(result.ok ? copy.serviceOrders.entitlementActivated : actionErrorLabel(result.error, copy.errors))
          })
        }}
      >
        {copy.serviceOrders.activateEntitlement}
      </Button>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
