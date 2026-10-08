/**
 * INTEGRATION BOUNDARY — Client portal.
 * Customer authentication uses magic links via /login → /dashboard.
 */
export const clientPortalHref = '/login'

export const isPortalLive = true

export type SignInRequest = { email: string }
export type SignInResult = { ok: true; redirectTo: string } | { ok: false; reason: 'unavailable' | 'invalid' }

/** @deprecated Use login server actions — kept for compatibility. */
export async function signIn(_request: SignInRequest): Promise<SignInResult> {
  return { ok: false, reason: 'unavailable' }
}
