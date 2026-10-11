import { prisma } from '@/lib/db'
import type { InfrastructureAssetType } from '@prisma/client'
import { emitAutomationEvent } from '@/lib/automation/dispatch'

export const RENEWAL_REMINDER_WINDOWS_DAYS = [30, 14, 7] as const

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

function matchWindow(daysLeft: number): (typeof RENEWAL_REMINDER_WINDOWS_DAYS)[number] | null {
  for (const window of RENEWAL_REMINDER_WINDOWS_DAYS) {
    if (daysLeft === window) return window
  }
  return null
}

async function scheduleRenewalIfDue(input: {
  assetType: InfrastructureAssetType
  assetId: string
  customerAccountId: string
  expiresAt: Date
  eventType: 'DOMAIN_RENEWAL_APPROACHING' | 'HOSTING_RENEWAL_APPROACHING' | 'EMAIL_SERVICE_RENEWAL_APPROACHING'
  label: string
  actionUrl: string
}) {
  const window = matchWindow(daysUntil(input.expiresAt))
  if (!window) return false

  const existing = await prisma.infrastructureRenewalReminder.findUnique({
    where: {
      assetType_assetId_windowDays: { assetType: input.assetType, assetId: input.assetId, windowDays: window },
    },
  })
  if (existing) return false

  const dedupeKey = `renewal:${input.assetType}:${input.assetId}:${window}`
  await emitAutomationEvent({
    eventType: input.eventType,
    dedupeKey,
    customerAccountId: input.customerAccountId,
    payload: {
      audience: 'customer_members',
      title: input.label,
      body: `${input.label} — ${window} days remaining (${input.expiresAt.toISOString().slice(0, 10)}).`,
      actionUrl: input.actionUrl,
    },
  })

  await prisma.infrastructureRenewalReminder.create({
    data: { assetType: input.assetType, assetId: input.assetId, windowDays: window },
  })
  return true
}

export async function evaluateInfrastructureRenewalReminders() {
  let eventsCreated = 0
  const [domains, hosting, email] = await Promise.all([
    prisma.managedDomain.findMany({ where: { expiresAt: { not: null } }, select: { id: true, customerAccountId: true, expiresAt: true, domainName: true, publicId: true } }),
    prisma.hostingService.findMany({ where: { renewsAt: { not: null } }, select: { id: true, customerAccountId: true, renewsAt: true, publicId: true, primaryDomain: true } }),
    prisma.businessEmailService.findMany({ where: { renewsAt: { not: null } }, select: { id: true, customerAccountId: true, renewsAt: true, publicId: true } }),
  ])

  for (const d of domains) {
    if (!d.expiresAt) continue
    const ok = await scheduleRenewalIfDue({
      assetType: 'DOMAIN',
      assetId: d.id,
      customerAccountId: d.customerAccountId,
      expiresAt: d.expiresAt,
      eventType: 'DOMAIN_RENEWAL_APPROACHING',
      label: `Domain renewal: ${d.domainName}`,
      actionUrl: '/dashboard/infrastructure/domains',
    })
    if (ok) eventsCreated += 1
  }

  for (const h of hosting) {
    if (!h.renewsAt) continue
    const ok = await scheduleRenewalIfDue({
      assetType: 'HOSTING',
      assetId: h.id,
      customerAccountId: h.customerAccountId,
      expiresAt: h.renewsAt,
      eventType: 'HOSTING_RENEWAL_APPROACHING',
      label: `Hosting renewal: ${h.primaryDomain ?? h.publicId}`,
      actionUrl: '/dashboard/infrastructure/hosting',
    })
    if (ok) eventsCreated += 1
  }

  for (const e of email) {
    if (!e.renewsAt) continue
    const ok = await scheduleRenewalIfDue({
      assetType: 'EMAIL',
      assetId: e.id,
      customerAccountId: e.customerAccountId,
      expiresAt: e.renewsAt,
      eventType: 'EMAIL_SERVICE_RENEWAL_APPROACHING',
      label: `Business email renewal: ${e.publicId}`,
      actionUrl: '/dashboard/infrastructure/email',
    })
    if (ok) eventsCreated += 1
  }

  return { eventsCreated }
}
