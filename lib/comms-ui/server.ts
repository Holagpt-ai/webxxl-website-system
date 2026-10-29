import { getPageContext } from '@/lib/i18n/server'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { commsWorkspaceEn, type CommsWorkspaceCopy } from '@/lib/i18n/dictionaries/comms-workspace-en'
import { commsWorkspaceEs } from '@/lib/i18n/dictionaries/comms-workspace-es'

export function getCommsCopy(locale: string): CommsWorkspaceCopy {
  return locale === 'es' ? commsWorkspaceEs : commsWorkspaceEn
}

export function commsBase(locale: string) {
  return localizePath(locale as Locale, '/dashboard/communications')
}

/** The account comes from the session membership; the browser never chooses it. */
export async function getCommsPageProps(params: Promise<{ locale: string }>) {
  const { locale } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  return {
    accountId: portal.customerAccount.id,
    locale,
    copy: getCommsCopy(locale),
    base: commsBase(locale),
    crmContactsBase: localizePath(locale as Locale, '/dashboard/crm/contacts'),
  }
}

export type CommsViewProps = Awaited<ReturnType<typeof getCommsPageProps>>
