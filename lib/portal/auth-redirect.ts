/** Post-verification destinations. English is unprefixed; Spanish keeps the /es prefix. */
export const MAGIC_LINK_REDIRECT = {
  en: '/dashboard',
  es: '/es/dashboard',
} as const

export const MAGIC_LINK_REDIRECT_ADMIN = {
  en: '/admin',
  es: '/es/admin',
} as const

export type MagicLinkRedirect = (typeof MAGIC_LINK_REDIRECT)[keyof typeof MAGIC_LINK_REDIRECT]

export function magicLinkRedirectForLocale(locale: string): MagicLinkRedirect {
  return locale === 'es' ? MAGIC_LINK_REDIRECT.es : MAGIC_LINK_REDIRECT.en
}

type AllowedRedirect =
  | (typeof MAGIC_LINK_REDIRECT)[keyof typeof MAGIC_LINK_REDIRECT]
  | (typeof MAGIC_LINK_REDIRECT_ADMIN)[keyof typeof MAGIC_LINK_REDIRECT_ADMIN]

/** Allow only known portal destinations so a caller cannot supply an open redirect. */
export function resolveMagicLinkRedirect(redirectTo: string): AllowedRedirect {
  if (redirectTo === MAGIC_LINK_REDIRECT.es) return MAGIC_LINK_REDIRECT.es
  if (redirectTo === MAGIC_LINK_REDIRECT_ADMIN.es) return MAGIC_LINK_REDIRECT_ADMIN.es
  if (redirectTo === MAGIC_LINK_REDIRECT_ADMIN.en) return MAGIC_LINK_REDIRECT_ADMIN.en
  return MAGIC_LINK_REDIRECT.en
}
