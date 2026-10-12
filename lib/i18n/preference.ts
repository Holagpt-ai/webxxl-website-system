import { defaultLocale, isLocale, type Locale } from './config'

/**
 * Individual portal language. Never read CustomerAccount.locale here —
 * organization locale is not a substitute for a person's preference.
 */
export function parsePreferredLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale
}

/**
 * The login page's non-default locale is an explicit choice for this request.
 * The unprefixed English login URL defers to the saved preference so the next
 * sign-in stays in the language the user selected in the portal.
 */
export function resolveSignInLocale(pageLocale: Locale, preferredLocale: string | null | undefined): Locale {
  if (pageLocale !== defaultLocale) return pageLocale
  return parsePreferredLocale(preferredLocale)
}
