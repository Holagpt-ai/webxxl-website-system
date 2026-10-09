/** Post-verification destinations. English is unprefixed; Spanish keeps the /es prefix. */
export const MAGIC_LINK_REDIRECT = {
  en: '/dashboard',
  es: '/es/dashboard',
} as const

export type MagicLinkRedirect = (typeof MAGIC_LINK_REDIRECT)[keyof typeof MAGIC_LINK_REDIRECT]

export function magicLinkRedirectForLocale(locale: string): MagicLinkRedirect {
  return locale === 'es' ? MAGIC_LINK_REDIRECT.es : MAGIC_LINK_REDIRECT.en
}

/** Allow only the two portal destinations so a caller cannot supply an open redirect. */
export function resolveMagicLinkRedirect(redirectTo: string): MagicLinkRedirect {
  return redirectTo === MAGIC_LINK_REDIRECT.es ? MAGIC_LINK_REDIRECT.es : MAGIC_LINK_REDIRECT.en
}
