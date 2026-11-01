import {
  GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION,
  GOOGLE_READINESS_REQUEST_KEY_MAX_LENGTH,
  GOOGLE_READINESS_REQUEST_KEY_MIN_LENGTH,
} from '@/config/google-integration'
import { GOOGLE_ANALYTICS_PROVIDERS, type GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

const REQUEST_KEY_PATTERN = /^[\w.-]+$/

export function validateGoogleReadinessClientRequestKey(key: string | null | undefined): SeoResult<{ normalized: string }> {
  if (!key || !key.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key header required' }
  }
  const normalized = key.trim()
  if (normalized.length < GOOGLE_READINESS_REQUEST_KEY_MIN_LENGTH) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key too short' }
  }
  if (normalized.length > GOOGLE_READINESS_REQUEST_KEY_MAX_LENGTH) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key too long' }
  }
  if (!REQUEST_KEY_PATTERN.test(normalized)) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key contains invalid characters' }
  }
  if (normalized.startsWith('google-readiness:') || normalized.startsWith('analytics-sync:') || normalized.startsWith('analytics-worker:')) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency-Key must not reuse internal sync namespaces' }
  }
  return { ok: true, value: { normalized } }
}

export function parseGoogleReadinessProvidersBody(
  raw: unknown,
): SeoResult<{ providers: GoogleAnalyticsProviderKey[] }> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: { providers: [...GOOGLE_ANALYTICS_PROVIDERS] } }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, code: 'VALIDATION', message: 'providers must be an array' }
  }
  if (raw.length === 0) {
    return { ok: false, code: 'VALIDATION', message: 'providers must not be empty when provided' }
  }
  if (raw.length > GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: `At most ${GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION} providers per readiness operation`,
    }
  }
  const seen = new Set<string>()
  const providers: GoogleAnalyticsProviderKey[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, code: 'VALIDATION', message: 'Each provider must be a string' }
    }
    if (!GOOGLE_ANALYTICS_PROVIDERS.includes(item as GoogleAnalyticsProviderKey)) {
      return { ok: false, code: 'VALIDATION', message: `Unsupported provider ${item}` }
    }
    if (seen.has(item)) {
      return { ok: false, code: 'VALIDATION', message: 'Duplicate providers are not allowed' }
    }
    seen.add(item)
    providers.push(item as GoogleAnalyticsProviderKey)
  }
  return { ok: true, value: { providers } }
}
