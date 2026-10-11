import type { AiContentDraftAction, AiContentDraftV1 } from '@/lib/managed-sites/ai/types'

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'adapterKey', 'executionMode', 'customerAccountId'])
const ACTIONS = new Set<AiContentDraftAction>(['replace', 'rewrite', 'add', 'remove'])

const LIMITS = {
  summary: 600,
  proposedChanges: 8,
  location: 120,
  proposedText: 1500,
  notes: 500,
  assumptions: 5,
  assumptionItem: 300,
  clarifyingQuestions: 5,
  questionItem: 300,
} as const

const ROOT_KEYS = new Set(['schemaVersion', 'summary', 'proposedChanges', 'assumptions', 'clarifyingQuestions'])
const CHANGE_KEYS = new Set(['location', 'action', 'proposedText', 'notes'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function readStringArray(value: unknown, maxItems: number, maxItem: number): string[] | null {
  if (!Array.isArray(value)) return null
  if (value.length > maxItems) return null
  const out: string[] = []
  for (const item of value) {
    const parsed = readString(item, maxItem)
    if (!parsed) return null
    out.push(parsed)
  }
  return out
}

/** Strict validation for untrusted model JSON. */
export function parseAiContentDraftV1(payload: unknown): AiContentDraftV1 | null {
  if (!isPlainObject(payload)) return null
  for (const key of Object.keys(payload)) {
    if (BLOCKED_KEYS.has(key) || !ROOT_KEYS.has(key)) return null
  }
  if (payload.schemaVersion !== 1) return null
  const summary = readString(payload.summary, LIMITS.summary)
  if (!summary) return null
  if (!Array.isArray(payload.proposedChanges) || payload.proposedChanges.length > LIMITS.proposedChanges) return null

  const proposedChanges: AiContentDraftV1['proposedChanges'] = []
  for (const item of payload.proposedChanges) {
    if (!isPlainObject(item)) return null
    for (const key of Object.keys(item)) {
      if (BLOCKED_KEYS.has(key) || !CHANGE_KEYS.has(key)) return null
    }
    const location = readString(item.location, LIMITS.location)
    const action = item.action
    if (!location || typeof action !== 'string' || !ACTIONS.has(action as AiContentDraftAction)) return null
    const proposedText = readString(item.proposedText, LIMITS.proposedText)
    if (!proposedText) return null
    let notes: string | undefined
    if (item.notes !== undefined) {
      const parsedNotes = readString(item.notes, LIMITS.notes)
      if (!parsedNotes) return null
      notes = parsedNotes
    }
    proposedChanges.push({ location, action: action as AiContentDraftAction, proposedText, ...(notes ? { notes } : {}) })
  }

  const assumptions = readStringArray(payload.assumptions, LIMITS.assumptions, LIMITS.assumptionItem)
  const clarifyingQuestions = readStringArray(
    payload.clarifyingQuestions,
    LIMITS.clarifyingQuestions,
    LIMITS.questionItem,
  )
  if (!assumptions || !clarifyingQuestions) return null

  return {
    schemaVersion: 1,
    summary,
    proposedChanges,
    assumptions,
    clarifyingQuestions,
  }
}

export function assertAiDraftHasNoBlockedKeys(payload: unknown): boolean {
  const json = JSON.stringify(payload)
  return (
    !/"adapterKey"\s*:/.test(json) &&
    !/"executionMode"\s*:/.test(json) &&
    !/"customerAccountId"\s*:/.test(json)
  )
}
