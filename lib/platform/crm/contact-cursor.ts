import type { CrmResult } from '@/lib/platform/crm/types'

export type ContactListCursorPayload = {
  u: string
  i: string
}

export function encodeContactListCursor(payload: ContactListCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeContactListCursor(raw: string): CrmResult<ContactListCursorPayload> {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as ContactListCursorPayload
    if (!parsed || typeof parsed.u !== 'string' || typeof parsed.i !== 'string') {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid cursor' }
    }
    const updatedAt = new Date(parsed.u)
    if (Number.isNaN(updatedAt.getTime()) || !parsed.i.trim()) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid cursor' }
    }
    return { ok: true, value: { u: parsed.u, i: parsed.i } }
  } catch {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid cursor' }
  }
}
