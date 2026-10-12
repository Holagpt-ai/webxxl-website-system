import { requireStaff } from '@/lib/portal/authz'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format } from '@/lib/i18n/localize'
import { resolveLocale } from '@/lib/i18n/server'
import { listAdminInfrastructure } from '@/lib/infrastructure/queries'
import { PageTitle, EmptyState, StatusBadge } from '@/components/dashboard/primitives'
import {
  adminMarkSyncRequestedFormAction,
  adminRegisterDomainAction,
  adminRegisterEmailAction,
  adminRegisterHostingAction,
} from '@/lib/infrastructure/admin-actions'
import { probeProviderReadOnly } from '@/lib/infrastructure/registry'

export const dynamic = 'force-dynamic'

export default async function AdminInfrastructurePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; customerAccountId?: string }>
}) {
  await requireStaff()
  const locale = await resolveLocale(params)
  const copy = getDictionary(locale).admin
  const sp = await searchParams
  const data = await listAdminInfrastructure({ q: sp.q, customerAccountId: sp.customerAccountId })
  const providerProbe = await probeProviderReadOnly({ kind: 'dns', providerId: 'manual', domain: 'example.com' })

  return (
    <>
      <PageTitle title={copy.infrastructure.title} description={copy.infrastructure.description} />
      <p className="mb-4 text-sm text-muted-foreground">
        {format(copy.infrastructure.probe, { status: providerProbe.ok ? copy.infrastructure.probeOk : providerProbe.error ?? copy.infrastructure.probeOk })}
      </p>
      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder={copy.infrastructure.searchPlaceholder}
          className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          name="customerAccountId"
          defaultValue={sp.customerAccountId ?? ''}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{copy.infrastructure.allCustomers}</option>
          {data.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.businessName}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Filter
        </button>
      </form>

      <div className="mb-10 grid gap-8 xl:grid-cols-3">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Register domain</h2>
          <form action={adminRegisterDomainAction} className="flex flex-col gap-2 text-sm">
            <select name="customerAccountId" required className="rounded-md border px-2 py-1.5">
              <option value="">Customer</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <input name="domainName" required placeholder="example.com" className="rounded-md border px-2 py-1.5" />
            <input name="registrar" placeholder={copy.infrastructure.registrar} className="rounded-md border px-2 py-1.5" />
            <input name="expiresAt" type="date" className="rounded-md border px-2 py-1.5" />
            <input name="dnsProviderId" placeholder={copy.infrastructure.dnsProviderId} className="rounded-md border px-2 py-1.5" />
            <input name="providerReference" placeholder={copy.infrastructure.externalRef} className="rounded-md border px-2 py-1.5" />
            <textarea name="internalNotes" placeholder={copy.infrastructure.internalNotes} rows={2} className="rounded-md border px-2 py-1.5" />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
              Save domain
            </button>
          </form>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Register hosting</h2>
          <form action={adminRegisterHostingAction} className="flex flex-col gap-2 text-sm">
            <select name="customerAccountId" required className="rounded-md border px-2 py-1.5">
              <option value="">Customer</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <input name="providerId" defaultValue="manual" className="rounded-md border px-2 py-1.5" />
            <input name="planLabel" placeholder={copy.infrastructure.plan} className="rounded-md border px-2 py-1.5" />
            <input name="primaryDomain" placeholder={copy.infrastructure.primaryDomain} className="rounded-md border px-2 py-1.5" />
            <input name="externalProviderRef" placeholder={copy.infrastructure.externalRef} className="rounded-md border px-2 py-1.5" />
            <input name="renewsAt" type="date" className="rounded-md border px-2 py-1.5" />
            <textarea name="notes" placeholder={copy.infrastructure.customerNotes} rows={2} className="rounded-md border px-2 py-1.5" />
            <textarea name="internalNotes" placeholder={copy.infrastructure.internalNotes} rows={2} className="rounded-md border px-2 py-1.5" />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
              Save hosting
            </button>
          </form>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Register business email</h2>
          <form action={adminRegisterEmailAction} className="flex flex-col gap-2 text-sm">
            <select name="customerAccountId" required className="rounded-md border px-2 py-1.5">
              <option value="">Customer</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
            <input name="providerId" defaultValue="manual" className="rounded-md border px-2 py-1.5" />
            <input name="planLabel" placeholder={copy.infrastructure.plan} className="rounded-md border px-2 py-1.5" />
            <input name="mailboxCount" type="number" min={0} defaultValue={0} className="rounded-md border px-2 py-1.5" />
            <input name="renewsAt" type="date" className="rounded-md border px-2 py-1.5" />
            <input name="externalProviderRef" placeholder={copy.infrastructure.externalRef} className="rounded-md border px-2 py-1.5" />
            <textarea name="internalNotes" placeholder={copy.infrastructure.internalNotes} rows={2} className="rounded-md border px-2 py-1.5" />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-primary-foreground">
              Save email
            </button>
          </form>
        </section>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Hosting ({data.hosting.length})</h2>
      {data.hosting.length === 0 ? (
        <EmptyState title={copy.infrastructure.emptyHosting} body={copy.infrastructure.emptyHostingBody} />
      ) : (
        <ul className="mb-8 flex flex-col gap-2 text-sm">
          {data.hosting.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">
                  {h.publicId} · {h.customerAccount.businessName}
                </p>
                <p className="text-muted-foreground">{h.planLabel ?? h.providerId}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={h.status} />
                <form action={adminMarkSyncRequestedFormAction}>
                  <input type="hidden" name="assetType" value="HOSTING" />
                  <input type="hidden" name="assetId" value={h.id} />
                  <button type="submit" className="text-xs text-primary underline">
                    Mark sync ready
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 text-lg font-semibold">Domains ({data.domains.length})</h2>
      <ul className="mb-8 flex flex-col gap-2 text-sm">
        {data.domains.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="font-medium">
                {d.domainName} · {d.customerAccount.businessName}
              </p>
              <p className="text-muted-foreground">{d.publicId}</p>
            </div>
            <form action={adminMarkSyncRequestedFormAction}>
              <input type="hidden" name="assetType" value="DOMAIN" />
              <input type="hidden" name="assetId" value={d.id} />
              <button type="submit" className="text-xs text-primary underline">
                Mark sync ready
              </button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-lg font-semibold">Business email ({data.email.length})</h2>
      <ul className="mb-8 flex flex-col gap-2 text-sm">
        {data.email.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="font-medium">
                {e.publicId} · {e.customerAccount.businessName}
              </p>
              <p className="text-muted-foreground">{e.planLabel ?? e.providerId}</p>
            </div>
            <form action={adminMarkSyncRequestedFormAction}>
              <input type="hidden" name="assetType" value="EMAIL" />
              <input type="hidden" name="assetId" value={e.id} />
              <button type="submit" className="text-xs text-primary underline">
                Mark sync ready
              </button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-lg font-semibold">Infrastructure support requests</h2>
      {data.infrastructureSupport.length === 0 ? (
        <EmptyState title={copy.infrastructure.emptyTickets} body={copy.infrastructure.emptyTicketsBody} />
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {data.infrastructureSupport.map((t) => (
            <li key={t.id} className="rounded-lg border p-3">
              <p className="font-medium">{t.subject}</p>
              <p className="text-muted-foreground">{t.customerAccount.businessName}</p>
              <StatusBadge label={t.status} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-xs text-muted-foreground">Locale: {locale}. Credential vault not enabled in Batch 12.</p>
    </>
  )
}
