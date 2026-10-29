import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  CRM_LIST_DEFAULT_TAKE,
  CRM_LIST_MAX_TAKE,
  CRM_SEARCH_MAX_QUERY_LENGTH,
} from '@/config/crm-backend'
import { decodeContactListCursor, encodeContactListCursor } from '@/lib/platform/crm/contact-cursor'
import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'
import type { CrmResult } from '@/lib/platform/crm/types'

const contactInclude = { channelIdentities: true } as const

export type ListCrmContactsInput = {
  customerAccountId: string
  take?: number
  search?: string
  cursor?: string
}

function clampTake(take?: number): number {
  return Math.min(Math.max(Number(take ?? CRM_LIST_DEFAULT_TAKE) || CRM_LIST_DEFAULT_TAKE, 1), CRM_LIST_MAX_TAKE)
}

function buildSearchWhere(customerAccountId: string, rawSearch: string): Prisma.CrmContactWhereInput {
  const q = rawSearch.trim().slice(0, CRM_SEARCH_MAX_QUERY_LENGTH)
  if (!q) {
    return { customerAccountId, status: 'ACTIVE' }
  }
  const identityClauses: Prisma.CrmContactChannelIdentityWhereInput[] = [
    { displayValue: { contains: q, mode: 'insensitive' } },
  ]
  if (q.includes('@')) {
    identityClauses.push({ normalizedValue: { equals: normalizeEmail(q) }, identityType: 'EMAIL' })
  }
  const digitCount = q.replace(/\D/g, '').length
  if (digitCount >= 7) {
    const phone = normalizePhone(q)
    identityClauses.push({ normalizedValue: { contains: phone }, identityType: 'PHONE' })
  }
  return {
    customerAccountId,
    status: 'ACTIVE',
    OR: [
      { givenName: { contains: q, mode: 'insensitive' } },
      { familyName: { contains: q, mode: 'insensitive' } },
      { preferredName: { contains: q, mode: 'insensitive' } },
      { organizationName: { contains: q, mode: 'insensitive' } },
      {
        channelIdentities: {
          some: {
            customerAccountId,
            OR: identityClauses,
          },
        },
      },
    ],
  }
}

function cursorWhere(
  base: Prisma.CrmContactWhereInput,
  cursor: { u: string; i: string },
): Prisma.CrmContactWhereInput {
  const updatedAt = new Date(cursor.u)
  return {
    AND: [
      base,
      {
        OR: [{ updatedAt: { lt: updatedAt } }, { updatedAt, id: { lt: cursor.i } }],
      },
    ],
  }
}

export async function listCrmContacts(
  input: ListCrmContactsInput,
): Promise<
  CrmResult<{
    contacts: Prisma.CrmContactGetPayload<{ include: typeof contactInclude }>[]
    nextCursor?: string
  }>
> {
  const take = clampTake(input.take)
  const baseWhere = buildSearchWhere(input.customerAccountId, input.search ?? '')

  let where = baseWhere
  if (input.cursor) {
    const decoded = decodeContactListCursor(input.cursor)
    if (!decoded.ok) return decoded
    where = cursorWhere(baseWhere, decoded.value)
  }

  const contacts = await prisma.crmContact.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take,
    include: contactInclude,
  })

  let nextCursor: string | undefined
  if (contacts.length === take) {
    const last = contacts[contacts.length - 1]!
    nextCursor = encodeContactListCursor({ u: last.updatedAt.toISOString(), i: last.id })
  }

  return { ok: true, value: { contacts, nextCursor } }
}
