'use server'

import { redirect } from 'next/navigation'
import { createSession, destroySession, verifyCredentials } from '@/lib/auth'
import type { SignInRequest, SignInResult } from '@/lib/integrations/portal'

/** Called by the login form. Sets the session cookie on success. */
export async function signInAction(request: SignInRequest): Promise<SignInResult> {
  const { email, password } = request
  if (!email || !password) return { ok: false, reason: 'invalid' }
  if (!verifyCredentials(email, password)) return { ok: false, reason: 'invalid' }
  await createSession(email.trim().toLowerCase())
  return { ok: true, redirectTo: '/dashboard' }
}

export async function signOutAction(): Promise<void> {
  await destroySession()
  redirect('/login')
}
