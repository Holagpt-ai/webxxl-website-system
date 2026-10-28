import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { crmWorkspaceEn, type CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { crmWorkspaceEs } from '@/lib/i18n/dictionaries/crm-workspace-es'

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
  return { accountId: portal.customerAccount.id, locale, copy: getCrmCopy(locale), base: crmBase(locale) }
}

export type CrmViewProps = Awaited<ReturnType<typeof getCrmPageProps>>
