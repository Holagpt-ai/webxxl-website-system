import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function assertCrmContactOwnedByAccount(
  contactId: string,
  customerAccountId: string,
): Promise<CrmResult<{ id: string; managedSiteId: string | null }>> {
  const contact = await prisma.crmContact.findFirst({
    where: { id: contactId, customerAccountId },
    select: { id: true, customerAccountId: true, managedSiteId: true, status: true },
  })
  if (!contact) {
    return { ok: false, code: 'NOT_FOUND', message: 'Contact not found for account' }
  }
  if (contact.status === 'MERGED') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Contact is merged and cannot receive updates' }
  }
  return { ok: true, value: { id: contact.id, managedSiteId: contact.managedSiteId } }
}

export async function assertManagedSiteScope(
  customerAccountId: string,
  managedSiteId: string | null | undefined,
  expectedManagedSiteId?: string,
): Promise<CrmResult<true>> {
  if (!expectedManagedSiteId) return { ok: true, value: true }
  if (!managedSiteId || managedSiteId !== expectedManagedSiteId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Managed site scope mismatch' }
  }
  const site = await prisma.managedSite.findFirst({
    where: { id: expectedManagedSiteId, customerAccountId },
  })
  if (!site) return { ok: false, code: 'FORBIDDEN', message: 'Managed site not owned by account' }
  return { ok: true, value: true }
}
