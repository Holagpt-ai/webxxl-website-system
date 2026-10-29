import type { CommsResult } from '@/lib/platform/comms/types'

/** Activity timestamp ms + mapping id for stable conversation list paging. */
export type CommsListCursorPayload = {
  t: number
  i: string
}

export function encodeCommsListCursor(payload: CommsListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCommsListCursor(raw: string): CommsResult<CommsListCursorPayload> {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as CommsListCursorPayload
    if (!parsed || typeof parsed.t !== 'number' || typeof parsed.i !== 'string') {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    if (!Number.isFinite(parsed.t) || !parsed.i.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    return { ok: true, value: { t: parsed.t, i: parsed.i } }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
  }
}
