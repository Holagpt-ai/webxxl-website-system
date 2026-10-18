import { marketingStudioDefaultPeriodKey } from '@/config/social-marketing'
import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function recordMarketingUsage(input: {
  customerAccountId: string
  managedSiteId?: string
  operation: string
  units?: number
  idempotencyKey?: string
}): Promise<MktResult<{ recorded: boolean }>> {
  if (input.idempotencyKey) {
    const existing = await prisma.marketingStudioUsage.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) return { ok: true, value: { recorded: false } }
  }
  await prisma.marketingStudioUsage.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      periodKey: marketingStudioDefaultPeriodKey(),
      operation: input.operation,
      units: input.units ?? 1,
      source: 'mkt-08-backend',
      idempotencyKey: input.idempotencyKey,
    },
  })
  return { ok: true, value: { recorded: true } }
}
