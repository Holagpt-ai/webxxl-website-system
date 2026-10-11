import { prisma } from '@/lib/db'
import type { AutomationEvent, Prisma } from '@prisma/client'
import { AUTOMATION_EVENT_REGISTRY } from '@/lib/automation/registry'
import { getCustomerNotificationPreference, isChannelAllowedByPreference } from '@/lib/automation/preferences'
import { isEnabled } from '@/config/features'

type Recipient = { userId?: string; email?: string }

async function staffRecipients(): Promise<Recipient[]> {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] } },
    select: { id: true, email: true },
  })
  return staff.map((s) => ({ userId: s.id, email: s.email }))
}

async function customerMemberRecipients(customerAccountId: string): Promise<Recipient[]> {
  const memberships = await prisma.customerMembership.findMany({
    where: { customerAccountId },
    include: { user: { select: { id: true, email: true } } },
  })
  return memberships.map((m) => ({ userId: m.user.id, email: m.user.email }))
}

function resolveRecipientsFromPayload(event: AutomationEvent): Recipient[] {
  const p = event.payload as Record<string, unknown>
  const list = Array.isArray(p.recipients) ? p.recipients : []
  return list
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const row = r as Record<string, unknown>
      return {
        userId: typeof row.userId === 'string' ? row.userId : undefined,
        email: typeof row.email === 'string' ? row.email : undefined,
      }
    })
    .filter(Boolean) as Recipient[]
}

export async function planDeliveriesForEvent(event: AutomationEvent) {
  if (!isEnabled('automationNotifications')) return { created: 0 }

  const def = AUTOMATION_EVENT_REGISTRY[event.eventType]
  const audience = (event.payload as Record<string, unknown>).audience as string | undefined

  let recipients: Recipient[] = resolveRecipientsFromPayload(event)
  if (recipients.length === 0) {
    if (audience === 'customer_members' && event.customerAccountId) {
      recipients = await customerMemberRecipients(event.customerAccountId)
    } else {
      recipients = await staffRecipients()
    }
  }

  const jobs: Prisma.AutomationDeliveryJobCreateManyInput[] = []

  for (const recipient of recipients) {
    if (recipient.userId && event.customerAccountId && !def.essential) {
      const prefs = await getCustomerNotificationPreference(recipient.userId, event.customerAccountId)
      if (!isChannelAllowedByPreference(prefs, def.preferenceCategory, 'IN_APP', def.essential)) continue
    }

    const inAppKey = `${event.dedupeKey}:in_app:${recipient.userId ?? recipient.email ?? 'unknown'}`
    jobs.push({
      dedupeKey: inAppKey,
      eventId: event.id,
      channel: 'IN_APP',
      recipientUserId: recipient.userId ?? null,
      recipientEmail: recipient.email ?? null,
    })

    if (recipient.email && isEnabled('automationEmailChannel')) {
      if (event.customerAccountId && recipient.userId && !def.essential) {
        const prefs = await getCustomerNotificationPreference(recipient.userId, event.customerAccountId)
        if (!isChannelAllowedByPreference(prefs, def.preferenceCategory, 'EMAIL', def.essential)) continue
      }
      jobs.push({
        dedupeKey: `${event.dedupeKey}:email:${recipient.email}`,
        eventId: event.id,
        channel: 'EMAIL',
        recipientUserId: recipient.userId ?? null,
        recipientEmail: recipient.email,
      })
    }
  }

  if (jobs.length === 0) return { created: 0 }
  const result = await prisma.automationDeliveryJob.createMany({ data: jobs, skipDuplicates: true })
  return { created: result.count }
}
