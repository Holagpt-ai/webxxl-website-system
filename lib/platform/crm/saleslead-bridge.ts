import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

/** Bridge SalesLead -> CRM contact candidate without bulk migration. */
export async function registerSalesLeadBridgeCandidate(input: {
  customerAccountId: string
  salesLeadId: string
  idempotencyKey: string
  /** Required when SalesLead.customerAccountId is null (WebXXL-owned intake). */
  verifiedSourceOwnership?: boolean
}): Promise<CrmResult<{ id: string; status: string }>> {
  const lead = await prisma.salesLead.findUnique({ where: { id: input.salesLeadId } })
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'SalesLead not found' }

  if (!lead.customerAccountId) {
    if (!input.verifiedSourceOwnership) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Unowned SalesLead cannot be mapped without verified source ownership',
      }
    }
  } else if (lead.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'SalesLead belongs to another customer account' }
  }

  const existing = await prisma.crmSalesLeadBridge.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId || existing.salesLeadId !== input.salesLeadId) {
      return { ok: false, code: 'CONFLICT', message: 'SalesLead bridge idempotency key conflict' }
    }
    return { ok: true, value: { id: existing.id, status: existing.status } }
  }

  const row = await prisma.crmSalesLeadBridge.upsert({
    where: { customerAccountId_salesLeadId: { customerAccountId: input.customerAccountId, salesLeadId: input.salesLeadId } },
    create: {
      customerAccountId: input.customerAccountId,
      salesLeadId: input.salesLeadId,
      status: 'CANDIDATE',
      idempotencyKey: input.idempotencyKey,
    },
    update: { status: 'CANDIDATE' },
  })
  return { ok: true, value: { id: row.id, status: row.status } }
}
