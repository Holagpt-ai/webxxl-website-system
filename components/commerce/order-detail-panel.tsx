'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { COMMERCE_API } from '@/lib/commerce-ui/api'
import { commerceGet, commercePost, type CommerceUiErrorCode } from '@/lib/commerce-ui/client'
import { formatMoney } from '@/lib/commerce-ui/format'
import type { FinancialOrderDto } from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { newIdempotencyKey } from '@/lib/crm-ui/workspace'
import { CommerceState, LoadingRows, StatusPill, orderTone } from './ui'

export function OrderDetailPanel({
  orderId,
  copy,
  locale,
  loginHref,
  onClose,
}: {
  orderId: string | null
  copy: CommerceCopy
  locale: string
  loginHref: string
  onClose: () => void
}) {
  const o = copy.orderDetail
  const [order, setOrder] = useState<FinancialOrderDto | null>(null)
  const [error, setError] = useState<CommerceUiErrorCode | null>(null)
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    setOrder(null)
    void commerceGet<FinancialOrderDto>(COMMERCE_API.order(orderId)).then((res) => {
      setLoading(false)
      if (!res.ok) return setError(res.code)
      setOrder(res.data)
    })
  }, [orderId])

  if (!orderId) return null

  async function tryCheckout() {
    if (!orderId) return
    const res = await commercePost<{ checkoutEnabled?: boolean }>(COMMERCE_API.orderCheckout(orderId), {
      idempotencyKey: newIdempotencyKey(),
    })
    if (!res.ok) {
      const state = copy.states[res.code as keyof typeof copy.states]
      setCheckoutNote(state?.body ?? res.code)
    } else setCheckoutNote(o.checkoutStillClosed)
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{o.title}</p>
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>
          {o.close}
        </Button>
      </div>
      {loading ? (
        <LoadingRows rows={3} label={copy.common.loading} />
      ) : error ? (
        <CommerceState code={error} copy={copy} loginHref={loginHref} compact />
      ) : order ? (
        <dl className="flex flex-col gap-2 text-sm">
          <Row label={o.reference} value={order.publicId} />
          <Row
            label={o.status}
            value={<StatusPill label={copy.orderStatuses[order.status] ?? order.status} tone={orderTone(order.status)} />}
          />
          <Row label={o.total} value={formatMoney(order.totalMinor, order.currency, locale)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void tryCheckout()}>
              {o.prepareCheckout}
            </Button>
          </div>
          {checkoutNote && <p className="text-xs text-muted-foreground">{checkoutNote}</p>}
        </dl>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}