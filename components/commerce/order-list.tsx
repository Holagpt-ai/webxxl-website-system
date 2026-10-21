'use client'

import { ChevronDown } from 'lucide-react'
import { formatDate, formatMoney, formatNumber } from '@/lib/commerce-ui/format'
import type { FinancialOrderDto, PurchaseHistoryOrderDto } from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { EmptyNote, StatusPill, orderTone } from './ui'

type OrderLike = FinancialOrderDto & Partial<Pick<PurchaseHistoryOrderDto, 'createdAt' | 'legacyMarketplace' | 'paymentConfirmed'>>

export function OrderList({
  orders,
  copy,
  locale,
  empty,
  accountNames,
}: {
  orders: OrderLike[]
  copy: CommerceCopy
  locale: string
  empty: string
  accountNames?: Record<string, string>
}) {
  if (orders.length === 0) return <EmptyNote>{empty}</EmptyNote>

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {orders.map((order) => {
        const status = copy.orderStatuses[order.status] ?? order.status
        const account = order.customerAccountId
          ? (accountNames?.[order.customerAccountId] ?? order.customerAccountId)
          : copy.admin.noAccount
        return (
          <li key={order.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-sm font-medium text-foreground">{order.publicId}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.createdAt ? formatDate(order.createdAt, locale) : account}
                  </span>
                </span>
                <StatusPill label={status} tone={orderTone(order.status)} />
                <span className="w-28 text-right font-semibold tabular-nums text-foreground">
                  {formatMoney(order.totalMinor, order.currency, locale)}
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                <span className="sr-only">{copy.common.showDetails}</span>
              </summary>

              <div className="flex flex-col gap-4 border-t bg-muted/40 px-4 py-4 text-sm">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Meta label={copy.common.account} value={account} />
                  <Meta label={copy.admin.subtotal} value={formatMoney(order.subtotalMinor, order.currency, locale)} />
                  <Meta label={copy.admin.tax} value={formatMoney(order.taxMinor, order.currency, locale)} />
                  {order.paymentConfirmed !== undefined && (
                    <Meta
                      label={copy.common.status}
                      value={order.paymentConfirmed ? copy.common.paymentConfirmed : copy.common.paymentNotConfirmed}
                    />
                  )}
                </dl>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.admin.items}</p>
                  <ul className="flex flex-col gap-1.5">
                    {order.items.map((item, i) => (
                      <li key={`${item.productKey}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-foreground">{item.productKey}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.quantity} × {formatMoney(item.unitAmountMinor, item.currency, locale)}
                          {item.creditAmount !== null && ` · ${formatNumber(item.creditAmount, locale)} ${copy.common.credits}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.legacyMarketplace && (
                  <p className="text-muted-foreground">
                    {copy.common.linkedRequest}:{' '}
                    <span className="font-mono text-foreground">{order.legacyMarketplace.publicId}</span> ·{' '}
                    {copy.requestStatuses[order.legacyMarketplace.status] ?? order.legacyMarketplace.status}
                  </p>
                )}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
