import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import { homePage } from '@/content/pages'
import { resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/blocks/breadcrumbs'
import { CtaBand } from '@/components/blocks/cta-band'
import { HomeHero } from '@/components/home/home-hero'
import {
  HomeCaseStudies,
  HomeCrm,
  HomeHosting,
  HomeIndustries,
  HomePricing,
  HomeProcess,
  HomeServices,
} from '@/components/home/home-sections'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/', title: t(homePage.seoTitle, locale) })
}

export default async function HomePage({ params }: Props) {
  const locale = await resolveLocale(params)
  return (
    <>
      <HomeHero locale={locale} />
      <HomeServices locale={locale} />
      <HomeIndustries locale={locale} />
      <HomeCrm locale={locale} />
      <HomeHosting locale={locale} />
      <HomeProcess locale={locale} />
      <HomeCaseStudies locale={locale} />
      <HomePricing locale={locale} />
      <CtaBand locale={locale} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteConfig.name,
          url: siteConfig.url,
          ...(siteConfig.email ? { email: siteConfig.email } : {}),
          description: t(siteConfig.defaultDescription, locale),
        }}
      />
    </>
  )
}
