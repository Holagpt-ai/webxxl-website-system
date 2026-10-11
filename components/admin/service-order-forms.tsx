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

export function ServiceOrderStatusForm({ orderId, current }: { orderId: string; current: ServiceOrderStatus }) {
  const [pending, startTransition] = useTransition()
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
            {s}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Update status
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
        <option value="">Unassigned</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name || member.email}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Assign
      </Button>
    </form>
  )
}

export function ServiceOrderQuoteForm({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
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
      <Label htmlFor={`quote-${orderId}`}>Quote (USD, optional)</Label>
      <Input id={`quote-${orderId}`} name="quoteDollars" type="number" step="0.01" min="0" disabled={pending} />
      <Textarea name="quoteNotes" rows={2} placeholder="Quote notes (customer-visible when shared)" disabled={pending} />
      <Button type="submit" size="sm" disabled={pending}>
        Save quote
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
  if (hasEntitlement) return <p className="text-sm text-muted-foreground">Entitlement already linked.</p>
  if (status !== 'COMPLETED') {
    return <p className="text-sm text-muted-foreground">Complete the order before activating entitlements.</p>
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
            setMessage(result.ok ? 'Entitlement activated on customer account.' : result.error)
          })
        }}
      >
        Activate entitlement on account
      </Button>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
