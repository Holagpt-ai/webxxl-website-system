import { prisma } from '@/lib/db'
import type { AutomationDeliveryChannel } from '@prisma/client'
import { classifyDeliveryError, computeBackoffSeconds } from '@/lib/automation/errors'
import { resolveEventContent } from '@/lib/automation/content'
import { inAppChannel } from '@/lib/automation/channels/in-app'
import { emailChannel } from '@/lib/automation/channels/email'
import { pushChannel, smsChannel, whatsappChannel } from '@/lib/automation/channels/disabled'
import type { NotificationChannel } from '@/lib/automation/channels/types'
import { evaluateInfrastructureRenewalReminders } from '@/lib/automation/renewals'
import { isEnabled } from '@/config/features'
import { preferredLocaleForUser } from '@/lib/i18n/preference-db'
import {
  commitAutomationDeliveryJobClaim,
  recoverExpiredAutomationDeliveryClaims,
  tryClaimAutomationDeliveryJob,
} from '@/lib/automation/delivery-claim'
import {
  DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
  isExternalDeliveryChannel,
} from '@/lib/automation/delivery-outcome'

const CHANNELS: Record<AutomationDeliveryChannel, NotificationChannel> = {
  IN_APP: inAppChannel,
  EMAIL: emailChannel,
  SMS: smsChannel,
  WHATSAPP: whatsappChannel,
  PUSH: pushChannel,
}

export type WorkerRunResult = {
  processed: number
  delivered: number
  failed: number
  dead: number
  renewalEvents: number
}

export async function processAutomationDeliveryBatch(limit = 25): Promise<WorkerRunResult> {
  const now = new Date()
  const workerId = `automation-worker:${process.env.HOSTNAME ?? 'local'}`
  await recoverExpiredAutomationDeliveryClaims(now)
  const jobs = await prisma.automationDeliveryJob.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    include: { event: true },
  })

  let delivered = 0
  let failed = 0
  let dead = 0

  for (const job of jobs) {
    const claim = await tryClaimAutomationDeliveryJob({ jobId: job.id, workerId, now })
    if (!claim.claimed || !claim.claimToken) continue

    const locale = await preferredLocaleForUser(job.recipientUserId)
    const content = resolveEventContent(job.event, locale)
    const channel = CHANNELS[job.channel]
    try {
      const result = await channel.deliver({
        job,
        event: job.event,
        title: content.title,
        body: content.body,
        actionUrl: content.actionUrl,
        locale: content.locale,
      })

      if (result.ok) {
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            providerRef: result.providerRef ?? null,
            lastErrorClass: null,
          },
        })
        if (committed) delivered += 1
        continue
      }

      const attempts = job.attempts + 1
      const errorClass = result.error
      if (
        isExternalDeliveryChannel(job.channel) &&
        (errorClass === 'unknown' || errorClass === 'provider_rejected')
      ) {
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: {
            status: 'DEAD',
            attempts,
            lastErrorClass: DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
            nextAttemptAt: new Date('2099-01-01T00:00:00.000Z'),
          },
        })
        if (committed) dead += 1
        continue
      }
      if (attempts >= job.maxAttempts || errorClass === 'disabled' || errorClass === 'invalid_recipient') {
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: { status: 'DEAD', attempts, lastErrorClass: errorClass },
        })
        if (committed) dead += 1
      } else {
        const backoffSec = computeBackoffSeconds(attempts)
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: {
            status: 'FAILED',
            attempts,
            lastErrorClass: errorClass,
            nextAttemptAt: new Date(Date.now() + backoffSec * 1000),
          },
        })
        if (committed) failed += 1
      }
    } catch (error) {
      const attempts = job.attempts + 1
      const errorClass = classifyDeliveryError(error)
      if (isExternalDeliveryChannel(job.channel)) {
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: {
            status: 'DEAD',
            attempts,
            lastErrorClass: DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
            nextAttemptAt: new Date('2099-01-01T00:00:00.000Z'),
          },
        })
        if (committed) dead += 1
        continue
      }
      if (attempts >= job.maxAttempts) {
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: { status: 'DEAD', attempts, lastErrorClass: errorClass },
        })
        if (committed) dead += 1
      } else {
        const backoffSec = computeBackoffSeconds(attempts)
        const committed = await commitAutomationDeliveryJobClaim({
          jobId: job.id,
          claimToken: claim.claimToken,
          claimFence: claim.fence,
          data: {
            status: 'FAILED',
            attempts,
            lastErrorClass: errorClass,
            nextAttemptAt: new Date(Date.now() + backoffSec * 1000),
          },
        })
        if (committed) failed += 1
      }
    }
  }

  const renewalEvents = isEnabled('automationRenewalReminders')
    ? (await evaluateInfrastructureRenewalReminders()).eventsCreated
    : 0

  return { processed: jobs.length, delivered, failed, dead, renewalEvents }
}

export async function retryAutomationDeliveryJob(jobId: string) {
  const job = await prisma.automationDeliveryJob.findUnique({ where: { id: jobId } })
  if (!job) return { ok: false as const, error: 'not_found' }
  if (job.status !== 'FAILED' && job.status !== 'DEAD') return { ok: false as const, error: 'not_retryable' }
  await prisma.automationDeliveryJob.update({
    where: { id: jobId },
    data: { status: 'PENDING', nextAttemptAt: new Date(), lastErrorClass: null },
  })
  return { ok: true as const }
}
