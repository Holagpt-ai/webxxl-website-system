import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function createCrmCompany(input: {
  customerAccountId: string
  managedSiteId?: string
  name: string
  websiteDomain?: string
  industry?: string
}): Promise<CrmResult<{ id: string }>> {
  const row = await prisma.crmCompany.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      name: input.name,
      websiteDomain: input.websiteDomain,
      industry: input.industry,
    },
  })
  return { ok: true, value: { id: row.id } }
}
