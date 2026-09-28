import { notFound } from 'next/navigation'
import { isLocale, localeCodes, type Locale } from './config'
import { getDictionary } from './dictionaries'

export type LocaleParams = Promise<{ locale: string }>

export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return locale
}

export async function getPageContext(params: Promise<{ locale: string }>) {
  const locale = await resolveLocale(params)
  return { locale, dict: getDictionary(locale) }
}

export function localeStaticParams() {
  return localeCodes.map((locale) => ({ locale }))
}
