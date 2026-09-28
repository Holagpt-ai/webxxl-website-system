import { defaultLocale, isLocale, type Locale } from './config'

/** A value translated per locale. English is required and used as fallback. */
export type Localized<T = string> = { en: T } & Partial<Record<Locale, T>>

export function t<T>(value: Localized<T>, locale: Locale): T {
  return value[locale] ?? value.en
}

export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

const EXTERNAL = /^(https?:|mailto:|tel:|#)/

/** Build a locale-aware href. Default locale has no prefix: /pricing, /es/pricing. */
export function localizePath(locale: Locale, path = '/'): string {
  if (EXTERNAL.test(path)) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  if (locale === defaultLocale) return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

/** Split a pathname into locale + unprefixed path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split('/')
  if (isLocale(first) && first !== defaultLocale) {
    return { locale: first, path: `/${rest.join('/')}`.replace(/\/$/, '') || '/' }
  }
  return { locale: defaultLocale, path: pathname || '/' }
}
