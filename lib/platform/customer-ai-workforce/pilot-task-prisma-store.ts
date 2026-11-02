import type {
  CustomerAiPilotApproval,
  CustomerAiPilotOutcome,
  CustomerAiPilotTask,
  CustomerAiPilotWorkflowKind,
  CustomerAiPilotWorkflowSyncState,
  CustomerAiToolAccessMode,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { nextCustomerAiPublicId } from '@/lib/platform/customer-ai-workforce/ids'
import type {
  CustomerAiPilotApprovalRecord,
  CustomerAiPilotTaskRecord,
} from '@/lib/platform/customer-ai-workforce/pilot-types'
import type {
  PilotTaskPersistence,
  SavePilotApprovalInput,
  SavePilotTaskInput,
  PilotTaskWorkflowPatch,
} from '@/lib/platform/customer-ai-workforce/pilot-task-persistence'
import { pilotWorkflowTransitionAllowed } from '@/lib/platform/customer-ai-workforce/pilot-workflow-transition'

function isP2002(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

function mapOutcome(outcome: CustomerAiPilotOutcome): CustomerAiPilotTaskRecord['outcome'] {
  return outcome
}

function mapWorkflowKind(kind: CustomerAiPilotWorkflowKind): CustomerAiPilotTaskRecord['workflowKind'] {
  return kind
}

function mapTask(row: CustomerAiPilotTask): CustomerAiPilotTaskRecord {
  const provenance = (row.provenanceJson ?? {}) as CustomerAiPilotTaskRecord['provenance']
  return {
    id: row.id,
    publicId: row.publicId,
    customerAccountId: row.customerAccountId,
    managedSiteId: row.managedSiteId,
    employeeId: row.employeeId,
    workflowKind: mapWorkflowKind(row.workflowKind),
    toolKey: row.toolKey,
    accessMode: row.accessMode as 'READ' | 'WRITE',
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    outcome: mapOutcome(row.outcome),
    actionHash: row.actionHash,
    draftPayload: (row.draftPayload ?? {}) as Record<string, unknown>,
    provenance,
    requiresHumanApproval: row.requiresHumanApproval,
    approvalId: row.approvalId,
    estimatedCostUnits: row.estimatedCostUnits,
    blockedReason: row.blockedReason,
    workflowJobId: row.workflowJobId,
    workflowSyncState: row.workflowSyncState,
    workflowValidatedAt: row.workflowValidatedAt,
    createdAt: row.createdAt,
  }
}

function mapApproval(row: CustomerAiPilotApproval): CustomerAiPilotApprovalRecord {
  return {
    id: row.id,
    preparedTaskId: row.preparedTaskId,
    customerAccountId: row.customerAccountId,
    managedSiteId: row.managedSiteId,
    employeeId: row.employeeId,
    toolKey: row.toolKey,
    workflowKind: mapWorkflowKind(row.workflowKind),
    actionHash: row.actionHash,
    allowedAction: row.allowedAction,
    destinationRef: row.destinationRef,
    approvedByUserId: row.approvedByUserId,
    approverPlatformRole: row.approverPlatformRole,
    maxCostUnits: row.maxCostUnits,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }
}

export const prismaPilotTaskPersistence: PilotTaskPersistence = {
  resetForTests() {
    // no-op: tests use memory store
  },

  async findPilotTaskByIdempotency(customerAccountId, employeeId, idempotencyKey) {
    const row = await prisma.customerAiPilotTask.findUnique({
      where: {
        customerAccountId_employeeId_idempotencyKey: {
          customerAccountId,
          employeeId,
          idempotencyKey,
        },
      },
    })
    return row ? mapTask(row) : null
  },

  async savePilotTask(record: SavePilotTaskInput) {
    try {
      const created = await prisma.customerAiPilotTask.create({
        data: {
          publicId: nextCustomerAiPublicId('wapt'),
          customerAccountId: record.customerAccountId,
          managedSiteId: record.managedSiteId,
          employeeId: record.employeeId,
          workflowKind: record.workflowKind,
          toolKey: record.toolKey,
          accessMode: record.accessMode as CustomerAiToolAccessMode,
          idempotencyKey: record.idempotencyKey,
          requestFingerprint: record.requestFingerprint,
          outcome: record.outcome,
          actionHash: record.actionHash,
          draftPayload: record.draftPayload as object,
          provenanceJson: record.provenance as object,
          requiresHumanApproval: record.requiresHumanApproval,
          approvalId: record.approvalId,
          estimatedCostUnits: record.estimatedCostUnits,
          blockedReason: record.blockedReason,
          workflowSyncState: record.workflowSyncState ?? 'NOT_QUEUED',
          workflowJobId: record.workflowJobId ?? null,
          workflowValidatedAt: record.workflowValidatedAt ?? null,
        },
      })
      return mapTask(created)
    } catch (error) {
      if (!isP2002(error)) throw error
      const existing = await prisma.customerAiPilotTask.findUnique({
        where: {
          customerAccountId_employeeId_idempotencyKey: {
            customerAccountId: record.customerAccountId,
            employeeId: record.employeeId,
            idempotencyKey: record.idempotencyKey,
          },
        },
      })
      if (!existing) throw error
      if (existing.requestFingerprint !== record.requestFingerprint) {
        throw Object.assign(new Error('Idempotency fingerprint conflict'), { code: 'PILOT_IDEMPOTENCY_CONFLICT' })
      }
      return mapTask(existing)
    }
  },

  async findPilotTaskById(id: string) {
    const row =
      (await prisma.customerAiPilotTask.findUnique({ where: { id } })) ??
      (await prisma.customerAiPilotTask.findUnique({ where: { publicId: id } }))
    return row ? mapTask(row) : null
  },

  async updatePilotTaskWorkflow(taskId: string, patch: PilotTaskWorkflowPatch) {
    const existing = await prisma.customerAiPilotTask.findUnique({ where: { id: taskId } })
    if (!existing) return null
    if (!pilotWorkflowTransitionAllowed(existing.workflowSyncState, patch)) {
      return mapTask(existing)
    }

    const data = {
      ...(patch.workflowJobId !== undefined ? { workflowJobId: patch.workflowJobId } : {}),
      ...(patch.workflowSyncState !== undefined ? { workflowSyncState: patch.workflowSyncState } : {}),
      ...(patch.workflowValidatedAt !== undefined ? { workflowValidatedAt: patch.workflowValidatedAt } : {}),
      ...(patch.blockedReason !== undefined ? { blockedReason: patch.blockedReason } : {}),
    }

    if (patch.ifCurrentSyncStateIn?.length) {
      const result = await prisma.customerAiPilotTask.updateMany({
        where: { id: taskId, workflowSyncState: { in: patch.ifCurrentSyncStateIn } },
        data,
      })
      if (result.count < 1) {
        const current = await prisma.customerAiPilotTask.findUnique({ where: { id: taskId } })
        return current ? mapTask(current) : null
      }
      const updated = await prisma.customerAiPilotTask.findUnique({ where: { id: taskId } })
      return updated ? mapTask(updated) : null
    }

    try {
      const updated = await prisma.customerAiPilotTask.update({ where: { id: taskId }, data })
      return mapTask(updated)
    } catch {
      return null
    }
  },

  async savePilotApproval(record: SavePilotApprovalInput) {
    const created = await prisma.$transaction(async (tx) => {
      const approval = await tx.customerAiPilotApproval.create({
        data: {
          preparedTaskId: record.preparedTaskId,
          customerAccountId: record.customerAccountId,
          managedSiteId: record.managedSiteId,
          employeeId: record.employeeId,
          toolKey: record.toolKey,
          workflowKind: record.workflowKind,
          actionHash: record.actionHash,
          allowedAction: record.allowedAction,
          destinationRef: record.destinationRef,
          approvedByUserId: record.approvedByUserId,
          approverPlatformRole: record.approverPlatformRole,
          maxCostUnits: record.maxCostUnits,
          expiresAt: record.expiresAt,
          consumedAt: record.consumedAt,
          revokedAt: record.revokedAt,
        },
      })
      await tx.customerAiPilotTask.update({
        where: { id: record.preparedTaskId },
        data: { approvalId: approval.id },
      })
      return approval
    })
    return mapApproval(created)
  },

  async findPilotApprovalById(id: string) {
    const row = await prisma.customerAiPilotApproval.findUnique({ where: { id } })
    return row ? mapApproval(row) : null
  },

  async updatePilotApproval(id, patch, options) {
    if (options?.consumeIfUnset) {
      const result = await prisma.customerAiPilotApproval.updateMany({
        where: {
          id,
          ...(options.customerAccountId ? { customerAccountId: options.customerAccountId } : {}),
          consumedAt: null,
          revokedAt: null,
        },
        data: { consumedAt: patch.consumedAt ?? new Date() },
      })
      if (result.count < 1) return null
      const row = await prisma.customerAiPilotApproval.findUnique({ where: { id } })
      return row ? mapApproval(row) : null
    }
    try {
      const updated = await prisma.customerAiPilotApproval.update({
        where: { id },
        data: {
          consumedAt: patch.consumedAt,
          revokedAt: patch.revokedAt,
          maxCostUnits: patch.maxCostUnits,
        },
      })
      return mapApproval(updated)
    } catch {
      return null
    }
  },

  async linkPilotTaskApproval(taskId: string, approvalId: string) {
    await prisma.customerAiPilotTask.update({
      where: { id: taskId },
      data: { approvalId },
    })
  },
}
