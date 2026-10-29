import type { SeoResult } from '@/lib/platform/seo/types'

export type SeoListCursorPayload = {
  p: number
  i: string
}

export function encodeSeoListCursor(payload: SeoListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeSeoListCursor(raw: string): SeoResult<SeoListCursorPayload> {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as SeoListCursorPayload
    if (!parsed || typeof parsed.p !== 'number' || typeof parsed.i !== 'string') {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    if (!Number.isFinite(parsed.p) || !parsed.i.trim()) {
      return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
    }
    return { ok: true, value: { p: parsed.p, i: parsed.i } }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid cursor' }
  }
}
