import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'
import type { CrmResult } from '@/lib/platform/crm/types'

export const CRM_CONSENT_CHANNELS: readonly CrmConsentChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'VOICE']
export const CRM_CONSENT_PURPOSES: readonly CrmConsentPurpose[] = ['MARKETING', 'TRANSACTIONAL']
export const CRM_CONSENT_WRITE_STATUSES: readonly CrmConsentStatus[] = ['GRANTED', 'REVOKED']

function isEnumValue<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}

export type ParsedConsentRecordInput = {
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  status: CrmConsentStatus
  source: string
  capturedAt: Date
  termsVersion?: string
  idempotencyKey?: string
  evidence?: { evidenceRef: string; detail?: Record<string, unknown> }[]
}

export function parseConsentRecordInput(body: {
  channel?: string
  purpose?: string
  status?: string
  source?: string
  capturedAt?: string
  termsVersion?: string
  idempotencyKey?: string
  evidence?: { evidenceRef?: string; detail?: Record<string, unknown> }[]
}): CrmResult<ParsedConsentRecordInput> {
  if (!body.channel || !isEnumValue(CRM_CONSENT_CHANNELS, body.channel)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid or missing channel' }
  }
  if (!body.purpose || !isEnumValue(CRM_CONSENT_PURPOSES, body.purpose)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid or missing purpose' }
  }
  if (!body.status || !isEnumValue(CRM_CONSENT_WRITE_STATUSES, body.status)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid or missing status' }
  }
  if (!body.source?.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'source required' }
  }
  if (!body.capturedAt) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'capturedAt required' }
  }
  const capturedAt = new Date(body.capturedAt)
  if (Number.isNaN(capturedAt.getTime())) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid capturedAt' }
  }
  const evidence = body.evidence?.map((row) => ({
    evidenceRef: row.evidenceRef?.trim() ?? '',
    detail: row.detail,
  }))
  if (evidence?.some((row) => !row.evidenceRef)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'evidenceRef required for each evidence row' }
  }
  return {
    ok: true,
    value: {
      channel: body.channel,
      purpose: body.purpose,
      status: body.status,
      source: body.source.trim(),
      capturedAt,
      termsVersion: body.termsVersion?.trim() || undefined,
      idempotencyKey: body.idempotencyKey?.trim() || undefined,
      evidence,
    },
  }
}

export function parseSuppressionRecordInput(body: {
  channel?: string
  purpose?: string
  reason?: string
  source?: string
  idempotencyKey?: string
}): CrmResult<{
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  reason: string
  source: string
  idempotencyKey?: string
}> {
  if (!body.channel || !isEnumValue(CRM_CONSENT_CHANNELS, body.channel)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid or missing channel' }
  }
  if (!body.purpose || !isEnumValue(CRM_CONSENT_PURPOSES, body.purpose)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid or missing purpose' }
  }
  if (!body.reason?.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'reason required' }
  }
  if (!body.source?.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'source required' }
  }
  return {
    ok: true,
    value: {
      channel: body.channel,
      purpose: body.purpose,
      reason: body.reason.trim(),
      source: body.source.trim(),
      idempotencyKey: body.idempotencyKey?.trim() || undefined,
    },
  }
}
