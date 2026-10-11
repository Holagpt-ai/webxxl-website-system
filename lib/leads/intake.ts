import { prisma } from '@/lib/db'
import type { LeadSource, Prisma } from '@prisma/client'
import { buildLeadSubmissionFingerprint, buildReferenceCode } from '@/lib/leads/fingerprint'
import { writeLeadActivity } from '@/lib/leads/activity'
import { automationHooks } from '@/lib/automation/hooks'

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000

export type PersistSalesLeadInput = {
  source: LeadSource
  locale: string
  contactName?: string | null
  contactEmail: string
  contactPhone?: string | null
  businessName?: string | null
  headline?: string | null
  payload: Record<string, unknown>
  dedupeKey: string
  referencePrefix: string
  resendMessageId: string
}

export async function findRecentDuplicateLead(fingerprint: string) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS)
  return prisma.salesLead.findFirst({
    where: { submissionFingerprint: fingerprint, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function persistSalesLead(input: PersistSalesLeadInput) {
  const contactEmail = input.contactEmail.trim().toLowerCase()
  const fingerprint = buildLeadSubmissionFingerprint({
    source: input.source,
    contactEmail,
    dedupeKey: input.dedupeKey,
  })

  const duplicate = await findRecentDuplicateLead(fingerprint)
  if (duplicate) {
    return { lead: duplicate, duplicate: true as const }
  }

  const referenceCode = buildReferenceCode(input.referencePrefix, input.resendMessageId)
  const lead = await prisma.salesLead.create({
    data: {
      source: input.source,
      locale: input.locale || 'en',
      contactName: input.contactName?.trim() || null,
      contactEmail,
      contactPhone: input.contactPhone?.trim() || null,
      businessName: input.businessName?.trim() || null,
      headline: input.headline?.trim() || null,
      payload: input.payload as Prisma.InputJsonValue,
      referenceCode,
      submissionFingerprint: fingerprint,
      resendMessageId: input.resendMessageId,
    },
  })

  await writeLeadActivity({
    leadId: lead.id,
    type: 'CREATED',
    summary: `Lead created from ${input.source.replace('_', ' ').toLowerCase()}`,
    metadata: { referenceCode },
  })
  await writeLeadActivity({
    leadId: lead.id,
    type: 'EMAIL_DELIVERED',
    summary: 'Notification email delivered to WebXXL inbox',
  })
  await automationHooks.leadReceived({ leadId: lead.id, headline: lead.headline })

  return { lead, duplicate: false as const }
}

export async function recordNewsletterSubscriber(input: { email: string; source: string; locale: string }) {
  const email = input.email.trim().toLowerCase()
  return prisma.newsletterSubscriber.upsert({
    where: { email_source: { email, source: input.source } },
    create: { email, source: input.source, locale: input.locale || 'en' },
    update: { locale: input.locale || 'en' },
  })
}
