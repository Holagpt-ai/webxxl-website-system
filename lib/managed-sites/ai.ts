import type { CapabilityDefinition } from '@/lib/managed-sites/capabilities'
import { getCapabilityDefinition } from '@/lib/managed-sites/capabilities'

export type ManagedSiteChangeDraft = {
  capabilityKey: string
  requestText: string
  structuredPayload: Record<string, unknown> | null
  source: 'deterministic' | 'future_model'
}

export type ManagedSiteValidationResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: 'unknown' | 'invalid' | 'unsupported_editor' }

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'adapterKey', 'executionMode', 'customerAccountId'])

/** Deterministic payload check. No model is involved. */
export function validateManagedSiteChangePayload(
  capabilityKey: string,
  payload: unknown,
): ManagedSiteValidationResult {
  const definition = getCapabilityDefinition(capabilityKey)
  if (!definition) return { ok: false, error: 'unknown' }
  if (definition.editorFields.length === 0) return { ok: false, error: 'unsupported_editor' }
  if (!isPlainObject(payload)) return { ok: false, error: 'invalid' }
  const allowed = new Set(definition.editorFields)
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED_KEYS.has(key) || !allowed.has(key)) return { ok: false, error: 'invalid' }
    if (typeof value === 'string' && value.length > 2000) return { ok: false, error: 'invalid' }
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
      next[key] = value
      continue
    }
    return { ok: false, error: 'invalid' }
  }
  return { ok: true, payload: next }
}

export interface ManagedSiteChangeValidator {
  validate(capability: CapabilityDefinition, payload: unknown): ManagedSiteValidationResult
}

export interface ManagedSiteChangeExecutor {
  execute(input: { capabilityKey: string; payload: Record<string, unknown> }): Promise<{ ok: false; reason: 'llm_not_connected' | 'unavailable' }>
}

export type ManagedSiteAiTransformResult = { available: false; reason: 'llm_not_connected' }

/** Provider-neutral placeholder. Batch 4 does not call an LLM. */
export function transformManagedSiteRequest(_input: {
  capabilityKey: string
  requestText: string
}): ManagedSiteAiTransformResult {
  return { available: false, reason: 'llm_not_connected' }
}

export const managedSiteChangeValidator: ManagedSiteChangeValidator = {
  validate(capability, payload) {
    return validateManagedSiteChangePayload(capability.key, payload)
  },
}

export const managedSiteChangeExecutor: ManagedSiteChangeExecutor = {
  async execute() {
    return { ok: false, reason: 'llm_not_connected' }
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
