export const BUILTIN_CONVERSION_EVENT_KEYS = [
  'form_submit',
  'contact_request',
  'appointment_request',
  'qualified_lead',
] as const

export type BuiltinConversionEventKey = (typeof BUILTIN_CONVERSION_EVENT_KEYS)[number]

const BUILTIN_SET = new Set<string>(BUILTIN_CONVERSION_EVENT_KEYS)

export function isBuiltinConversionEventKey(key: string): key is BuiltinConversionEventKey {
  return BUILTIN_SET.has(key)
}

export function isApprovedCaptureEventKey(input: { eventKey: string; customConversionKey?: string | null }): boolean {
  if (isBuiltinConversionEventKey(input.eventKey)) return true
  if (input.eventKey === 'custom_conversion') {
    return typeof input.customConversionKey === 'string' && input.customConversionKey.length > 0
  }
  return false
}

export function resolveConversionKeyForEvent(input: {
  eventKey: string
  customConversionKey?: string | null
}): string | null {
  if (isBuiltinConversionEventKey(input.eventKey)) return input.eventKey
  if (input.eventKey === 'custom_conversion' && input.customConversionKey) {
    return input.customConversionKey
  }
  return null
}
