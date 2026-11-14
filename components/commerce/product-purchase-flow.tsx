'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMMERCE_API } from '@/lib/commerce-ui/api'
import { commercePost, type CommerceUiErrorCode } from '@/lib/commerce-ui/client'
import { fill, formatMoney } from '@/lib/commerce-ui/format'
import { isOpen001Protected, type CatalogRow } from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { newIdempotencyKey } from '@/lib/crm-ui/workspace'
import { CommerceState, StatusPill } from './ui'

type BillingGroupOption = { id: string; name: string }

export function ProductPurchaseFlow({
  product,
  accountId,
  billingGroups,
  copy,
  locale,
  loginHref,
  onOrdered,
}: {
  product: CatalogRow
  accountId: string
  billingGroups: BillingGroupOption[]
  copy: CommerceCopy
  locale: string
  loginHref: string
  onOrdered?: (orderId: string, publicId: string) => void
}) {
  const p = copy.purchase
  const price = product.prices.find((row) => row.status === 'ACTIVE') ?? product.prices[0]
  const [groupId, setGroupId] = useState(billingGroups[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<CommerceUiErrorCode | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const blocked = isOpen001Protected(product) || !product.purchasable || product.pricingMode === 'INCLUDED_FREE'

  if (blocked) {
    return (
      <p className="text-xs text-muted-foreground">{product.pricingMode === 'INCLUDED_FREE' ? copy.marketplace.includedInPlan : p.notPurchasable}</p>
    )
  }
  if (!price) return <p className="text-xs text-muted-foreground">{copy.marketplace.priceNotConfigured}</p>
  if (!billingGroups.length) return <p className="text-xs text-muted-foreground">{p.noBillingGroup}</p>

  async function submit() {
    setPending(true)
    setError(null)
    setSuccess(null)
    const quote = await commercePost<{
      totalMinor: number
      productPriceId: string
      currency: string
    }>(COMMERCE_API.quotes, {
      billingGroupId: groupId,
      customerAccountId: accountId,
      productPriceId: price!.id,
      productKey: product.productKey,
      quantity: qty,
      expectedTotalMinor: price!.amountMinor * qty,
      currency: price!.currency,
    })
    if (!quote.ok) {
      setPending(false)
      setError(quote.code)
      return
    }
    const created = await commercePost<{ orderId: string; publicId: string; status: string }>(COMMERCE_API.orders, {
      billingGroupId: groupId,
      customerAccountId: accountId,
      productPriceId: price!.id,
      quantity: qty,
      expectedTotalMinor: quote.data.totalMinor,
      currency: price!.currency,
      idempotencyKey: newIdempotencyKey(),
    })
    setPending(false)
    if (!created.ok) {
      setError(created.code)
      return
    }
    const msg = fill(p.orderCreated, { id: created.data.publicId })
    setSuccess(msg)
    onOrdered?.(created.data.orderId, created.data.publicId)
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.title}</p>
      <StatusPill label={p.checkoutClosed} tone="muted" />
      {billingGroups.length > 1 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`billing-${product.productKey}`} className="text-xs">
            {p.billingGroup}
          </Label>
          <select
            id={`billing-${product.productKey}`}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {billingGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`qty-${product.productKey}`} className="text-xs">
            {p.quantity}
          </Label>
          <Input
            id={`qty-${product.productKey}`}
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-20"
          />
        </div>
        <Button type="button" size="sm" disabled={pending || !groupId} onClick={() => void submit()}>
          {pending ? p.creating : p.createOrder}
        </Button>
      </div>
      {error && <CommerceState code={error} copy={copy} loginHref={loginHref} compact />}
      {success && <p className="text-xs text-muted-foreground">{success}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{p.noChargeNote}</p>
    </div>
  )
}