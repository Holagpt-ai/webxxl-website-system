'use client'

import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { useCommerce, withPage } from '@/lib/commerce-ui/client'
import { fill, formatDate, formatMoney, formatNumber } from '@/lib/commerce-ui/format'
import type {
  AccountServiceRow,
  CatalogRow,
  MarketplaceRequestHistoryDto,
  PageResult,
  PurchaseHistoryOrderDto,
} from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { cn } from '@/lib/utils'
import { OrderList } from './order-list'
import { CommerceState, EmptyNote, LoadingRows, Pagination, Section, StatusPill, TableFrame, td, th } from './ui'

const PAGE = 10

export function MarketplaceView({
  accountId,
  locale,
  copy,
  loginHref,
}: {
  accountId: string
  locale: string
  copy: CommerceCopy
  loginHref: string
}) {
  const m = copy.marketplace
  const base = `/api/v1/commerce/accounts/${encodeURIComponent(accountId)}`
  const catalog = useCommerce<{ catalog: CatalogRow[] }>('/api/v1/commerce/catalog')

  // Commerce being off is account-wide; show one clear state instead of four identical ones.
  if (catalog.error?.code === 'COMMERCE_DISABLED') {
    return <CommerceState code="COMMERCE_DISABLED" copy={copy} />
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {copy.common.checkoutClosed}
      </p>
      <CatalogSection state={catalog} copy={copy} locale={locale} loginHref={loginHref} />
      <ServicesSection url={`${base}/services`} copy={copy} loginHref={loginHref} />
      <RequestsSection url={`${base}/marketplace-requests`} copy={copy} locale={locale} loginHref={loginHref} />
      <Section id="orders" title={m.ordersTitle}>
        <PagedOrders url={`${base}/orders`} copy={copy} locale={locale} empty={m.ordersEmpty} loginHref={loginHref} />
      </Section>
    </div>
  )
}

