import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getService, getServices } from '@/content/services'
import { localeCodes } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { topLevelServices } from '@/lib/routes'
import { ServicePage, serviceMetadata } from '@/components/templates/service-page'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return localeCodes.flatMap((locale) =>
    getServices()
      .filter((s) => !topLevelServices[s.slug])
      .map((s) => ({ locale, slug: s.slug })),
  )
}

async function load(params: Props['params']) {
  const locale = await resolveLocale(params)
  const { slug } = await params
  const service = getService(slug)
  if (!service || topLevelServices[slug]) notFound()
  return { locale, service }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, service } = await load(params)
  return serviceMetadata(service, locale)
}

export default async function SolutionDetailPage({ params }: Props) {
  const { locale, service } = await load(params)
  const dict = getDictionary(locale)
  return <ServicePage service={service} locale={locale} parent={{ label: dict.nav.solutions, href: '/solutions' }} />
}
