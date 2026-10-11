import { prisma } from '@/lib/db'
import { automationHooks } from '@/lib/automation/hooks'
import { writeInfrastructureActivity } from '@/lib/infrastructure/activity'

export const INFRASTRUCTURE_REQUEST_TYPES = [
  'domain_registration',
  'domain_transfer',
  'dns_modification',
  'hosting_setup',
  'hosting_migration',
  'ssl_assistance',
  'email_setup',
  'mailbox_addition',
  'renewal_assistance',
] as const

export type InfrastructureRequestType = (typeof INFRASTRUCTURE_REQUEST_TYPES)[number]

export function isInfrastructureRequestType(value: string): value is InfrastructureRequestType {
  return (INFRASTRUCTURE_REQUEST_TYPES as readonly string[]).includes(value)
}

const REQUEST_LABELS: Record<InfrastructureRequestType, { en: string; es: string }> = {
  domain_registration: { en: 'Domain registration assistance', es: 'Asistencia con registro de dominio' },
  domain_transfer: { en: 'Domain transfer assistance', es: 'Asistencia con transferencia de dominio' },
  dns_modification: { en: 'DNS modification request', es: 'Solicitud de modificación DNS' },
  hosting_setup: { en: 'Hosting setup request', es: 'Solicitud de configuración de hosting' },
  hosting_migration: { en: 'Hosting migration request', es: 'Solicitud de migración de hosting' },
  ssl_assistance: { en: 'SSL assistance', es: 'Asistencia con SSL' },
  email_setup: { en: 'Business email setup', es: 'Configuración de correo empresarial' },
  mailbox_addition: { en: 'Mailbox addition', es: 'Agregar buzón' },
  renewal_assistance: { en: 'Renewal assistance', es: 'Asistencia con renovación' },
}

export function infrastructureRequestSubject(type: InfrastructureRequestType, locale: 'en' | 'es'): string {
  const label = REQUEST_LABELS[type][locale]
  return `[Infrastructure] ${label}`
}

function activityAssetForRequest(type: InfrastructureRequestType): 'HOSTING' | 'DOMAIN' | 'EMAIL' {
  if (type === 'domain_registration' || type === 'domain_transfer' || type === 'dns_modification') return 'DOMAIN'
  if (type === 'email_setup' || type === 'mailbox_addition') return 'EMAIL'
  return 'HOSTING'
}

export async function createInfrastructureSupportRequest(input: {
  customerAccountId: string
  actorUserId: string
  type: InfrastructureRequestType
  locale: 'en' | 'es'
  message: string
  projectId?: string | null
  assetPublicId?: string | null
}) {
  const body = input.message.trim()
  if (!body) return { ok: false as const, error: 'empty' }

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, customerAccountId: input.customerAccountId },
    })
    if (!project) return { ok: false as const, error: 'invalid_project' }
  }

  const subject = infrastructureRequestSubject(input.type, input.locale)
  const recent = await prisma.supportRequest.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      subject,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (recent && recent.message.includes(body.slice(0, 120))) {
    return { ok: true as const, duplicate: true, supportRequestId: recent.id }
  }

  const fullMessage = [
    `Request type: ${input.type}`,
    input.assetPublicId ? `Asset: ${input.assetPublicId}` : null,
    '',
    body,
    '',
    'This request requires human review. No automatic DNS, registrar, hosting, or mailbox changes were made.',
  ]
    .filter(Boolean)
    .join('\n')

  const ticket = await prisma.supportRequest.create({
    data: {
      customerAccountId: input.customerAccountId,
      projectId: input.projectId ?? null,
      subject,
      message: fullMessage,
    },
  })

  await automationHooks.infrastructureSupportRequestSubmitted({
    supportRequestId: ticket.id,
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    subject,
  })

  const assetType = activityAssetForRequest(input.type)
  let assetId: string | null = null
  if (input.assetPublicId) {
    if (assetType === 'HOSTING') {
      const row = await prisma.hostingService.findFirst({
        where: { publicId: input.assetPublicId, customerAccountId: input.customerAccountId },
        select: { id: true },
      })
      assetId = row?.id ?? null
    } else if (assetType === 'DOMAIN') {
      const row = await prisma.managedDomain.findFirst({
        where: { publicId: input.assetPublicId, customerAccountId: input.customerAccountId },
        select: { id: true },
      })
      assetId = row?.id ?? null
    } else {
      const row = await prisma.businessEmailService.findFirst({
        where: { publicId: input.assetPublicId, customerAccountId: input.customerAccountId },
        select: { id: true },
      })
      assetId = row?.id ?? null
    }
  }

  if (assetId) {
    await writeInfrastructureActivity({
      assetType,
      assetId,
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      summary: `Infrastructure request submitted: ${input.type}`,
      metadata: { supportRequestId: ticket.id, requestType: input.type, assetPublicId: input.assetPublicId },
    })
  }

  return { ok: true as const, duplicate: false, supportRequestId: ticket.id }
}
