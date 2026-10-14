import { prisma } from '@/lib/db'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { syncProjectProgressFromEta } from '@/lib/admin/sync-project-eta'
import { automationHooks } from '@/lib/automation/hooks'
import type { MembershipRole, ProjectType } from '@prisma/client'
import { slugifyBusinessName } from '@/lib/leads/slug'
import { mapIntakeProjectType } from '@/lib/leads/project-type'
import { writeLeadActivity } from '@/lib/leads/activity'
import type { CustomerAccessLocale } from '@/lib/portal/customer-access'
import { provisionCustomerInvite } from '@/lib/portal/customer-invite-provision'
import { getProjectTemplate, resolveLeadConversionTemplateId } from '@/lib/project-templates/registry'
import { instantiateProjectTemplate } from '@/lib/project-templates/instantiate'

export type ConvertLeadInput = {
  leadId: string
  actorUserId: string
  mode: 'link' | 'create'
  customerAccountId?: string
  businessName?: string
  projectName?: string
  projectType?: ProjectType
  projectSummary?: string
  templateId?: string | null
  sendInvite?: boolean
  inviteRole?: MembershipRole
  locale?: CustomerAccessLocale
}

export type ConvertLeadResult =
  | {
      ok: true
      idempotent: boolean
      customerAccountId: string
      projectId: string
      inviteRequested: boolean
      inviteSent: boolean
      inviteError?: string
    }
  | { ok: false; error: string }

function defaultProjectName(lead: { businessName: string | null; headline: string | null; contactName: string | null }) {
  return lead.businessName?.trim() || lead.headline?.trim() || `${lead.contactName ?? 'Customer'} website`
}

function payloadProjectType(payload: unknown): ProjectType | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  if (typeof record.projectType === 'string') return mapIntakeProjectType(record.projectType)
  return undefined
}

