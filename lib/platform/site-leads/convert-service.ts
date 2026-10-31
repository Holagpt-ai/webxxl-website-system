import { prisma } from '@/lib/db'
import {
  conversionMustNotGrantMarketingConsent,
  findExactAccountIdentityConflict,
} from '@/lib/platform/site-leads/crm-identity'
import type { SiteLeadResult } from '@/lib/platform/site-leads/types'

function splitName(full: string | null): { givenName?: string; familyName?: string } {
  if (!full?.trim()) return {}
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { givenName: parts[0] }
  return { givenName: parts[0], familyName: parts.slice(1).join(' ') }
}

export async function convertManagedSiteLeadToCrmContact(input: {
  leadId: string
  customerAccountId: string
  actorUserId: string
  idempotencyKey: string
}): Promise<SiteLeadResult<{ leadId: string; contactId: string; status: 'CONVERTED' }>> {
  conversionMustNotGrantMarketingConsent()
  const idempotencyKey = input.idempotencyKey.trim()
  if (!idempotencyKey) {
    return { ok: false, code: 'VALIDATION', message: 'Idempotency key is required' }
  }

  const raced = await prisma.managedSiteLead.findFirst({
    where: { convertIdempotencyKey: idempotencyKey },
    select: { id: true, customerAccountId: true, crmContactId: true, status: true },
  })
  if (raced) {
    if (raced.customerAccountId !== input.customerAccountId || raced.id !== input.leadId) {
      return { ok: false, code: 'CONFLICT', message: 'Convert idempotency key conflict' }
    }
    if (!raced.crmContactId) {
      return { ok: false, code: 'CONFLICT', message: 'Conversion in progress' }
    }
    return {
      ok: true,
      value: { leadId: raced.id, contactId: raced.crmContactId, status: 'CONVERTED' },
    }
  }

  const lead = await prisma.managedSiteLead.findFirst({
    where: { id: input.leadId, customerAccountId: input.customerAccountId },
  })
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Lead not found' }
  if (lead.status === 'CONVERTED' && lead.crmContactId) {
    return {
      ok: true,
      value: { leadId: lead.id, contactId: lead.crmContactId, status: 'CONVERTED' },
    }
  }
  if (lead.status !== 'QUALIFIED' && lead.status !== 'PENDING_REVIEW') {
    return { ok: false, code: 'CONFLICT', message: 'Lead must be qualified or pending review before conversion' }
  }

  const identityConflict = await findExactAccountIdentityConflict({
    customerAccountId: input.customerAccountId,
    normalizedEmail: lead.normalizedEmail,
    normalizedPhone: lead.normalizedPhone,
  })
  if (identityConflict) {
    await prisma.managedSiteLead.update({
      where: { id: lead.id },
      data: { status: 'DUPLICATE_REVIEW' },
    })
    return {
      ok: false,
      code: 'CONFLICT',
      message: `CRM contact already exists for this ${identityConflict.via} identity`,
    }
  }

  const names = splitName(lead.contactName)
  try {
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.managedSiteLead.updateMany({
        where: {
          id: lead.id,
          customerAccountId: input.customerAccountId,
          status: { in: ['QUALIFIED', 'PENDING_REVIEW'] },
          crmContactId: null,
        },
        data: { convertIdempotencyKey: idempotencyKey },
      })
      if (claim.count !== 1) {
        throw new Error('CONCURRENT_CONVERSION')
      }

      const contact = await tx.crmContact.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: lead.managedSiteId,
          givenName: names.givenName,
          familyName: names.familyName,
          locale: lead.locale,
          leadSource: 'managed_site_form',
          sourceReference: lead.id,
          createIdempotencyKey: `site-lead:${lead.id}:${idempotencyKey}`,
        },
      })

      await tx.crmContactChannelIdentity.create({
        data: {
          customerAccountId: input.customerAccountId,
          contactId: contact.id,
          identityType: 'EMAIL',
          normalizedValue: lead.normalizedEmail,
          displayValue: lead.contactEmail,
          isPrimary: true,
          sourceSystem: 'managed_site_lead',
        },
      })
      if (lead.normalizedPhone && lead.contactPhone) {
        await tx.crmContactChannelIdentity.create({
          data: {
            customerAccountId: input.customerAccountId,
            contactId: contact.id,
            identityType: 'PHONE',
            normalizedValue: lead.normalizedPhone,
            displayValue: lead.contactPhone,
            isPrimary: false,
            sourceSystem: 'managed_site_lead',
          },
        })
      }

      await tx.crmContactSource.create({
        data: {
          customerAccountId: input.customerAccountId,
          contactId: contact.id,
          sourceSystem: 'managed_site_lead',
          sourceRecordRef: lead.id,
          provenance: JSON.stringify({
            formReference: lead.formReference,
            submittedAt: lead.submittedAt.toISOString(),
            analyticsEventRef: lead.analyticsEventRef,
            sourceAttribution: lead.sourceAttribution,
          }),
        },
      })

      await tx.managedSiteLead.update({
        where: { id: lead.id },
        data: {
          status: 'CONVERTED',
          crmContactId: contact.id,
          convertedAt: new Date(),
        },
      })

      return contact.id
    })
    return { ok: true, value: { leadId: lead.id, contactId: result, status: 'CONVERTED' } }
  } catch (error) {
    if (error instanceof Error && error.message === 'CONCURRENT_CONVERSION') {
      const current = await prisma.managedSiteLead.findFirst({
        where: { id: lead.id, customerAccountId: input.customerAccountId },
        select: { crmContactId: true, status: true },
      })
      if (current?.crmContactId) {
        return {
          ok: true,
          value: { leadId: lead.id, contactId: current.crmContactId, status: 'CONVERTED' },
        }
      }
      return { ok: false, code: 'CONFLICT', message: 'Concurrent conversion conflict' }
    }
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return { ok: false, code: 'CONFLICT', message: 'CRM identity conflict during conversion' }
    }
    throw error
  }
}
