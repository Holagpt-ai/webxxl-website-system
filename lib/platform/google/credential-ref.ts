import type { SeoResult } from '@/lib/platform/seo/types'

const FORBIDDEN_SECRET_PATTERNS = [/Bearer\s+/i, /^ya29\./, /^1\/\//, /^AIza/]

/** Opaque credential handles only — never accept raw OAuth tokens in connection rows. */
export function validateGoogleOAuthSecretRef(secretRef: string | null | undefined): SeoResult<{ configured: boolean }> {
  if (!secretRef || !secretRef.trim()) {
    return { ok: true, value: { configured: false } }
  }
  const trimmed = secretRef.trim()
  if (trimmed.length > 256) {
    return { ok: false, code: 'VALIDATION', message: 'Google OAuth secret reference too long' }
  }
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, code: 'VALIDATION', message: 'Raw OAuth material must not be stored as secretRef' }
    }
  }
  return { ok: true, value: { configured: true } }
}