export async function convertLeadToCustomer(input: ConvertLeadInput): Promise<ConvertLeadResult> {
  const locale: CustomerAccessLocale = input.locale === 'es' ? 'es' : 'en'

  const txResult = await prisma.$transaction(async (tx) => {
    const lead = await tx.salesLead.findUnique({ where: { id: input.leadId } })
    if (!lead) return { kind: 'error' as const, error: 'not_found' }

    if (lead.customerAccountId && lead.projectId) {
      return {
        kind: 'ok' as const,
        idempotent: true,
        customerAccountId: lead.customerAccountId,
        projectId: lead.projectId,
        contactEmail: lead.contactEmail,
      }
    }

    if (lead.stage === 'LOST') return { kind: 'error' as const, error: 'invalid_stage' }

    let customerAccountId = input.customerAccountId?.trim()
    if (input.mode === 'link') {
      if (!customerAccountId) return { kind: 'error' as const, error: 'customer_required' }
      const existing = await tx.customerAccount.findUnique({ where: { id: customerAccountId } })
      if (!existing) return { kind: 'error' as const, error: 'customer_not_found' }
    } else {
      const businessName = (input.businessName ?? lead.businessName ?? lead.contactName ?? 'New customer').trim()
      if (!businessName) return { kind: 'error' as const, error: 'business_name_required' }

      const email = lead.contactEmail.trim().toLowerCase()
      const emailCollision = await tx.customerAccount.findFirst({
        where: { primaryContactEmail: { equals: email, mode: 'insensitive' } },
      })
      if (emailCollision) return { kind: 'error' as const, error: 'customer_email_exists' }

      const baseSlug = slugifyBusinessName(businessName)
      let slug = baseSlug
      let slugSuffix = 0
      while (await tx.customerAccount.findUnique({ where: { slug } })) {
        slugSuffix += 1
        slug = `${baseSlug}-${slugSuffix}`
      }
      const created = await tx.customerAccount.create({
        data: {
          businessName,
          slug,
          status: 'ONBOARDING',
          primaryContactName: lead.contactName,
          primaryContactEmail: email,
          locale: lead.locale || 'en',
        },
      })
      customerAccountId = created.id
    }

    const claimed = await tx.salesLead.updateMany({
      where: {
        id: lead.id,
        customerAccountId: null,
        projectId: null,
      },
      data: {
        stage: 'WON',
        customerAccountId,
        convertedAt: new Date(),
        convertedById: input.actorUserId,
      },
    })
    if (claimed.count !== 1) {
      const refreshed = await tx.salesLead.findUnique({ where: { id: lead.id } })
      if (refreshed?.customerAccountId && refreshed.projectId) {
        return {
          kind: 'ok' as const,
          idempotent: true,
          customerAccountId: refreshed.customerAccountId,
          projectId: refreshed.projectId,
          contactEmail: refreshed.contactEmail,
        }
      }
      return { kind: 'error' as const, error: 'conversion_race' }
    }

    const projectName = (input.projectName ?? defaultProjectName(lead)).trim()
    const projectType = input.projectType ?? payloadProjectType(lead.payload) ?? 'WEBSITE'
    const templateId = resolveLeadConversionTemplateId({ projectType, templateId: input.templateId })
    const template = templateId ? getProjectTemplate(templateId) : null
    if (templateId && !template) return { kind: 'error' as const, error: 'invalid_template' }

    const project = await tx.project.create({
      data: {
        customerAccountId: customerAccountId!,
        name: projectName,
        type: template?.projectType ?? projectType,
        status: 'ACTIVE',
        summary: input.projectSummary?.trim() || lead.headline || template?.description || lead.headline || null,
        templateId: template?.id ?? null,
        templateVersion: template?.version ?? null,
      },
    })

    if (template) {
      await instantiateProjectTemplate(project.id, template, tx)
    }

    await tx.salesLead.update({
      where: { id: lead.id },
      data: { projectId: project.id },
    })

    return {
      kind: 'ok' as const,
      idempotent: false,
      customerAccountId: customerAccountId!,
      projectId: project.id,
      projectName,
      templateId: template?.id ?? null,
      leadId: lead.id,
      contactEmail: lead.contactEmail,
    }
  })

  if (txResult.kind === 'error') return { ok: false, error: txResult.error }

  if (!txResult.idempotent) {
    await writeProjectActivity({
      projectId: txResult.projectId,
      actorUserId: input.actorUserId,
      eventType: 'PROJECT_CREATED',
      summary: formatActivitySummary('PROJECT_CREATED', txResult.projectName ?? 'Project'),
      metadata: txResult.templateId ? { templateId: txResult.templateId, source: 'lead_conversion' } : { source: 'lead_conversion' },
    })
    await syncProjectProgressFromEta(txResult.projectId)
    if (txResult.templateId) {
      await prisma.customerAccount.updateMany({
        where: { id: txResult.customerAccountId, status: 'ONBOARDING' },
        data: { status: 'ACTIVE' },
      })
    }
    await writeLeadActivity({
      leadId: txResult.leadId!,
      actorUserId: input.actorUserId,
      type: 'CONVERTED',
      summary: 'Lead converted to customer account and project',
      metadata: {
        customerAccountId: txResult.customerAccountId,
        projectId: txResult.projectId,
      },
    })
    await automationHooks.leadConverted({
      leadId: txResult.leadId!,
      customerAccountId: txResult.customerAccountId,
    })
  }

  const inviteRequested = Boolean(input.sendInvite)
  let inviteSent = false
  let inviteError: string | undefined
  if (inviteRequested) {
    const leadEmail = txResult.contactEmail ?? (await prisma.salesLead.findUnique({ where: { id: input.leadId } }))?.contactEmail
    const invite = await provisionCustomerInvite({
      customerAccountId: txResult.customerAccountId,
      email: leadEmail ?? '',
      role: input.inviteRole ?? 'OWNER',
      locale,
      sendEmail: true,
    })
    if (!invite.ok) {
      inviteError = invite.error
      const leadIdForActivity = txResult.leadId ?? input.leadId
      await writeLeadActivity({
        leadId: leadIdForActivity,
        actorUserId: input.actorUserId,
        type: 'NOTE_ADDED',
        summary: 'Portal invitation failed after successful conversion',
        metadata: { inviteError: invite.error },
      })
    } else {
      inviteSent = invite.inviteSent
      inviteError = invite.inviteError
      if (inviteRequested && !inviteSent) {
        const leadIdForActivity = txResult.leadId ?? input.leadId
        await writeLeadActivity({
          leadId: leadIdForActivity,
          actorUserId: input.actorUserId,
          type: 'NOTE_ADDED',
          summary: 'Portal invitation pending email configuration',
          metadata: { inviteError: invite.inviteError ?? 'delivery_pending' },
        })
      }
    }
  }

  return {
    ok: true,
    idempotent: txResult.idempotent,
    customerAccountId: txResult.customerAccountId,
    projectId: txResult.projectId,
    inviteRequested,
    inviteSent,
    inviteError,
  }
}
