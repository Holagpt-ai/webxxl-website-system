import { getPageContext } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { businessCenterEn, type BusinessCenterCopy } from '@/lib/i18n/dictionaries/business-center-en'
import { businessCenterEs } from '@/lib/i18n/dictionaries/business-center-es'

export function getBusinessCopy(locale: string): BusinessCenterCopy {
  return locale === 'es' ? businessCenterEs : businessCenterEn
}

/** The account comes from the session membership; the browser never chooses it. */
export async function getBusinessPageProps(params: Promise<{ locale: string }>) {
  const { locale } = await getPageContext(params)
  const portal = await requireCustomerMembership()
  return {
    accountId: portal.customerAccount.id,
    locale: locale as Locale,
    copy: getBusinessCopy(locale),
  }
}

export type BusinessViewProps = Awaited<ReturnType<typeof getBusinessPageProps>>