function CatalogSection({
  state,
  copy,
  locale,
  loginHref,
}: {
  state: ReturnType<typeof useCommerce<{ catalog: CatalogRow[] }>>
  copy: CommerceCopy
  locale: string
  loginHref: string
}) {
  const m = copy.marketplace
  const [kind, setKind] = useState('ALL')
  const rows = state.data?.catalog ?? []
  const kinds = useMemo(() => ['ALL', ...Array.from(new Set(rows.map((row) => row.kind)))], [rows])
  const visible = kind === 'ALL' ? rows : rows.filter((row) => row.kind === kind)

  return (
    <Section id="catalog" title={m.catalogTitle} description={m.catalogDescription}>
      {state.error ? (
        <CommerceState error={state.error} copy={copy} onRetry={() => state.mutate()} loginHref={loginHref} />
      ) : !state.data ? (
        <LoadingRows label={copy.common.loading} rows={3} />
      ) : rows.length === 0 ? (
        <EmptyNote>{m.catalogEmpty}</EmptyNote>
      ) : (
        <>
          {kinds.length > 2 && (
            <div role="group" aria-label={m.categoryFilter} className="flex flex-wrap gap-2">
              {kinds.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    kind === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {copy.kinds[value] ?? value}
                </button>
              ))}
            </div>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.productKey} product={product} copy={copy} locale={locale} />
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

function ProductCard({ product, copy, locale }: { product: CatalogRow; copy: CommerceCopy; locale: string }) {
  const m = copy.marketplace
  const price = product.prices.find((p) => p.status === 'ACTIVE') ?? product.prices[0]
  const included = product.pricingMode === 'INCLUDED_FREE'

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-foreground">{product.name}</p>
        <StatusPill label={copy.kinds[product.kind] ?? product.kind} tone="info" />
      </div>
      <div className="mt-auto flex flex-col gap-1">
        {included ? (
          <p className="font-semibold text-success">{m.includedInPlan}</p>
        ) : price ? (
          <p className="text-xl font-bold tabular-nums text-foreground">
            {formatMoney(price.amountMinor, price.currency, locale)}
            <span className="text-sm font-medium text-muted-foreground">{copy.intervals[price.billingInterval] ?? ''}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{m.priceNotConfigured}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {copy.pricingModes[product.pricingMode] ?? product.pricingMode}
          {price && !included && ` · ${fill(m.priceVersion, { version: price.priceVersion })}`}
          {price?.creditAmount != null && ` · ${fill(m.creditsIncluded, { credits: formatNumber(price.creditAmount, locale) })}`}
        </p>
      </div>
    </li>
  )
}

function ServicesSection({ url, copy, loginHref }: { url: string; copy: CommerceCopy; loginHref: string }) {
  const m = copy.marketplace
  const { data, error, mutate } = useCommerce<AccountServiceRow[]>(url)
  return (
    <Section id="services" title={m.purchasedTitle}>
      {error ? (
        <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
      ) : !data ? (
        <LoadingRows label={copy.common.loading} rows={2} />
      ) : data.length === 0 ? (
        <EmptyNote>{m.purchasedEmpty}</EmptyNote>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {data.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-mono text-sm text-foreground">{service.productKey}</span>
              <StatusPill
                label={copy.serviceStatuses[service.status] ?? service.status}
                tone={service.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function RequestsSection({
  url,
  copy,
  locale,
  loginHref,
}: {
  url: string
  copy: CommerceCopy
  locale: string
  loginHref: string
}) {
  const m = copy.marketplace
  const [skip, setSkip] = useState(0)
  const { data, error, mutate } = useCommerce<PageResult<MarketplaceRequestHistoryDto>>(withPage(url, PAGE, skip))

  return (
    <Section id="requests" title={m.requestsTitle}>
      {error ? (
        <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
      ) : !data ? (
        <LoadingRows label={copy.common.loading} rows={2} />
      ) : data.items.length === 0 ? (
        <EmptyNote>{m.requestsEmpty}</EmptyNote>
      ) : (
        <>
          <TableFrame label={m.requestsTitle}>
            <thead>
              <tr>
                <th scope="col" className={th}>{copy.common.reference}</th>
                <th scope="col" className={th}>{copy.common.service}</th>
                <th scope="col" className={th}>{copy.common.status}</th>
                <th scope="col" className={th}>{copy.common.amount}</th>
                <th scope="col" className={th}>{copy.common.updated}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((req) => (
                <tr key={req.serviceOrderId}>
                  <td className={cn(td, 'font-mono')}>{req.publicId}</td>
                  <td className={td}>{req.serviceKey}</td>
                  <td className={td}>
                    <StatusPill label={copy.requestStatuses[req.status] ?? req.status} tone="info" />
                  </td>
                  <td className={cn(td, 'tabular-nums')}>
                    {req.quoteAmountCents !== null && req.quoteCurrency
                      ? formatMoney(req.quoteAmountCents, req.quoteCurrency, locale)
                      : <span className="text-muted-foreground">{copy.common.notQuoted}</span>}
                  </td>
                  <td className={cn(td, 'text-muted-foreground')}>{formatDate(req.updatedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          <Pagination total={data.pagination.total} take={PAGE} skip={skip} onChange={setSkip} copy={copy} />
        </>
      )}
    </Section>
  )
}

export function PagedOrders({
  url,
  copy,
  locale,
  empty,
  loginHref,
  accountNames,
}: {
  url: string
  copy: CommerceCopy
  locale: string
  empty: string
  loginHref: string
  accountNames?: Record<string, string>
}) {
  const [skip, setSkip] = useState(0)
  const { data, error, mutate } = useCommerce<PageResult<PurchaseHistoryOrderDto>>(withPage(url, PAGE, skip))

  if (error) return <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows label={copy.common.loading} />
  return (
    <>
      <OrderList orders={data.items} copy={copy} locale={locale} empty={empty} accountNames={accountNames} />
      <Pagination total={data.pagination.total} take={PAGE} skip={skip} onChange={setSkip} copy={copy} />
    </>
  )
}
