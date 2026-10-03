import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Dashboard session management (server-only).
 *
 * v1: single admin user, credentials from env:
 *   DASHBOARD_ADMIN_EMAIL
 *   DASHBOARD_ADMIN_PASSWORD_SHA256  (hex sha256 of the password)
 *   DASHBOARD_SESSION_SECRET         (random string for signing cookies)
 *
 * Upgrade path: replace verifyCredentials() with a call to your user store
 * (Supabase Auth, a VPS-hosted API, etc.). The session cookie format stays.
 */

const COOKIE_NAME = 'webxxl_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function sessionSecret(): string {
  const s = process.env.DASHBOARD_SESSION_SECRET
  if (!s) throw new Error('DASHBOARD_SESSION_SECRET is not set')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('hex')
}

export type Session = { email: string; expiresAt: number } | null

export async function createSession(email: string): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000
  const payload = `${email}.${expiresAt}`
  const token = `${payload}.${sign(payload)}`
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function getSession(): Promise<Session> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  // token format: <email>.<expiresAt>.<signature> — split from the right
  // because emails can contain dots.
  const lastDot = token.lastIndexOf('.')
  const secondLastDot = token.lastIndexOf('.', lastDot - 1)
  if (lastDot <= 0 || secondLastDot <= 0) return null
  const email = token.slice(0, secondLastDot)
  const expiresAtRaw = token.slice(secondLastDot + 1, lastDot)
  const signature = token.slice(lastDot + 1)
  const payload = `${email}.${expiresAtRaw}`
  const expected = sign(payload)
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null
  return { email, expiresAt }
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** v1 credential check — swap for a real user store when clients onboard. */
export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.DASHBOARD_ADMIN_EMAIL
  const adminHash = process.env.DASHBOARD_ADMIN_PASSWORD_SHA256
  if (!adminEmail || !adminHash) return false
  if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) return false
  const inputHash = sha256hex(password)
  try {
    return timingSafeEqual(Buffer.from(inputHash), Buffer.from(adminHash.toLowerCase()))
  } catch {
    return false
  }
}
