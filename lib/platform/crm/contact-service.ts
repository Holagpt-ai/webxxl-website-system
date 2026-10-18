import type { CrmChannelIdentityType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertSameCustomerAccount } from '@/lib/platform/crm/account-isolation'
import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CreateContactInput = {
  customerAccountId: string
  managedSiteId?: string
  givenName?: string
  familyName?: string
  preferredName?: string
  organizationName?: string
  jobTitle?: string
  locale?: string
  leadSource?: string
  sourceReference?: string
  emails?: string[]
  phones?: string[]
  idempotencyKey?: string
}

export async function createCrmContact(input: CreateContactInput): Promise<CrmResult<{ id: string }>> {
  if (input.idempotencyKey) {
    const existing = await prisma.crmContact.findFirst({
      where: { customerAccountId: input.customerAccountId, createIdempotencyKey: input.idempotencyKey },
    })
    if (existing) return { ok: true, value: { id: existing.id } }
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      const contact = await tx.crmContact.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          givenName: input.givenName,
          familyName: input.familyName,
          preferredName: input.preferredName,
          organizationName: input.organizationName,
          jobTitle: input.jobTitle,
          locale: input.locale ?? 'en',
          leadSource: input.leadSource,
          sourceReference: input.sourceReference,
          createIdempotencyKey: input.idempotencyKey,
        },
      })
      for (const [index, email] of (input.emails ?? []).entries()) {
        await tx.crmContactChannelIdentity.create({
          data: {
            customerAccountId: input.customerAccountId,
            contactId: contact.id,
            identityType: 'EMAIL',
            normalizedValue: normalizeEmail(email),
            displayValue: email,
            isPrimary: index === 0,
            sourceSystem: 'native.crm',
          },
        })
      }
      for (const [index, phone] of (input.phones ?? []).entries()) {
        await tx.crmContactChannelIdentity.create({
          data: {
            customerAccountId: input.customerAccountId,
            contactId: contact.id,
            identityType: 'PHONE',
            normalizedValue: normalizePhone(phone),
            displayValue: phone,
            isPrimary: index === 0 && !(input.emails ?? []).length,
            sourceSystem: 'native.crm',
          },
        })
      }
      return contact
    })
    return { ok: true, value: { id: created.id } }
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return { ok: false, code: 'CONFLICT', message: 'Contact identity already exists for account' }
    }
    throw error
  }
}

export async function getCrmContactForAccount(
  contactId: string,
  customerAccountId: string,
): Promise<CrmResult<Prisma.CrmContactGetPayload<{ include: { channelIdentities: true } }>>> {
  const contact = await prisma.crmContact.findFirst({
    where: { id: contactId, customerAccountId },
    include: { channelIdentities: true },
  })
  if (!contact) return { ok: false, code: 'NOT_FOUND', message: 'Contact not found' }
  return { ok: true, value: contact }
}

export async function updateCrmContact(
  contactId: string,
  customerAccountId: string,
  patch: Partial<Pick<CreateContactInput, 'givenName' | 'familyName' | 'preferredName' | 'jobTitle' | 'leadSource'>>,
): Promise<CrmResult<{ id: string }>> {
  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, customerAccountId } })
  if (!contact) return { ok: false, code: 'NOT_FOUND', message: 'Contact not found' }
  await prisma.crmContact.update({
    where: { id: contactId },
    data: {
      givenName: patch.givenName,
      familyName: patch.familyName,
      preferredName: patch.preferredName,
      jobTitle: patch.jobTitle,
      leadSource: patch.leadSource,
    },
  })
  return { ok: true, value: { id: contactId } }
}

export async function addChannelIdentity(
  customerAccountId: string,
  contactId: string,
  identityType: CrmChannelIdentityType,
  value: string,
): Promise<CrmResult<{ id: string }>> {
  const contact = await prisma.crmContact.findFirst({ where: { id: contactId, customerAccountId } })
  if (!contact) return { ok: false, code: 'NOT_FOUND', message: 'Contact not found' }
  const normalized =
    identityType === 'EMAIL' ? normalizeEmail(value) : identityType === 'PHONE' ? normalizePhone(value) : value.trim()
  try {
    const row = await prisma.crmContactChannelIdentity.create({
      data: {
        customerAccountId,
        contactId,
        identityType,
        normalizedValue: normalized,
        displayValue: value,
        sourceSystem: 'native.crm',
      },
    })
    return { ok: true, value: { id: row.id } }
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return { ok: false, code: 'CONFLICT', message: 'Identity already registered in account' }
    }
    throw error
  }
}

export function assertContactAccountScope(
  customerAccountId: string,
  recordAccountId: string,
): CrmResult<true> {
  return assertSameCustomerAccount(customerAccountId, recordAccountId)
}
