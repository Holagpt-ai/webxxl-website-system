'use client'

import { useMemo, useState } from 'react'
import type { MarketplaceServiceDefinition, MarketplaceCategory } from '@/lib/marketplace/catalog'
import { localizedMarketplaceText } from '@/lib/marketplace/catalog'
import { resolveMarketplaceServiceDisplayName, resolveServiceOrderStatusLabel } from '@/lib/marketplace/display'
import { MarketplaceRequestModal, type MarketplaceRequestModalDict } from '@/components/dashboard/marketplace-request-modal'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/dashboard/primitives'

type OrderRow = {
  id: string
  publicId: string
  serviceKey: string
  status: string
  createdAt: Date
}

type Dict = MarketplaceRequestModalDict & {
  marketplaceBrowse: string
  marketplaceRequestAddon: string
  marketplaceOrderHistory: string
  marketplaceAlreadyActive: string
  marketplaceComingSoon: string
  marketplaceUnavailable: string
  marketplaceNoPayment: string
  marketplaceCategoryLabels: Record<MarketplaceCategory, string>
  marketplaceActiveOnAccount: string
  marketplaceBillingOneTime: string
  marketplaceBillingRecurring: string
  marketplaceOrderHistoryEmpty: string
}

export function MarketplacePanel({
  locale,
  services,
  activeEntitlements,
  projects,
  orders,
  dict,
}: {
  locale: 'en' | 'es'
  services: MarketplaceServiceDefinition[]
  activeEntitlements: Set<string>
  projects: { id: string; name: string }[]
  orders: OrderRow[]
  dict: Dict
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<MarketplaceCategory, MarketplaceServiceDefinition[]>()
    for (const service of services) {
      const list = map.get(service.category) ?? []
      list.push(service)
      map.set(service.category, list)
    }
    return map
  }, [services])

  const selected = services.find((s) => s.serviceKey === selectedKey) ?? null

  function openRequest(serviceKey: string) {
    setSelectedKey(serviceKey)
    setModalOpen(true)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">{dict.marketplaceBrowse}</h2>
        <p className="text-sm text-muted-foreground">{dict.marketplaceNoPayment}</p>
      </div>
      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.marketplaceCategoryLabels[category]}
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((service) => {
              const entitlement = service.registryEntitlementKey
              const active = entitlement ? activeEntitlements.has(entitlement) : false
              const unavailable = service.availability === 'UNAVAILABLE'
              const comingSoon = service.availability === 'COMING_SOON'
              const isSelected = modalOpen && selectedKey === service.serviceKey
              return (
                <article key={service.serviceKey} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold">{localizedMarketplaceText(service.name, locale)}</h4>
                    {active && <StatusBadge label={dict.marketplaceActiveOnAccount} />}
                    {comingSoon && !active && <StatusBadge label={dict.marketplaceComingSoon} />}
                    {unavailable && <StatusBadge label={dict.marketplaceUnavailable} />}
                  </div>
                  <p className="mt-2 text-muted-foreground">{localizedMarketplaceText(service.description, locale)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {localizedMarketplaceText(service.pricingPresentation, locale)} ·{' '}
                    {service.billingClass === 'RECURRING' ? dict.marketplaceBillingRecurring : dict.marketplaceBillingOneTime}
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {(locale === 'es' ? service.inclusions.es : service.inclusions.en).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={unavailable || comingSoon || active}
                    onClick={() => openRequest(service.serviceKey)}
                  >
                    {active ? dict.marketplaceAlreadyActive : dict.marketplaceRequestAddon}
                  </Button>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <MarketplaceRequestModal
        locale={locale}
        open={modalOpen}
        service={selected}
        projects={projects}
        dict={dict}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSelectedKey(null)
        }}
      />

      <section>
        <h2 className="text-lg font-semibold">{dict.marketplaceOrderHistory}</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{dict.marketplaceOrderHistoryEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{resolveMarketplaceServiceDisplayName(order.serviceKey, locale)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{order.publicId}</p>
                </div>
                <StatusBadge label={resolveServiceOrderStatusLabel(order.status, dict.marketplaceOrderStatusLabels, locale)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
