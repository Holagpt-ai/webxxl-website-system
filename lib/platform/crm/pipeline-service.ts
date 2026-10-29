import { prisma } from '@/lib/db'
import { assertSameCustomerAccount } from '@/lib/platform/crm/account-isolation'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function ensureDefaultPipeline(customerAccountId: string): Promise<CrmResult<{ pipelineId: string; stageIds: string[] }>> {
  const existing = await prisma.crmPipeline.findFirst({ where: { customerAccountId, isDefault: true }, include: { stages: true } })
  if (existing) {
    return {
      ok: true,
      value: { pipelineId: existing.id, stageIds: existing.stages.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id) },
    }
  }
  const pipeline = await prisma.crmPipeline.create({
    data: {
      customerAccountId,
      name: 'Default',
      isDefault: true,
      stages: {
        create: [
          { customerAccountId, name: 'Qualification', sortOrder: 1, probabilityBps: 2000 },
          { customerAccountId, name: 'Proposal', sortOrder: 2, probabilityBps: 5000 },
          { customerAccountId, name: 'Won', sortOrder: 3, probabilityBps: 10000 },
        ],
      },
    },
    include: { stages: true },
  })
  return {
    ok: true,
    value: { pipelineId: pipeline.id, stageIds: pipeline.stages.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id) },
  }
}

export async function createCrmDeal(input: {
  customerAccountId: string
  pipelineId: string
  stageId: string
  title: string
  contactId?: string
  companyId?: string
  amountMinorUnits?: number
  currencyCode?: string
  ownerUserId?: string
}): Promise<CrmResult<{ id: string }>> {
  const pipeline = await prisma.crmPipeline.findFirst({ where: { id: input.pipelineId, customerAccountId: input.customerAccountId } })
  if (!pipeline) return { ok: false, code: 'NOT_FOUND', message: 'Pipeline not found' }
  const stage = await prisma.crmPipelineStage.findFirst({
    where: { id: input.stageId, pipelineId: input.pipelineId, customerAccountId: input.customerAccountId },
  })
  if (!stage) return { ok: false, code: 'NOT_FOUND', message: 'Stage not found' }
  if (input.contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: input.contactId, customerAccountId: input.customerAccountId } })
    if (!contact) return { ok: false, code: 'VALIDATION_ERROR', message: 'Deal contact must belong to same account' }
  }
  if (input.companyId) {
    const company = await prisma.crmCompany.findFirst({ where: { id: input.companyId, customerAccountId: input.customerAccountId } })
    if (!company) return { ok: false, code: 'VALIDATION_ERROR', message: 'Deal company must belong to same account' }
  }
  const deal = await prisma.crmDeal.create({
    data: {
      customerAccountId: input.customerAccountId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      title: input.title,
      contactId: input.contactId,
      companyId: input.companyId,
      amountMinorUnits: input.amountMinorUnits,
      currencyCode: input.currencyCode ?? 'USD',
      ownerUserId: input.ownerUserId,
    },
  })
  await prisma.crmDealStageHistory.create({
    data: {
      customerAccountId: input.customerAccountId,
      dealId: deal.id,
      toStageId: input.stageId,
    },
  })
  return { ok: true, value: { id: deal.id } }
}

export async function moveDealStage(input: {
  customerAccountId: string
  dealId: string
  toStageId: string
  changedByUserId?: string
}): Promise<CrmResult<{ id: string }>> {
  const deal = await prisma.crmDeal.findFirst({ where: { id: input.dealId, customerAccountId: input.customerAccountId } })
  if (!deal) return { ok: false, code: 'NOT_FOUND', message: 'Deal not found' }
  const stage = await prisma.crmPipelineStage.findFirst({
    where: { id: input.toStageId, pipelineId: deal.pipelineId, customerAccountId: input.customerAccountId },
  })
  if (!stage) return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid stage for pipeline' }
  if (deal.stageId === input.toStageId) {
    return { ok: true, value: { id: deal.id } }
  }
  const moved = await prisma.$transaction(async (tx) => {
    const current = await tx.crmDeal.findFirst({
      where: { id: input.dealId, customerAccountId: input.customerAccountId },
    })
    if (!current) return { ok: false as const, code: 'NOT_FOUND' as const, message: 'Deal not found' }
    if (current.stageId === input.toStageId) return { ok: true as const, id: current.id }
    await tx.crmDeal.update({ where: { id: current.id }, data: { stageId: input.toStageId } })
    await tx.crmDealStageHistory.create({
      data: {
        customerAccountId: input.customerAccountId,
        dealId: current.id,
        fromStageId: current.stageId,
        toStageId: input.toStageId,
        changedByUserId: input.changedByUserId,
      },
    })
    return { ok: true as const, id: current.id }
  })
  if (!moved.ok) return moved
  return { ok: true, value: { id: moved.id } }
}

export async function linkContactCompany(input: {
  customerAccountId: string
  contactId: string
  companyId: string
  roleTitle?: string
}): Promise<CrmResult<{ id: string }>> {
  const contact = await prisma.crmContact.findFirst({ where: { id: input.contactId, customerAccountId: input.customerAccountId } })
  const company = await prisma.crmCompany.findFirst({ where: { id: input.companyId, customerAccountId: input.customerAccountId } })
  if (!contact || !company) return { ok: false, code: 'NOT_FOUND', message: 'Contact or company not found' }
  const scope = assertSameCustomerAccount(contact.customerAccountId, company.customerAccountId)
  if (!scope.ok) return scope
  const row = await prisma.crmContactCompanyRelationship.create({
    data: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      companyId: input.companyId,
      roleTitle: input.roleTitle,
    },
  })
  return { ok: true, value: { id: row.id } }
}
