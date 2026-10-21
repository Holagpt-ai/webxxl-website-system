'use client'

import { useState } from 'react'
import { Info, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { postActivation, useCommerce, type CommerceUiErrorCode } from '@/lib/commerce-ui/client'
import { formatDate, formatMoney } from '@/lib/commerce-ui/format'
import { isOpen001Protected, type AdminCatalogProductDto, type FinancialOrderDto } from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { cn } from '@/lib/utils'
import { OrderList } from './order-list'
import { CommerceState, EmptyNote, LoadingRows, Section, StatusPill, TableFrame, activationTone, td, th } from './ui'
import type { BillingGroupOption } from './billing-view'

type Tab = 'catalog' | 'orders'

export function AdminCommerceView({
  groups,
  locale,
  copy,
  loginHref,
}: {
  groups: BillingGroupOption[]
  locale: string
  copy: CommerceCopy
  loginHref: string
}) {
  const a = copy.admin
  const [tab, setTab] = useState<Tab>('catalog')
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'catalog', label: a.tabCatalog },
    { id: 'orders', label: a.tabOrders },
  ]

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {a.checkoutNotice}
      </p>
      <div role="tablist" aria-label={a.tabsLabel} className="flex gap-1 self-start rounded-lg border bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'catalog' ? (
          <AdminCatalog copy={copy} locale={locale} loginHref={loginHref} />
        ) : (
          <AdminOrders groups={groups} copy={copy} locale={locale} loginHref={loginHref} />
        )}
      </div>
    </div>
  )
}

function AdminCatalog({ copy, locale, loginHref }: { copy: CommerceCopy; locale: string; loginHref: string }) {
  const a = copy.admin
  const [status, setStatus] = useState('ALL')
  const { data, error, mutate } = useCommerce<AdminCatalogProductDto[]>('/api/v1/admin/commerce/catalog')

  if (error) return <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows label={copy.common.loading} rows={4} />
  if (data.length === 0) return <EmptyNote>{a.catalogEmpty}</EmptyNote>

  const visible = status === 'ALL' ? data : data.filter((p) => p.status === status)

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={a.statusFilter} className="flex flex-wrap gap-2">
        {['ALL', 'ACTIVE', 'INACTIVE', 'DRAFT'].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              status === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted',
            )}
          >
            {value === 'ALL' ? a.allStatuses : copy.activationStatuses[value]}
          </button>
        ))}
      </div>
      {visible.map((product) => (
        <ProductAdminCard key={product.productKey} product={product} copy={copy} locale={locale} onChanged={() => mutate()} />
      ))}
    </div>
  )
}

