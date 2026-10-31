/**
 * Shared, browser-safe data layer for the Batch 16 customer workspaces (CRM, Marketing Studio, Local SEO).
 * It never imports `@/lib/platform/**`; only the JSON keys named in the Batch 16 contract are typed.
 */

export const WORKSPACE_STATE_KINDS = [
  'DISABLED',
  'POLICY_UNRESOLVED',
  'NOT_CONFIGURED',
  'PENDING_PILOT',
  'FORBIDDEN',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'QUOTA_EXCEEDED',
  'VALIDATION',
  'ERROR',
] as const

export type WorkspaceStateKind = (typeof WORKSPACE_STATE_KINDS)[number]

/** Backend kill switches. Social returns its gate as 403, so codes are checked before statuses. */
const BACKEND_GATE_CODES = new Set(['CRM_DISABLED', 'MKT_DISABLED', 'SEO_DISABLED', 'SOCIAL_MARKETING_DISABLED'])

export class WorkspaceError extends Error {
  constructor(
    readonly status: number,
    readonly kind: WorkspaceStateKind,
    readonly code: string | null,
    readonly detail: string | null,
  ) {
    super(detail ?? kind)
  }
}

export function classifyWorkspaceError(status: number, body: unknown): WorkspaceError {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const code = typeof record?.code === 'string' ? record.code : null
  const message = typeof record?.message === 'string' ? record.message : null

  let kind: WorkspaceStateKind
  if (code && BACKEND_GATE_CODES.has(code)) kind = 'DISABLED'
  else if (code === 'POLICY_UNRESOLVED') kind = 'POLICY_UNRESOLVED'
  else if (code === 'NOT_CONFIGURED') kind = 'NOT_CONFIGURED'
  else if (code === 'PENDING_PILOT' || status === 501) kind = 'PENDING_PILOT'
  else if (code === 'QUOTA_EXCEEDED' || status === 429) kind = 'QUOTA_EXCEEDED'
  else if (status === 401 || code === 'UNAUTHORIZED') kind = 'UNAUTHORIZED'
  // CRM import/export flags answer `403 FORBIDDEN` with "CRM import disabled" / "CRM export disabled".
  else if (status === 403) kind = message && /\bdisabled$/i.test(message) ? 'NOT_CONFIGURED' : 'FORBIDDEN'
  else if (status === 404 || code === 'NOT_FOUND') kind = 'NOT_FOUND'
  else if (status === 409 || code === 'CONFLICT') kind = 'ERROR'
  else if (status === 400 || code === 'VALIDATION' || code === 'VALIDATION_ERROR') kind = 'VALIDATION'
  else kind = 'ERROR'

  return new WorkspaceError(status, kind, code, message)
}

/** Some CRM/Marketing/SEO auth failures are not JSON. Never parse blindly. */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '')
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function workspaceGet<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' }, cache: 'no-store' })
  } catch {
    throw new WorkspaceError(0, 'ERROR', null, null)
  }
  const body = await readJson(res)
  if (!res.ok) throw classifyWorkspaceError(res.status, body)
  if (body === undefined) throw new WorkspaceError(res.status, 'ERROR', null, null)
  return body as T
}

export type MutationResult<T> = { ok: true; status: number; data: T } | { ok: false; error: WorkspaceError }

export async function workspaceSend<T>(
  url: string,
  body?: unknown,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  headers?: Record<string, string>,
): Promise<MutationResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    return { ok: false, error: new WorkspaceError(0, 'ERROR', null, null) }
  }
  const json = await readJson(res)
  if (!res.ok) return { ok: false, error: classifyWorkspaceError(res.status, json) }
  if (json === undefined) return { ok: false, error: new WorkspaceError(res.status, 'ERROR', null, null) }
  return { ok: true, status: res.status, data: json as T }
}

/** Gate errors apply to the whole workspace, so a page shows them once instead of per region. */
export function isGateError(error: unknown): error is WorkspaceError {
  return (
    error instanceof WorkspaceError &&
    (error.kind === 'DISABLED' || error.kind === 'POLICY_UNRESOLVED' || error.kind === 'UNAUTHORIZED')
  )
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

// ---------- Formatting ----------

export const DASH = '—'

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`))
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatNumber(value: number | null | undefined, locale: string, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

/** Rates arrive as fractions (0.034 is 3.4%). */
export function formatPercent(fraction: number | null | undefined, locale: string): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return DASH
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(fraction)
}

export function formatMoney(minor: number | null | undefined, currency: string, locale: string): string {
  if (minor === null || minor === undefined) return DASH
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`
  }
}

/** Looks up a translated enum label, falling back to a readable form of the raw value. */
export function enumLabel(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return DASH
  return map[value] ?? value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------- Shared copy shapes ----------

export type StateCopy = { title: string; body: string }

/**
 * Copy for the shared kit. `{workspace}` in any string is replaced with the workspace name.
 * Defined once per language in the CRM dictionaries and reused by the other two workspaces.
 */
export type WorkspaceKitCopy = {
  freeBadge: string
  freeBadgeLabel: string
  fairUse: string
  subnavLabel: string
  loading: string
  retry: string
  save: string
  saving: string
  cancel: string
  create: string
  creating: string
  open: string
  back: string
  optional: string
  saved: string
  notAvailable: string
  siteLabel: string
  noSites: StateCopy
  disconnected: StateCopy
  listCapped: string
  states: Record<WorkspaceStateKind, StateCopy>
}

export type ManagedSiteOption = { id: string; name: string; domain: string | null }
