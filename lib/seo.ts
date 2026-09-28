import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import { getLocaleConfig, locales, type Locale } from '@/lib/i18n/config'
import { localizePath, t } from '@/lib/i18n/localize'

type BuildMetadataInput = {
  locale: Locale
  path: string
  title?: string
  description?: string
  image?: string
  noIndex?: boolean
}

export function buildMetadata({ locale, path, title, description, image, noIndex }: BuildMetadataInput): Metadata {
  const url = localizePath(locale, path)
  const languages = Object.fromEntries(locales.map((l) => [l.htmlLang, localizePath(l.code, path)]))
  const resolvedTitle = title ?? t(siteConfig.defaultTitle, locale)
  const resolvedDescription = description ?? t(siteConfig.defaultDescription, locale)

  return {
    title: title ? { absolute: `${title} | ${siteConfig.name}` } : { absolute: resolvedTitle },
    description: resolvedDescription,
    alternates: { canonical: url, languages: { ...languages, 'x-default': localizePath('en', path) } },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      locale: getLocaleConfig(locale).ogLocale,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: resolvedTitle, description: resolvedDescription },
    robots: noIndex ? { index: false, follow: false } : undefined,
  }
}
