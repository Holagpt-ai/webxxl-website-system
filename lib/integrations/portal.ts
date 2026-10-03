/**
 * INTEGRATION BOUNDARY — Client portal.
 * When the portal is live, set NEXT_PUBLIC_CLIENT_PORTAL_URL and every
 * "Client Login" entry will link to it. Until then it points at the public /login shell.
 */
export const clientPortalHref = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || '/login'

export const isPortalLive = Boolean(process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL)

export type SignInRequest = { email: string; password: string }
export type SignInResult = { ok: true; redirectTo: string } | { ok: false; reason: 'unavailable' | 'invalid' }

export { signInAction as signIn } from '@/app/[locale]/login/actions'
