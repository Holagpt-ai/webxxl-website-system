import type { MktResult } from '@/lib/platform/marketing/types'

export type MktListCursorPayload = {
  c: string
  i: string
}

export function encodeMktListCursor(payload: MktListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeMktListCursor(raw: string): MktResult<MktListCursorPayload> {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as MktListCursorPayload
    if (!parsed || typeof parsed.c !== 'string' || typeof parsed.i !== 'string') {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    const createdAt = new Date(parsed.c)
    if (Number.isNaN(createdAt.getTime()) || !parsed.i.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    return { ok: true, value: { c: parsed.c, i: parsed.i } }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
  }
}
