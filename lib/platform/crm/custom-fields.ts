import { Prisma } from '@prisma/client'
import type { CrmResult } from '@/lib/platform/crm/types'

export const CRM_CUSTOM_FIELD_MAX_KEYS = 40
export const CRM_CUSTOM_FIELD_KEY_MAX = 64
export const CRM_CUSTOM_FIELD_STRING_MAX = 2048

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/

export type CrmCustomFieldScalar = string | number | boolean | null
export type CrmCustomFields = Record<string, CrmCustomFieldScalar>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCrmCustomFields(value: unknown): CrmResult<CrmCustomFields | null> {
  if (value === null) return { ok: true, value: null }
  if (!isPlainObject(value)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'customFields must be a JSON object or null' }
  }
  const keys = Object.keys(value)
  if (keys.length > CRM_CUSTOM_FIELD_MAX_KEYS) {
    return { ok: false, code: 'VALIDATION_ERROR', message: `customFields may have at most ${CRM_CUSTOM_FIELD_MAX_KEYS} keys` }
  }
  const parsed: CrmCustomFields = {}
  for (const key of keys) {
    if (key.length > CRM_CUSTOM_FIELD_KEY_MAX || !KEY_PATTERN.test(key)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: `Invalid customFields key: ${key}` }
    }
    const fieldValue = value[key]
    if (fieldValue === null) {
      parsed[key] = null
      continue
    }
    if (typeof fieldValue === 'boolean') {
      parsed[key] = fieldValue
      continue
    }
    if (typeof fieldValue === 'number') {
      if (!Number.isFinite(fieldValue)) {
        return { ok: false, code: 'VALIDATION_ERROR', message: `customFields.${key} must be a finite number` }
      }
      parsed[key] = fieldValue
      continue
    }
    if (typeof fieldValue === 'string') {
      if (fieldValue.length > CRM_CUSTOM_FIELD_STRING_MAX) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: `customFields.${key} exceeds ${CRM_CUSTOM_FIELD_STRING_MAX} characters`,
        }
      }
      parsed[key] = fieldValue
      continue
    }
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `customFields.${key} must be a string, number, boolean, or null`,
    }
  }
  return { ok: true, value: parsed }
}

export function customFieldsWriteValue(
  value: CrmCustomFields | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}
