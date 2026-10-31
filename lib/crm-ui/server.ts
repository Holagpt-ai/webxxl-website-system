import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { isStaffRole } from '@/lib/admin/roles'
import { crmWorkspaceEn, type CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { crmWorkspaceEs } from '@/lib/i18n/dictionaries/crm-workspace-es'
import { crmLeadsEn } from '@/lib/i18n/dictionaries/crm-leads-en'
import { crmLeadsEs } from '@/lib/i18n/dictionaries/crm-leads-es'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import type { ManagedSiteOption } from './workspace'

export function getCrmCopy(locale: string): CrmWorkspaceCopy {
  return locale === 'es' ? crmWorkspaceEs : crmWorkspaceEn
}

export function crmBase(locale: string) {
  return localizePath(locale as Locale, '/dashboard/crm')
}

/** The account comes from the session membership, never from the client. */
export async function getCrmPageProps(params: Promise<{ locale: string }>) {
  const { locale } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  // Mirrors the backend `crm.consent.manage` rule (owner or staff). Only decides which links are shown.
  const canManage = portal.membership.role === 'OWNER' || isStaffRole(portal.role)
  return { accountId: portal.customerAccount.id, locale, copy: getCrmCopy(locale), base: crmBase(locale), canManage }
}

export type CrmViewProps = Awaited<ReturnType<typeof getCrmPageProps>>

/**
 * Sites come from the managed-sites query so the website filter shows real names only.
 * A lead whose site is not in this list is shown by its reference, never by an inferred name.
 */
export async function getCrmLeadsPageProps(params: Promise<{ locale: string }>) {
  const props = await getCrmPageProps(params)
  const sites: ManagedSiteOption[] = (await listManagedSitesForAccount(props.accountId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((s) => ({ id: s.id, name: s.name, domain: s.domain ?? null }))
  return { ...props, leadsCopy: props.locale === 'es' ? crmLeadsEs : crmLeadsEn, sites }
}

export type CrmLeadsViewProps = Awaited<ReturnType<typeof getCrmLeadsPageProps>>
