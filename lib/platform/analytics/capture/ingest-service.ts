import { prisma } from '@/lib/db'
import { isAnalyticsFirstPartyCaptureEnabled } from '@/config/analytics-backend'
import { resolveConversionKeyForEvent } from '@/lib/platform/analytics/capture/event-keys'
import { checkCaptureRateLimit } from '@/lib/platform/analytics/capture/rate-limit'
import {
  resolveCaptureSecretMaterial,
  verifyCaptureRequestSignature,
} from '@/lib/platform/analytics/capture/signature-auth'
import {
  validateCaptureEventPayload,
  type CaptureEventBody,
} from '@/lib/platform/analytics/capture/validate-payload'
import { buildWebxxlEventIdempotencyKey } from '@/lib/platform/analytics/ids'

export type CaptureIngestResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; code: string; message: string; status: number }

async function loadCredential(publicKeyId: string) {
  return prisma.analyticsSiteCaptureCredential.findUnique({
    where: { publicKeyId },
    select: {
      id: true,
      publicKeyId: true,
      secretRef: true,
      secretHash: true,
      enabled: true,
      revokedAt: true,
      customerAccountId: true,
      managedSiteId: true,
    },
  })
}

async function assertCredentialSiteBinding(credential: {
  customerAccountId: string
  managedSiteId: string
}): Promise<boolean> {
  const site = await prisma.managedSite.findFirst({
    where: {
      id: credential.managedSiteId,
      customerAccountId: credential.customerAccountId,
    },
    select: { id: true },
  })
  return Boolean(site)
}

async function assertCustomConversionDefinition(input: {
  customerAccountId: string
  managedSiteId: string
  customConversionKey: string
}): Promise<boolean> {
  const def = await prisma.analyticsConversionDefinition.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      key: input.customConversionKey,
      isActive: true,
      OR: [{ managedSiteId: input.managedSiteId }, { managedSiteId: null }],
    },
    select: { id: true },
  })
  return Boolean(def)
}

export async function ingestFirstPartyConversionEvent(input: {
  publicKeyId: string | null
  idempotencyKeyHeader: string | null
  signatureHeader: string | null
  timestampHeader: string | null
  rawBody: string
  parsed: CaptureEventBody
}): Promise<CaptureIngestResult> {
  if (!isAnalyticsFirstPartyCaptureEnabled()) {
    return {
      ok: false,
      code: 'ANALYTICS_DISABLED',
      message: 'First-party analytics capture is disabled',
      status: 503,
    }
  }
  if (!input.publicKeyId) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing capture key', status: 401 }
  }
  const credential = await loadCredential(input.publicKeyId)
  if (!credential || !credential.enabled || credential.revokedAt) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid capture key', status: 401 }
  }
  if (!(await assertCredentialSiteBinding(credential))) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Capture credential site binding invalid', status: 401 }
  }
  const rate = await checkCaptureRateLimit({ publicKeyId: credential.publicKeyId })
  if (!rate.ok) {
    return { ok: false, code: 'RATE_LIMIT', message: rate.message, status: 429 }
  }
  const secretMaterial = resolveCaptureSecretMaterial({
    publicKeyId: credential.publicKeyId,
    secretRef: credential.secretRef,
    secretHash: credential.secretHash,
  })
  if (!secretMaterial.ok) {
    return { ok: false, code: secretMaterial.code, message: secretMaterial.message, status: 503 }
  }
  const verified = verifyCaptureRequestSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    secret: secretMaterial.secret,
  })
  if (!verified.ok) {
    return { ok: false, code: verified.code, message: verified.message, status: 401 }
  }
  const validated = validateCaptureEventPayload({ rawBody: input.rawBody, parsed: input.parsed })
  if (!validated.ok) {
    const status = validated.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400
    return { ok: false, code: validated.code, message: validated.message, status }
  }
  if (validated.value.eventKey === 'custom_conversion') {
    if (!validated.value.customConversionKey) {
      return { ok: false, code: 'VALIDATION', message: 'customConversionKey is required', status: 400 }
    }
    const allowed = await assertCustomConversionDefinition({
      customerAccountId: credential.customerAccountId,
      managedSiteId: credential.managedSiteId,
      customConversionKey: validated.value.customConversionKey,
    })
    if (!allowed) {
      return {
        ok: false,
        code: 'UNSUPPORTED_EVENT',
        message: 'customConversionKey is not an active conversion definition for this site',
        status: 400,
      }
    }
  }
  const clientSeed =
    input.idempotencyKeyHeader?.trim() ||
    `${verified.timestampSeconds}:${validated.value.eventKey}:${validated.value.occurredAt.toISOString()}`
  const idempotencyKey = buildWebxxlEventIdempotencyKey({
    customerAccountId: credential.customerAccountId,
    managedSiteId: credential.managedSiteId,
    eventKey: validated.value.eventKey,
    idempotencySeed: clientSeed,
  })
  const conversionKey = resolveConversionKeyForEvent({
    eventKey: validated.value.eventKey,
    customConversionKey: validated.value.customConversionKey,
  })
  if (!conversionKey) {
    return { ok: false, code: 'UNSUPPORTED_EVENT', message: 'Unable to resolve conversion key', status: 400 }
  }
  const existing = await prisma.webxxlConversionEvent.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  })
  if (existing) {
    return { ok: true, eventId: existing.id, duplicate: true }
  }
  try {
    const created = await prisma.webxxlConversionEvent.create({
      data: {
        customerAccountId: credential.customerAccountId,
        managedSiteId: credential.managedSiteId,
        eventKey: validated.value.eventKey,
        occurredAt: validated.value.occurredAt,
        visitorRef: validated.value.visitorRef,
        sessionRef: validated.value.sessionRef,
        consentGranted: validated.value.consentGranted,
        consentVersion: validated.value.consentVersion,
        pagePath: validated.value.pagePath,
        customConversionKey: validated.value.customConversionKey,
        provenance: 'capture_api',
        payload: validated.value.metadata ?? undefined,
        idempotencyKey,
      },
      select: { id: true },
    })
    return { ok: true, eventId: created.id, duplicate: false }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      const row = await prisma.webxxlConversionEvent.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      })
      if (row) return { ok: true, eventId: row.id, duplicate: true }
    }
    throw err
  }
}
