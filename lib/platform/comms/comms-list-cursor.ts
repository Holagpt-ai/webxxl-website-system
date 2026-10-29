import type { CommsResult } from '@/lib/platform/comms/types'

/** Matches SQL order: lastActivityAt DESC NULLS LAST, updatedAt DESC, id ASC. */
export type CommsListCursorPayload = {
  la: string | null
  u: number
  i: string
}

type LegacyCommsListCursorPayload = {
  t: number
  i: string
}

export function encodeCommsListCursor(payload: CommsListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function isLegacyPayload(parsed: unknown): parsed is LegacyCommsListCursorPayload {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  return typeof p.t === 'number' && typeof p.i === 'string' && p.la === undefined
}

export function decodeCommsListCursor(raw: string): CommsResult<CommsListCursorPayload> {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    if (isLegacyPayload(parsed)) {
      if (!Number.isFinite(parsed.t) || !parsed.i.trim()) {
        return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
      }
      return { ok: true, value: { la: null, u: parsed.t, i: parsed.i } }
    }
    const payload = parsed as CommsListCursorPayload
    if (
      !payload ||
      (payload.la !== null && typeof payload.la !== 'string') ||
      typeof payload.u !== 'number' ||
      typeof payload.i !== 'string'
    ) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    if (!Number.isFinite(payload.u) || !payload.i.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    if (payload.la != null && Number.isNaN(new Date(payload.la).getTime())) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    return { ok: true, value: payload }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
  }
}