function ProductAdminCard({
  product,
  copy,
  locale,
  onChanged,
}: {
  product: AdminCatalogProductDto
  copy: CommerceCopy
  locale: string
  onChanged: () => void
}) {
  const a = copy.admin
  const isProtected = isOpen001Protected(product)
  const [next, setNext] = useState(product.status)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<CommerceUiErrorCode | null>(null)
  const selectId = `status-${product.publicId}`

  async function run(key: string, url: string, status: string) {
    setBusy(key)
    setFailure(null)
    const result = await postActivation(url, status)
    setBusy(null)
    if (result.ok) onChanged()
    else setFailure(result.code)
  }

  const productUrl = `/api/v1/admin/commerce/products/${encodeURIComponent(product.productKey)}/activation`

  return (
    <Section
      id={`product-${product.publicId}`}
      title={product.name}
      description={`${a.productKey}: ${product.productKey}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {isProtected && (
            <StatusPill label={a.protectedBadge} tone="danger" className="gap-1" />
          )}
          <StatusPill label={copy.activationStatuses[product.status] ?? product.status} tone={activationTone(product.status)} />
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Fact label={a.kind} value={copy.kinds[product.kind] ?? product.kind} />
        <Fact label={a.pricingMode} value={copy.pricingModes[product.pricingMode] ?? product.pricingMode} />
        <Fact label={a.cohort} value={product.eligibilityCohort} />
        <Fact label={a.purchasable} value={product.purchasable ? a.yes : a.no} />
      </dl>

      {isProtected && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          {a.protectedHelp}
        </p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (next !== product.status) void run('product', productUrl, next)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">
            {a.productActivation}
          </label>
          <select
            id={selectId}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {['ACTIVE', 'INACTIVE', 'DRAFT'].map((value) => (
              <option key={value} value={value} disabled={value === 'ACTIVE' && isProtected}>
                {copy.activationStatuses[value]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={busy !== null || next === product.status}>
          {busy === 'product' ? a.applying : a.apply}
        </Button>
      </form>

      {failure && <CommerceState code={failure} copy={copy} compact />}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{a.pricesTitle}</h3>
        {product.prices.length === 0 ? (
          <EmptyNote>{a.pricesEmpty}</EmptyNote>
        ) : (
          <TableFrame label={`${a.pricesTitle} — ${product.name}`}>
            <thead>
              <tr>
                <th scope="col" className={th}>{copy.common.amount}</th>
                <th scope="col" className={th}>{a.interval}</th>
                <th scope="col" className={th}>{a.version}</th>
                <th scope="col" className={th}>{a.effective}</th>
                <th scope="col" className={th}>{copy.common.status}</th>
                <th scope="col" className={cn(th, 'text-right')}>{copy.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {product.prices.map((price) => {
                const active = price.status === 'ACTIVE'
                const url = `/api/v1/admin/commerce/prices/${encodeURIComponent(price.id)}/activation`
                return (
                  <tr key={price.id}>
                    <td className={cn(td, 'font-semibold tabular-nums')}>{formatMoney(price.amountMinor, price.currency, locale)}</td>
                    <td className={td}>{price.billingInterval}</td>
                    <td className={cn(td, 'font-mono')}>{price.priceVersion}</td>
                    <td className={cn(td, 'text-muted-foreground')}>
                      {formatDate(price.effectiveFrom, locale)} – {price.effectiveTo ? formatDate(price.effectiveTo, locale) : a.effectiveOpen}
                    </td>
                    <td className={td}>
                      <StatusPill label={copy.activationStatuses[price.status] ?? price.status} tone={activationTone(price.status)} />
                    </td>
                    <td className={cn(td, 'text-right')}>
                      <Button
                        size="sm"
                        variant={active ? 'outline' : 'default'}
                        disabled={busy !== null || (!active && isProtected)}
                        onClick={() => void run(price.id, url, active ? 'INACTIVE' : 'ACTIVE')}
                      >
                        {busy === price.id ? a.applying : active ? a.deactivatePrice : a.activatePrice}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableFrame>
        )}
      </div>
    </Section>
  )
}

function AdminOrders({
  groups,
  copy,
  locale,
  loginHref,
}: {
  groups: BillingGroupOption[]
  copy: CommerceCopy
  locale: string
  loginHref: string
}) {
  const a = copy.admin
  const [groupId, setGroupId] = useState('')
  const { data, error, mutate } = useCommerce<FinancialOrderDto[]>(
    groupId ? `/api/v1/admin/commerce/orders?billingGroupId=${encodeURIComponent(groupId)}` : null,
  )

  if (groups.length === 0) return <EmptyNote>{a.ordersNoGroups}</EmptyNote>

  return (
    <Section id="admin-orders" title={a.tabOrders}>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <label htmlFor="admin-group" className="text-sm font-medium text-foreground">
          {a.ordersGroupLabel}
        </label>
        <select
          id="admin-group"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="h-10 rounded-md border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="">{a.ordersGroupPlaceholder}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      {!groupId ? (
        <EmptyNote>{a.ordersPickGroup}</EmptyNote>
      ) : error ? (
        <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
      ) : !data ? (
        <LoadingRows label={copy.common.loading} />
      ) : (
        <OrderList orders={data} copy={copy} locale={locale} empty={a.ordersEmpty} />
      )}
    </Section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
