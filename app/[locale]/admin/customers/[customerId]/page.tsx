import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomerDetail, getCustomerRecentActivity } from '@/lib/admin/queries'
import { deriveMembershipAccessState } from '@/lib/portal/customer-access'
import { PageTitle, SectionCard, StatusBadge } from '@/components/dashboard/primitives'
import { requireStaff, requireUser } from '@/lib/portal/authz'
import { isAdminRole } from '@/lib/admin/roles'
import { resolveLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format } from '@/lib/i18n/localize'
import { enumLabel, localizeStoredActivity } from '@/lib/i18n/labels'
import { getPortalModuleRegistry } from '@/lib/portal/modules'
import {
  InviteCustomerForm,
  CreateProjectForm,
  CustomerStatusForm,
  MembershipRowActions,
  ServiceToggleForm,
} from '@/components/admin/forms'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; customerId: string }> }

export default async function AdminCustomerDetailPage({ params }: Props) {
  await requireStaff()
  const user = await requireUser()
  const locale = await resolveLocale(params)
  const { customerId } = await params
  const customer = await getCustomerDetail(customerId)
  if (!customer) notFound()
  const activity = await getCustomerRecentActivity(customerId)
  const prefix = locale === 'es' ? '/es' : ''
  const dict = getDictionary(locale)
  const copy = dict.admin.customers
  const roleLabel = (role: string) =>
    role === 'ADMIN' ? dict.admin.roleAdmin : role === 'STAFF' ? dict.admin.roleStaff : role === 'CUSTOMER' ? dict.admin.roleCustomer : role
  const membershipRole = (role: string) => (role === 'OWNER' ? dict.admin.owner : role === 'MEMBER' ? dict.admin.member : role)
  const accessLabel = (state: string) =>
    state === 'ACTIVE' ? copy.accessActive : state === 'INVITED' ? copy.accessInvited : state === 'PENDING' ? copy.accessPending : state
  const serviceKeys = getPortalModuleRegistry()
    .filter((m) => m.entitlementRequired)
    .map((m) => m.entitlementRequired!)
  const serviceMap = new Map(customer.services.map((s) => [s.serviceKey, s]))

  return (
    <>
      <PageTitle title={customer.businessName} description={`/${customer.slug} · ${enumLabel(dict.dashboard.accountStatuses, customer.status)}`} />
      <div className="mb-6">
        <CustomerStatusForm customerId={customer.id} current={customer.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={copy.memberships}>
          <ul className="flex flex-col gap-4 text-sm">
            {customer.memberships.map((m) => {
              const accessState = deriveMembershipAccessState(m.user, m)
              return (
                <li key={m.id} className="flex flex-col gap-2 border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{m.user.email}</p>
                    <p className="text-muted-foreground">
                      {membershipRole(m.role)} · {copy.portalUserRole} {roleLabel(m.user.role)} · {accessLabel(accessState)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.user.emailVerified
                        ? format(copy.emailVerified, { date: m.user.emailVerified.toISOString().slice(0, 10) })
                        : copy.emailNotVerified}
                      {m.lastInviteSentAt
                        ? ` · ${format(copy.lastInvite, { date: m.lastInviteSentAt.toISOString().slice(0, 10) })}`
                        : ''}
                      {m.user.lastLoginAt ? ` · ${format(copy.lastSignIn, { date: m.user.lastLoginAt.toISOString().slice(0, 10) })}` : ''}
                    </p>
                  </div>
                  {isAdminRole(user.role) && (
                    <MembershipRowActions membershipId={m.id} role={m.role} resendLocale={locale === 'es' ? 'es' : 'en'} />
                  )}
                </li>
              )
            })}
          </ul>
          {isAdminRole(user.role) && (
            <div className="mt-4 border-t pt-4">
              <InviteCustomerForm customerId={customer.id} />
            </div>
          )}
        </SectionCard>

        <SectionCard title={copy.projects}>
          <CreateProjectForm customerAccountId={customer.id} />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {customer.projects.length === 0 ? (
              <p className="text-muted-foreground">{copy.noProjects}</p>
            ) : (
              customer.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`${prefix}/admin/projects/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                  <StatusBadge label={enumLabel(dict.dashboard.projectStatuses, p.status)} />
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>

      {isAdminRole(user.role) && (
        <SectionCard title={copy.services}>
          <ul className="flex flex-col gap-3 text-sm">
            {serviceKeys.map((key) => {
              const row = serviceMap.get(key)
              const status = row?.status ?? 'INACTIVE'
              return (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span>
                    {key} · <StatusBadge label={status} />
                  </span>
                  <ServiceToggleForm customerAccountId={customer.id} serviceKey={key} current={status} />
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}

      <SectionCard title={copy.recentActivity}>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.noActivity}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{localizeStoredActivity(a.summary, a.eventType, dict.dashboard.activityLabels)}</span>
                <span className="text-muted-foreground"> · {a.project.name}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  )
}
