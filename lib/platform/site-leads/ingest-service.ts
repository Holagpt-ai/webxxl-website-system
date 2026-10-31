import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isSiteLeadIntakeEnabled, SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS } from '@/config/site-lead-intake'
import { buildSiteLeadSubmissionFingerprint } from '@/lib/platform/site-leads/fingerprint'
import { buildSiteLeadIntakePayloadFingerprint } from '@/lib/platform/site-leads/payload-fingerprint'
import { authenticateSiteLeadIntakeRequest } from '@/lib/platform/site-leads/intake-auth'
import { checkSiteLeadIntakeRateLimit } from '@/lib/platform/site-leads/rate-limit'
import { validateSiteLeadIntakePayload, type SiteLeadIntakeBody } from '@/lib/platform/site-leads/validate-payload'

export type SiteLeadIngestResult =
  | { ok: true; leadId: string; duplicate: boolean; status: string }
  | { ok: false; code: string; message: string; status: number }

const existingLeadSelect = {
  id: true,
  status: true,
  customerAccountId: true,
  managedSiteId: true,
  intakePayloadFingerprint: true,
} as const

async function replayExistingLead(
  existing: {
    id: string
    status: string
    customerAccountId: string
    managedSiteId: string
    intakePayloadFingerprint: string
  },
  ctx: { customerAccountId: string; managedSiteId: string },
  intakePayloadFingerprint: string,
): Promise<SiteLeadIngestResult> {
  if (
    existing.customerAccountId !== ctx.customerAccountId ||
    existing.managedSiteId !== ctx.managedSiteId
  ) {
    return { ok: false, code: 'CONFLICT', message: 'Idempotency key conflict', status: 409 }
  }
  if (existing.intakePayloadFingerprint !== intakePayloadFingerprint) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Idempotency key reused with different submission content',
      status: 409,
    }
  }
  return { ok: true, leadId: existing.id, duplicate: true, status: existing.status }
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

  const auth = await authenticateSiteLeadIntakeRequest({
    publicKeyId: input.publicKeyId,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    rawBody: input.rawBody,
  })
  if (!auth.ok) {
    return auth
  }
  const ctx = auth.ctx

  const validated = validateSiteLeadIntakePayload({ rawBody: input.rawBody, parsed: input.parsed })
  if (!validated.ok) {
    const status = validated.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400
    return { ok: false, code: validated.code, message: validated.message, status }
  }

  const intakePayloadFingerprint = buildSiteLeadIntakePayloadFingerprint(input.rawBody)
  const submissionFingerprint = buildSiteLeadSubmissionFingerprint({
    customerAccountId: ctx.customerAccountId,
    managedSiteId: ctx.managedSiteId,
    normalizedEmail: validated.value.normalizedEmail,
    normalizedPhone: validated.value.normalizedPhone,
    formReference: validated.value.formReference,
  })

  const rate = await checkSiteLeadIntakeRateLimit({ publicKeyId: ctx.publicKeyId })
  if (!rate.ok) {
    return { ok: false, code: rate.code, message: rate.message, status: 429 }
  }

  const existing = await prisma.managedSiteLead.findUnique({
    where: { idempotencyKey },
    select: existingLeadSelect,
  })
  if (existing) {
    return replayExistingLead(existing, ctx, intakePayloadFingerprint)
  }

  const since = new Date(Date.now() - SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS)
  const recentDuplicate = await prisma.managedSiteLead.findFirst({
    where: {
      customerAccountId: ctx.customerAccountId,
      managedSiteId: ctx.managedSiteId,
      submissionFingerprint,
      idempotencyKey: { not: idempotencyKey },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  const status = recentDuplicate ? ('DUPLICATE_REVIEW' as const) : ('RECEIVED' as const)

  try {
    const lead = await prisma.managedSiteLead.create({
      data: {
        customerAccountId: ctx.customerAccountId,
        managedSiteId: ctx.managedSiteId,
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
        submissionFingerprint,
        intakePayloadFingerprint,
        sourceAttribution: validated.value.sourceAttribution
          ? ({
              ...validated.value.sourceAttribution,
              managedSiteDomain: ctx.siteDomain,
            } as Prisma.InputJsonValue)
          : ({ managedSiteDomain: ctx.siteDomain } as Prisma.InputJsonValue),
        analyticsEventRef: validated.value.analyticsEventRef,
        duplicateOfLeadId: recentDuplicate?.id ?? null,
      },
    })
    return { ok: true, leadId: lead.id, duplicate: false, status: lead.status }
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      const raced = await prisma.managedSiteLead.findUnique({
        where: { idempotencyKey },
        select: existingLeadSelect,
      })
      if (raced) {
        return replayExistingLead(raced, ctx, intakePayloadFingerprint)
      }
    }
    throw error
  }
}
