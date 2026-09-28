/**
 * Locale registry. To add a locale (e.g. "fr"):
 * 1. Add an entry below.
 * 2. Add a dictionary in lib/i18n/dictionaries/fr.ts and register it in lib/i18n/dictionaries/index.ts.
 * 3. Optionally add `fr` values to Localized content; missing values fall back to English.
 */
export const locales = [
  { code: 'en', label: 'English', shortLabel: 'EN', htmlLang: 'en', ogLocale: 'en_US' },
  { code: 'es', label: 'Español', shortLabel: 'ES', htmlLang: 'es', ogLocale: 'es_US' },
] as const

export type Locale = (typeof locales)[number]['code']
export type LocaleConfig = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeCodes: Locale[] = locales.map((l) => l.code)

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (localeCodes as string[]).includes(value)
}

export function getLocaleConfig(code: Locale): LocaleConfig {
  return locales.find((l) => l.code === code) ?? locales[0]
}
