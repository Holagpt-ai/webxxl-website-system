import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

const DEFAULT_CLAIM_TTL_MS = 120_000

export async function tryClaimAutomationDeliveryJob(input: {
  jobId: string
  workerId: string
  expectedStatuses?: ('PENDING' | 'FAILED')[]
  now?: Date
}): Promise<{ claimed: boolean; fence: number; claimToken: string | null }> {
  const now = input.now ?? new Date()
  const claimToken = randomUUID()
  const claimExpiresAt = new Date(now.getTime() + DEFAULT_CLAIM_TTL_MS)
  const statuses = input.expectedStatuses ?? ['PENDING', 'FAILED']
  const job = await prisma.automationDeliveryJob.findUnique({ where: { id: input.jobId } })
  if (!job) return { claimed: false, fence: 0, claimToken: null }
  const nextFence = job.claimFence + 1
  const updated = await prisma.automationDeliveryJob.updateMany({
    where: {
      id: input.jobId,
      status: { in: statuses },
      nextAttemptAt: { lte: now },
      OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
    },
    data: {
      status: 'PROCESSING',
      claimOwner: input.workerId,
      claimToken,
      claimExpiresAt,
      claimFence: nextFence,
    },
  })
  if (updated.count !== 1) return { claimed: false, fence: job.claimFence, claimToken: null }
  return { claimed: true, fence: nextFence, claimToken }
}

export async function completeAutomationDeliveryClaim(input: {
  jobId: string
  claimToken: string
  claimFence: number
}): Promise<boolean> {
  const job = await prisma.automationDeliveryJob.findUnique({ where: { id: input.jobId } })
  if (!job || job.claimToken !== input.claimToken || job.claimFence !== input.claimFence) return false
  return true
}

/** Commit terminal or retry state only when the active PROCESSING claim matches (fencing). */
export async function commitAutomationDeliveryJobClaim(input: {
  jobId: string
  claimToken: string
  claimFence: number
  data: {
    status: 'DELIVERED' | 'FAILED' | 'DEAD'
    attempts?: number
    deliveredAt?: Date | null
    providerRef?: string | null
    lastErrorClass?: string | null
    nextAttemptAt?: Date
  }
}): Promise<boolean> {
  const updated = await prisma.automationDeliveryJob.updateMany({
    where: {
      id: input.jobId,
      status: 'PROCESSING',
      claimToken: input.claimToken,
      claimFence: input.claimFence,
    },
    data: {
      status: input.data.status,
      attempts: input.data.attempts,
      deliveredAt: input.data.deliveredAt,
      providerRef: input.data.providerRef,
      lastErrorClass: input.data.lastErrorClass,
      nextAttemptAt: input.data.nextAttemptAt,
      claimOwner: null,
      claimToken: null,
      claimExpiresAt: null,
    },
  })
  return updated.count === 1
}
