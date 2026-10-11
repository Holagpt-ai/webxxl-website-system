'use client'

import { useMemo, useState, useTransition } from 'react'
import type { MarketplaceServiceDefinition, MarketplaceCategory } from '@/lib/marketplace/catalog'
import { localizedMarketplaceText } from '@/lib/marketplace/catalog'
import { requestMarketplaceServiceAction } from '@/lib/marketplace/customer-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/dashboard/primitives'

type OrderRow = {
  id: string
  publicId: string
  serviceKey: string
  status: string
  createdAt: Date
}

type Dict = {
  marketplaceBrowse: string
  marketplaceRequestAddon: string
  marketplaceOrderHistory: string
  marketplaceAlreadyActive: string
  marketplaceComingSoon: string
  marketplaceUnavailable: string
  marketplaceSelectProject: string
  marketplaceRequestSubmitted: string
  marketplaceDuplicateOrder: string
  marketplaceNoPayment: string
  marketplaceCategoryLabels: Record<MarketplaceCategory, string>
  marketplaceActiveOnAccount: string
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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
                    {localizedMarketplaceText(service.pricingPresentation, locale)} · {service.billingClass === 'RECURRING' ? 'Recurring' : 'One-time'}
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
                    variant={selectedKey === service.serviceKey ? 'default' : 'outline'}
                    disabled={unavailable || comingSoon || active}
                    onClick={() => {
                      setSelectedKey(service.serviceKey)
                      setMessage(null)
                      setProjectId('')
                      setNotes('')
                    }}
                  >
                    {active ? dict.marketplaceAlreadyActive : dict.marketplaceRequestAddon}
                  </Button>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {selected && (
        <form
          className="rounded-xl border bg-card p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setMessage(null)
            startTransition(async () => {
              const result = await requestMarketplaceServiceAction({
                serviceKey: selected.serviceKey,
                projectId: projectId || undefined,
                customerNotes: notes,
              })
              if (!result.ok) {
                if (result.error === 'coming_soon') setMessage(dict.marketplaceComingSoon)
                else if (result.error === 'unavailable') setMessage(dict.marketplaceUnavailable)
                else if (result.error === 'project_required') setMessage(dict.marketplaceSelectProject)
                else setMessage(dict.marketplaceUnavailable)
                return
              }
              setMessage(result.duplicate ? dict.marketplaceDuplicateOrder : dict.marketplaceRequestSubmitted.replace('{id}', result.publicId))
            })
          }}
        >
          <p className="font-medium">{localizedMarketplaceText(selected.name, locale)}</p>
          {selected.requiresProject && (
            <div>
              <Label htmlFor="marketplace-project">{dict.marketplaceSelectProject}</Label>
              <select
                id="marketplace-project"
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="marketplace-notes">Notes (optional)</Label>
            <Textarea id="marketplace-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={pending} />
          </div>
          <Button type="submit" disabled={pending}>
            {dict.marketplaceRequestAddon}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </form>
      )}

      <section>
        <h2 className="text-lg font-semibold">{dict.marketplaceOrderHistory}</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span className="font-mono text-xs">{order.publicId}</span>
                <span className="text-muted-foreground">{order.serviceKey}</span>
                <StatusBadge label={order.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
