import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

import { computeBackoffSeconds } from '@/lib/automation/errors'
import {
  classifyExpiredExternalDelivery,
  DELIVERY_OUTCOME_LEASE_EXPIRED,
  DELIVERY_OUTCOME_PROVIDER_UNCERTAIN,
  DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
  isQuarantinedDeliveryOutcome,
} from '@/lib/automation/delivery-outcome'

const DEFAULT_CLAIM_TTL_MS = 120_000

const QUARANTINE_NEXT_ATTEMPT = new Date('2099-01-01T00:00:00.000Z')

/** Re-queue notification jobs stuck in PROCESSING after lease expiry (fenced). */
export async function recoverExpiredAutomationDeliveryClaims(now = new Date(), limit = 50): Promise<number> {
  const stuck = await prisma.automationDeliveryJob.findMany({
    where: {
      status: 'PROCESSING',
      claimExpiresAt: { lt: now },
    },
    take: limit,
  })
  let recovered = 0
  for (const job of stuck) {
    const outcome = classifyExpiredExternalDelivery({
      channel: job.channel,
      providerRef: job.providerRef,
      hadDeliveryError: Boolean(job.lastErrorClass),
    })
    const attempts = job.attempts
    const backoffSec = computeBackoffSeconds(Math.max(attempts, 1))
    const quarantine = outcome === 'quarantine'
    const updated = await prisma.automationDeliveryJob.updateMany({
      where: {
        id: job.id,
        status: 'PROCESSING',
        claimFence: job.claimFence,
        claimExpiresAt: { lt: now },
      },
      data: {
        status: quarantine ? 'DEAD' : 'FAILED',
        claimOwner: null,
        claimToken: null,
        claimExpiresAt: null,
        claimFence: job.claimFence + 1,
        lastErrorClass: quarantine ? DELIVERY_OUTCOME_UNKNOWN_EXTERNAL : DELIVERY_OUTCOME_LEASE_EXPIRED,
        nextAttemptAt: quarantine ? QUARANTINE_NEXT_ATTEMPT : new Date(Date.now() + backoffSec * 1000),
      },
    })
    if (updated.count === 1) recovered += 1
  }
  return recovered
}

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
  if (isQuarantinedDeliveryOutcome(job.lastErrorClass)) {
    return { claimed: false, fence: job.claimFence, claimToken: null }
  }
  const nextFence = job.claimFence + 1
  const updated = await prisma.automationDeliveryJob.updateMany({
    where: {
      id: input.jobId,
      status: { in: statuses },
      nextAttemptAt: { lte: now },
      lastErrorClass: {
        notIn: [DELIVERY_OUTCOME_UNKNOWN_EXTERNAL, DELIVERY_OUTCOME_PROVIDER_UNCERTAIN],
      },
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
  const now = new Date()
  const updated = await prisma.automationDeliveryJob.updateMany({
    where: {
      id: input.jobId,
      status: 'PROCESSING',
      claimToken: input.claimToken,
      claimFence: input.claimFence,
      claimExpiresAt: { gt: now },
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
