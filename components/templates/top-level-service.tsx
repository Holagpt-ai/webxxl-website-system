import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getService } from '@/content/services'
import { resolveLocale } from '@/lib/i18n/server'
import { ServicePage, serviceMetadata } from './service-page'

type Params = Promise<{ locale: string }>

/** Builds the route exports for services that live at a top-level path (/crm, /hosting, /domains). */
export function createTopLevelServiceRoute(slug: string) {
  async function load(params: Params) {
    const locale = await resolveLocale(params)
    const service = getService(slug)
    if (!service) notFound()
    return { locale, service }
  }

  async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale, service } = await load(params)
    return serviceMetadata(service, locale)
  }

  async function Page({ params }: { params: Params }) {
    const { locale, service } = await load(params)
    return <ServicePage service={service} locale={locale} />
  }

  return { generateMetadata, Page }
}
