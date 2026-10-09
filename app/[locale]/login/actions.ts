'use server'

import { signIn, signOut } from '@/auth'
import { isAuthEmailConfigured } from '@/lib/integrations/email'
import { prisma } from '@/lib/db'

export type MagicLinkResult = { ok: true } | { ok: false; reason: 'invalid' | 'not_configured' | 'not_invited' | 'failed' }

export async function requestMagicLinkAction(email: string, callbackUrl: string): Promise<MagicLinkResult> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, reason: 'invalid' }
  }
  if (!isAuthEmailConfigured()) return { ok: false, reason: 'not_configured' }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { memberships: { take: 1 } },
  })
  if (!user || (user.role === 'CUSTOMER' && user.memberships.length === 0)) {
    return { ok: true }
  }

  try {
    await signIn('email', { email: normalized, redirect: false, callbackUrl })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' })
}
