import { ANALYTICS_CAPTURE_MAX_BODY_BYTES } from '@/config/analytics-backend'
import { isApprovedCaptureEventKey } from '@/lib/platform/analytics/capture/event-keys'

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'email',
  'phone',
  'name',
  'message',
  'body',
  'formData',
  'formFields',
  'medical',
  'diagnosis',
  'ssn',
  'dob',
  'dateOfBirth',
])

export type CaptureEventBody = {
  eventKey?: unknown
  occurredAt?: unknown
  consentGranted?: unknown
  consentVersion?: unknown
  sessionRef?: unknown
  visitorRef?: unknown
  pagePath?: unknown
  customConversionKey?: unknown
  metadata?: unknown
}

export type ValidatedCaptureEvent = {
  eventKey: string
  occurredAt: Date
  consentGranted: boolean
  consentVersion: string | null
  sessionRef: string | null
  visitorRef: string | null
  pagePath: string | null
  customConversionKey: string | null
  metadata: Record<string, string | number | boolean | null> | null
}

export type CaptureValidationError =
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_JSON'
  | 'VALIDATION'
  | 'FORBIDDEN_FIELD'
  | 'UNSUPPORTED_EVENT'

function asTrimmedString(value: unknown, maxLen: number): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLen) return null
  return trimmed
}

function sanitizeMetadata(value: unknown): Record<string, string | number | boolean | null> | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) return null
    if (key.length > 64) continue
    if (typeof raw === 'string') {
      if (raw.length > 256) continue
      out[key] = raw
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw
    } else if (typeof raw === 'boolean') {
      out[key] = raw
    } else if (raw === null) {
      out[key] = null
    }
  }
  return Object.keys(out).length ? out : null
}

export function validateCaptureEventPayload(input: {
  rawBody: string
  parsed: CaptureEventBody
}): { ok: true; value: ValidatedCaptureEvent } | { ok: false; code: CaptureValidationError; message: string } {
  if (Buffer.byteLength(input.rawBody, 'utf8') > ANALYTICS_CAPTURE_MAX_BODY_BYTES) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds capture limit' }
  }
  const eventKey = asTrimmedString(input.parsed.eventKey, 64)
  if (!eventKey) {
    return { ok: false, code: 'VALIDATION', message: 'eventKey is required' }
  }
  const customConversionKey = asTrimmedString(input.parsed.customConversionKey, 64)
  if (!isApprovedCaptureEventKey({ eventKey, customConversionKey })) {
    return { ok: false, code: 'UNSUPPORTED_EVENT', message: 'Event class is not approved for capture' }
  }
  if (input.parsed.metadata && typeof input.parsed.metadata === 'object') {
    for (const key of Object.keys(input.parsed.metadata as Record<string, unknown>)) {
      if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) {
        return { ok: false, code: 'FORBIDDEN_FIELD', message: 'Payload must not include sensitive form content' }
      }
    }
  }
  const occurredRaw = input.parsed.occurredAt
  let occurredAt: Date
  if (occurredRaw == null) {
    occurredAt = new Date()
  } else if (typeof occurredRaw === 'string') {
    occurredAt = new Date(occurredRaw)
  } else {
    return { ok: false, code: 'VALIDATION', message: 'occurredAt must be an ISO-8601 string when provided' }
  }
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false, code: 'VALIDATION', message: 'occurredAt is invalid' }
  }
  const now = Date.now()
  if (occurredAt.getTime() > now + 5 * 60_000) {
    return { ok: false, code: 'VALIDATION', message: 'occurredAt cannot be far in the future' }
  }
  if (occurredAt.getTime() < now - 30 * 24 * 60 * 60_000) {
    return { ok: false, code: 'VALIDATION', message: 'occurredAt is too far in the past' }
  }
  const consentGranted = input.parsed.consentGranted === true
  if (!consentGranted) {
    return { ok: false, code: 'VALIDATION', message: 'consentGranted must be true for capture' }
  }
  const metadata = sanitizeMetadata(input.parsed.metadata)
  if (input.parsed.metadata != null && metadata == null && typeof input.parsed.metadata === 'object') {
    return { ok: false, code: 'FORBIDDEN_FIELD', message: 'metadata contains disallowed values' }
  }
  return {
    ok: true,
    value: {
      eventKey,
      occurredAt,
      consentGranted,
      consentVersion: asTrimmedString(input.parsed.consentVersion, 32),
      sessionRef: asTrimmedString(input.parsed.sessionRef, 128),
      visitorRef: asTrimmedString(input.parsed.visitorRef, 128),
      pagePath: asTrimmedString(input.parsed.pagePath, 512),
      customConversionKey,
      metadata,
    },
  }
}
