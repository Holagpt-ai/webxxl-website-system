import { getPageContext } from '@/lib/i18n/server'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import { getServiceModules } from '@/lib/portal/modules'
import { getSchedulerLaunchUrl, getSchedulerStatus } from '@/lib/integrations/scheduler'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { LocaleLink } from '@/components/site/primitives'
import { Button } from '@/components/ui/button'
import { isEnabled } from '@/config/features'
import { listVisibleMarketplaceServices } from '@/lib/marketplace/catalog'
import { listCustomerServiceOrders } from '@/lib/marketplace/queries'
import { MarketplacePanel } from '@/components/dashboard/marketplace-panel'

export const dynamic = 'force-dynamic'

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  const d = dict.dashboard
  const loc = locale === 'es' ? 'es' : 'en'

  const [services, projects, orders] = await Promise.all([
    prisma.customerService.findMany({ where: { customerAccountId: portal.customerAccount.id } }),
    prisma.project.findMany({
      where: { customerAccountId: portal.customerAccount.id, status: { in: ['ACTIVE', 'DRAFT', 'ON_HOLD'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    listCustomerServiceOrders(portal.customerAccount.id),
  ])

  const activeKeys = new Set(services.filter((s) => s.status === 'ACTIVE').map((s) => s.serviceKey))
  const modules = getServiceModules(activeKeys)
  const schedulerActive = activeKeys.has('scheduler')
  const schedulerStatus = schedulerActive ? await getSchedulerStatus() : null
  const marketplaceEnabled = isEnabled('serviceMarketplace')

  return (
    <>
      <PageTitle title={d.servicesTitle} description={d.servicesDescription} />

      {marketplaceEnabled && (
        <div className="mb-10">
          <MarketplacePanel
            locale={loc}
            services={listVisibleMarketplaceServices()}
            activeEntitlements={activeKeys}
            projects={projects}
            orders={orders}
            dict={{
              marketplaceBrowse: d.marketplaceBrowse,
              marketplaceRequestAddon: d.marketplaceRequestAddon,
              marketplaceOrderHistory: d.marketplaceOrderHistory,
              marketplaceAlreadyActive: d.marketplaceAlreadyActive,
              marketplaceComingSoon: d.marketplaceComingSoon,
              marketplaceUnavailable: d.marketplaceUnavailable,
              marketplaceSelectProject: d.marketplaceSelectProject,
              marketplaceDuplicateOrder: d.marketplaceDuplicateOrder,
              marketplaceNoPayment: d.marketplaceNoPayment,
              marketplaceActiveOnAccount: d.marketplaceActiveOnAccount,
              marketplaceCategoryLabels: d.marketplaceCategoryLabels,
              marketplaceNotesLabel: d.marketplaceNotesLabel,
              marketplaceSubmitRequest: d.marketplaceSubmitRequest,
              marketplaceCancel: d.marketplaceCancel,
              marketplaceDone: d.marketplaceDone,
              marketplaceModalTitle: d.marketplaceModalTitle,
              marketplaceConfirmTitle: d.marketplaceConfirmTitle,
              marketplaceConfirmService: d.marketplaceConfirmService,
              marketplaceConfirmReference: d.marketplaceConfirmReference,
              marketplaceConfirmStatus: d.marketplaceConfirmStatus,
              marketplaceConfirmFollowUp: d.marketplaceConfirmFollowUp,
              marketplaceSubmitError: d.marketplaceSubmitError,
              marketplaceBillingOneTime: d.marketplaceBillingOneTime,
              marketplaceBillingRecurring: d.marketplaceBillingRecurring,
              marketplaceOrderHistoryEmpty: d.marketplaceOrderHistoryEmpty,
              marketplaceOrderStatusLabels: d.marketplaceOrderStatusLabels,
            }}
          />
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold">{d.marketplaceEntitlementsTitle}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((mod) => {
          const service = services.find((s) => s.serviceKey === mod.entitlementRequired || s.serviceKey === mod.key)
          const active = service?.status === 'ACTIVE'
          return (
            <SectionCard key={mod.key} title={d.nav[mod.navLabel as keyof typeof d.nav] ?? mod.navLabel}>
              <StatusBadge label={active ? dict.common.available : mod.key === 'billing' ? dict.common.comingSoon : dict.common.planned} />
              {mod.key === 'billing' && <p className="mt-3 text-sm text-muted-foreground">{d.billingSoon}</p>}
              {mod.key === 'scheduler' && schedulerActive && (
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <p>
                    {d.schedulerStatus}:{' '}
                    {schedulerStatus?.ok ? `${dict.common.available} (${schedulerStatus.latencyMs}ms)` : 'Unreachable'}
                  </p>
                  <Button size="sm" render={<a href={getSchedulerLaunchUrl()} target="_blank" rel="noopener noreferrer" />}>
                    {d.openScheduler}
                  </Button>
                </div>
              )}
              {!active && mod.key !== 'billing' && mod.entitlementRequired && (
                <p className="mt-3 text-sm text-muted-foreground">{dict.states.disabledBody}</p>
              )}
            </SectionCard>
          )
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <LocaleLink locale={locale} href="/contact" className="font-semibold text-primary hover:underline">
          Contact WebXXL
        </LocaleLink>
      </p>
    </>
  )
}
