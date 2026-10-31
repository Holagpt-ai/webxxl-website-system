import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isSiteLeadIntakeEnabled, SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS } from '@/config/site-lead-intake'
import { buildSiteLeadSubmissionFingerprint } from '@/lib/platform/site-leads/fingerprint'
import { checkSiteLeadIntakeRateLimit } from '@/lib/platform/site-leads/rate-limit'
import {
  resolveSiteLeadIntakeSecretMaterial,
  verifySiteLeadIntakeSignature,
} from '@/lib/platform/site-leads/signature-auth'
import { validateSiteLeadIntakePayload, type SiteLeadIntakeBody } from '@/lib/platform/site-leads/validate-payload'

export type SiteLeadIngestResult =
  | { ok: true; leadId: string; duplicate: boolean; status: string }
  | { ok: false; code: string; message: string; status: number }

async function loadCredential(publicKeyId: string) {
  return prisma.managedSiteLeadIntakeCredential.findUnique({
    where: { publicKeyId },
    select: {
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

async function assertVerifiedManagedSite(customerAccountId: string, managedSiteId: string) {
  const site = await prisma.managedSite.findFirst({
    where: { id: managedSiteId, customerAccountId, status: { in: ['ACTIVE', 'SETUP'] } },
    select: { id: true, domain: true },
  })
  return site
}

export async function ingestManagedSiteLead(input: {
  publicKeyId: string | null
  idempotencyKeyHeader: string | null
  signatureHeader: string | null
  timestampHeader: string | null
  rawBody: string
  parsed: SiteLeadIntakeBody
}): Promise<SiteLeadIngestResult> {
  if (!isSiteLeadIntakeEnabled()) {
    return {
      ok: false,
      code: 'SITE_LEAD_INTAKE_DISABLED',
      message: 'Managed-site lead intake is disabled',
      status: 503,
    }
  }
  if (!input.publicKeyId) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing lead intake key', status: 401 }
  }
  const idempotencyKey = input.idempotencyKeyHeader?.trim()
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return { ok: false, code: 'VALIDATION', message: 'x-idempotency-key is required', status: 400 }
  }
  const existing = await prisma.managedSiteLead.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, customerAccountId: true, managedSiteId: true },
  })
  if (existing) {
    const cred = await loadCredential(input.publicKeyId)
    if (
      !cred ||
      cred.customerAccountId !== existing.customerAccountId ||
      cred.managedSiteId !== existing.managedSiteId
    ) {
      return { ok: false, code: 'CONFLICT', message: 'Idempotency key conflict', status: 409 }
    }
    return { ok: true, leadId: existing.id, duplicate: true, status: existing.status }
  }

  const credential = await loadCredential(input.publicKeyId)
  if (!credential || !credential.enabled || credential.revokedAt) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid lead intake key', status: 401 }
  }
  const site = await assertVerifiedManagedSite(credential.customerAccountId, credential.managedSiteId)
  if (!site) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Lead intake site binding invalid', status: 401 }
  }
  const rate = await checkSiteLeadIntakeRateLimit({ publicKeyId: credential.publicKeyId })
  if (!rate.ok) {
    return { ok: false, code: rate.code, message: rate.message, status: 429 }
  }
  const secretMaterial = resolveSiteLeadIntakeSecretMaterial({
    publicKeyId: credential.publicKeyId,
    secretRef: credential.secretRef,
    secretHash: credential.secretHash,
  })
  if (!secretMaterial.ok) {
    return { ok: false, code: secretMaterial.code, message: secretMaterial.message, status: 503 }
  }
  const verified = verifySiteLeadIntakeSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    secret: secretMaterial.secret,
  })
  if (!verified.ok) {
    return { ok: false, code: verified.code, message: verified.message, status: 401 }
  }
  const validated = validateSiteLeadIntakePayload({ rawBody: input.rawBody, parsed: input.parsed })
  if (!validated.ok) {
    const status = validated.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400
    return { ok: false, code: validated.code, message: validated.message, status }
  }

  const fingerprint = buildSiteLeadSubmissionFingerprint({
    managedSiteId: credential.managedSiteId,
    normalizedEmail: validated.value.normalizedEmail,
    normalizedPhone: validated.value.normalizedPhone,
    formReference: validated.value.formReference,
    dedupeKey: idempotencyKey,
  })

  const since = new Date(Date.now() - SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS)
  const recentDuplicate = await prisma.managedSiteLead.findFirst({
    where: {
      customerAccountId: credential.customerAccountId,
      submissionFingerprint: fingerprint,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  const status = recentDuplicate ? ('DUPLICATE_REVIEW' as const) : ('RECEIVED' as const)
  const lead = await prisma.managedSiteLead.create({
    data: {
      customerAccountId: credential.customerAccountId,
      managedSiteId: credential.managedSiteId,
      status,
      locale: validated.value.locale,
      formReference: validated.value.formReference,
      submittedAt: validated.value.submittedAt,
      contactName: validated.value.contactName,
      contactEmail: validated.value.contactEmail,
      contactPhone: validated.value.contactPhone,
      normalizedEmail: validated.value.normalizedEmail,
      normalizedPhone: validated.value.normalizedPhone,
      message: validated.value.message,
      payload: validated.value.payload as Prisma.InputJsonValue,
      idempotencyKey,
      submissionFingerprint: fingerprint,
      sourceAttribution: validated.value.sourceAttribution
        ? ({
            ...validated.value.sourceAttribution,
            managedSiteDomain: site.domain,
          } as Prisma.InputJsonValue)
        : ({ managedSiteDomain: site.domain } as Prisma.InputJsonValue),
      analyticsEventRef: validated.value.analyticsEventRef,
      duplicateOfLeadId: recentDuplicate?.id ?? null,
    },
  })

  return { ok: true, leadId: lead.id, duplicate: false, status: lead.status }
}
