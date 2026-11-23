import { prisma } from '@/lib/db'
import { assertCrmContactOwnedByAccount } from '@/lib/platform/crm/contact-guard'
import { customFieldsWriteValue, type CrmCustomFields } from '@/lib/platform/crm/custom-fields'
import type { CrmResult } from '@/lib/platform/crm/types'

export type CrmCompanyDetail = {
  id: string
  customerAccountId: string
  managedSiteId: string | null
  name: string
  websiteDomain: string | null
  industry: string | null
  phone: string | null
  email: string | null
  ownerUserId: string | null
  customFields: unknown
  createdAt: Date
  updatedAt: Date
  contacts: {
    relationshipId: string
    contactId: string
    roleTitle: string | null
    isPrimary: boolean
    givenName: string | null
    familyName: string | null
    preferredName: string | null
    jobTitle: string | null
    status: string
  }[]
  deals: {
    id: string
    title: string
    status: string
    stageId: string
    amountMinorUnits: number | null
    currencyCode: string
  }[]
}

export async function createCrmCompany(input: {
  customerAccountId: string
  managedSiteId?: string
  name: string
  websiteDomain?: string
  industry?: string
  phone?: string
  email?: string
  customFields?: CrmCustomFields | null
}): Promise<CrmResult<{ id: string }>> {
  const name = input.name.trim()
  if (!name) return { ok: false, code: 'VALIDATION_ERROR', message: 'name required' }
  const row = await prisma.crmCompany.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      name,
      websiteDomain: input.websiteDomain?.trim() || undefined,
      industry: input.industry?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      customFields: input.customFields === undefined ? undefined : customFieldsWriteValue(input.customFields),
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function getCrmCompanyForAccount(
  companyId: string,
  customerAccountId: string,
): Promise<CrmResult<CrmCompanyDetail>> {
  const company = await prisma.crmCompany.findFirst({
    where: { id: companyId, customerAccountId },
    include: {
      contactLinks: {
        include: {
          contact: {
            select: {
              id: true,
              givenName: true,
              familyName: true,
              preferredName: true,
              jobTitle: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
      deals: {
        select: {
          id: true,
          title: true,
          status: true,
          stageId: true,
          amountMinorUnits: true,
          currencyCode: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      },
    },
  })
  if (!company) return { ok: false, code: 'NOT_FOUND', message: 'Company not found' }
  return {
    ok: true,
    value: {
      id: company.id,
      customerAccountId: company.customerAccountId,
      managedSiteId: company.managedSiteId,
      name: company.name,
      websiteDomain: company.websiteDomain,
      industry: company.industry,
      phone: company.phone,
      email: company.email,
      ownerUserId: company.ownerUserId,
      customFields: company.customFields,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      contacts: company.contactLinks.map((link) => ({
        relationshipId: link.id,
        contactId: link.contact.id,
        roleTitle: link.roleTitle,
        isPrimary: link.isPrimary,
        givenName: link.contact.givenName,
        familyName: link.contact.familyName,
        preferredName: link.contact.preferredName,
        jobTitle: link.contact.jobTitle,
        status: link.contact.status,
      })),
      deals: company.deals,
    },
  }
}

export async function updateCrmCompany(
  companyId: string,
  customerAccountId: string,
  patch: {
    name?: string
    websiteDomain?: string | null
    industry?: string | null
    phone?: string | null
    email?: string | null
    customFields?: CrmCustomFields | null
  },
): Promise<CrmResult<{ id: string }>> {
  const company = await prisma.crmCompany.findFirst({ where: { id: companyId, customerAccountId } })
  if (!company) return { ok: false, code: 'NOT_FOUND', message: 'Company not found' }
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'name required' }
  }
  await prisma.crmCompany.update({
    where: { id: companyId },
    data: {
      name: patch.name?.trim(),
      websiteDomain: patch.websiteDomain === undefined ? undefined : patch.websiteDomain?.trim() || null,
      industry: patch.industry === undefined ? undefined : patch.industry?.trim() || null,
      phone: patch.phone === undefined ? undefined : patch.phone?.trim() || null,
      email: patch.email === undefined ? undefined : patch.email?.trim() || null,
      customFields: patch.customFields === undefined ? undefined : customFieldsWriteValue(patch.customFields),
    },
  })
  return { ok: true, value: { id: companyId } }
}

export async function linkContactToCompany(input: {
  customerAccountId: string
  companyId: string
  contactId: string
  roleTitle?: string
  isPrimary?: boolean
}): Promise<CrmResult<{ id: string; alreadyLinked: boolean }>> {
  const company = await prisma.crmCompany.findFirst({
    where: { id: input.companyId, customerAccountId: input.customerAccountId },
    select: { id: true },
  })
  if (!company) return { ok: false, code: 'NOT_FOUND', message: 'Company not found' }
  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  const existing = await prisma.crmContactCompanyRelationship.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      companyId: input.companyId,
    },
  })
  if (existing) {
    if (input.roleTitle !== undefined || input.isPrimary === true) {
      await prisma.$transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.crmContactCompanyRelationship.updateMany({
            where: {
              customerAccountId: input.customerAccountId,
              contactId: input.contactId,
              isPrimary: true,
              NOT: { id: existing.id },
            },
            data: { isPrimary: false },
          })
        }
        await tx.crmContactCompanyRelationship.update({
          where: { id: existing.id },
          data: {
            roleTitle: input.roleTitle === undefined ? undefined : input.roleTitle.trim() || null,
            isPrimary: input.isPrimary === undefined ? undefined : input.isPrimary,
          },
        })
      })
    }
    return { ok: true, value: { id: existing.id, alreadyLinked: true } }
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.crmContactCompanyRelationship.updateMany({
          where: { customerAccountId: input.customerAccountId, contactId: input.contactId, isPrimary: true },
          data: { isPrimary: false },
        })
      }
      return tx.crmContactCompanyRelationship.create({
        data: {
          customerAccountId: input.customerAccountId,
          contactId: input.contactId,
          companyId: input.companyId,
          roleTitle: input.roleTitle?.trim() || undefined,
          isPrimary: input.isPrimary ?? false,
        },
      })
    })
    return { ok: true, value: { id: row.id, alreadyLinked: false } }
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      const replay = await prisma.crmContactCompanyRelationship.findFirst({
        where: {
          customerAccountId: input.customerAccountId,
          contactId: input.contactId,
          companyId: input.companyId,
        },
      })
      if (replay) return { ok: true, value: { id: replay.id, alreadyLinked: true } }
      return { ok: false, code: 'CONFLICT', message: 'Contact already linked to this company' }
    }
    throw error
  }
}

export async function unlinkContactFromCompany(input: {
  customerAccountId: string
  companyId: string
  contactId: string
}): Promise<CrmResult<{ id: string }>> {
  const existing = await prisma.crmContactCompanyRelationship.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      companyId: input.companyId,
      contactId: input.contactId,
    },
  })
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'Company contact link not found' }
  await prisma.crmContactCompanyRelationship.delete({ where: { id: existing.id } })
  return { ok: true, value: { id: existing.id } }
}
