'use server'

import { signIn, signOut } from '@/auth'
import { isAuthEmailConfigured } from '@/lib/integrations/email'
import { MAGIC_LINK_REDIRECT, MAGIC_LINK_REDIRECT_ADMIN } from '@/lib/portal/auth-redirect'
import { isStaffRole } from '@/lib/admin/roles'
import { prisma } from '@/lib/db'
import type { Locale } from '@/lib/i18n/config'
import { resolveSignInLocale } from '@/lib/i18n/preference'

export type MagicLinkResult = { ok: true } | { ok: false; reason: 'invalid' | 'not_configured' | 'not_invited' | 'failed' }

export async function requestMagicLinkAction(email: string, redirectTo: string): Promise<MagicLinkResult> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, reason: 'invalid' }
  }
  if (!isAuthEmailConfigured()) return { ok: false, reason: 'not_configured' }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { memberships: { take: 1 } },
  })
  // Same success shape as a real send so the response does not reveal whether the address exists.
  if (!user || (user.role === 'CUSTOMER' && user.memberships.length === 0)) {
    return { ok: true }
  }

  try {
    const staff = isStaffRole(user.role)
    const pageLocale: Locale = redirectTo.includes('/es') ? 'es' : 'en'
    const locale = resolveSignInLocale(pageLocale, user.preferredLocale)
    if (pageLocale === 'es' && user.id && user.preferredLocale !== 'es') {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { preferredLocale: 'es' } })
      } catch {
        // The sign-in link still sends if the preference write is unavailable.
      }
    }
    const redirectTarget = staff ? MAGIC_LINK_REDIRECT_ADMIN[locale] : MAGIC_LINK_REDIRECT[locale]
    // Auth.js v5 reads redirectTo. callbackUrl is ignored and the magic link falls back to the login Referer.
    await signIn('email', {
      email: normalized,
      redirect: false,
      redirectTo: redirectTarget,
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' })
}
