import { prisma } from '@/lib/db'
import { allocateUniqueCustomerSlug } from '@/lib/leads/slug'
import { getProjectTemplate } from '@/lib/project-templates/registry'
import { instantiateProjectTemplate } from '@/lib/project-templates/instantiate'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { syncProjectProgressFromEta } from '@/lib/admin/sync-project-eta'
import { automationHooks } from '@/lib/automation/hooks'
import type { MembershipRole, ProjectType } from '@prisma/client'
import {
  isAllowedInviteRole,
  isValidCustomerInviteEmail,
  normalizeCustomerInviteEmail,
  type CustomerAccessLocale,
} from '@/lib/portal/customer-access'
import { isStaffRole } from '@/lib/admin/roles'
import type { UserRole } from '@prisma/client'

export type CreateCustomerAccountInput = {
  businessName: string
  slug?: string
  primaryContactName?: string
  primaryContactEmail?: string
  locale?: string
}

export type CreateCustomerAccountResult =
  | { ok: true; customerAccountId: string; slug: string; created: boolean }
  | { ok: false; error: 'empty' | 'duplicate_slug' | 'invalid_email' }

export async function createCustomerAccountRecord(input: CreateCustomerAccountInput): Promise<CreateCustomerAccountResult> {
  const businessName = input.businessName.trim()
  if (!businessName) return { ok: false, error: 'empty' }

  if (input.primaryContactEmail) {
    const email = normalizeCustomerInviteEmail(input.primaryContactEmail)
    if (!email || !isValidCustomerInviteEmail(email)) return { ok: false, error: 'invalid_email' }
  }

  let slug = input.slug?.trim().toLowerCase() || (await allocateUniqueCustomerSlug(businessName))
  slug = slug.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'customer'

  const existing = await prisma.customerAccount.findUnique({ where: { slug } })
  if (existing) {
    if (input.slug) return { ok: false, error: 'duplicate_slug' }
    slug = await allocateUniqueCustomerSlug(businessName)
  }

  const created = await prisma.customerAccount.create({
    data: {
      businessName,
      slug,
      status: 'ONBOARDING',
      primaryContactName: input.primaryContactName?.trim() || null,
      primaryContactEmail: input.primaryContactEmail
        ? normalizeCustomerInviteEmail(input.primaryContactEmail)
        : null,
      locale: input.locale === 'es' ? 'es' : 'en',
    },
  })

  return { ok: true, customerAccountId: created.id, slug: created.slug, created: true }
}

export async function provisionMembershipWithoutInvite(input: {
  customerAccountId: string
  email: string
  role: MembershipRole
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeCustomerInviteEmail(input.email)
  if (!normalized || !isValidCustomerInviteEmail(normalized)) return { ok: false, error: 'invalid_email' }
  if (!isAllowedInviteRole(input.role)) return { ok: false, error: 'invalid_email' }

  let user = await prisma.user.findUnique({ where: { email: normalized } })
  if (user && isStaffRole(user.role as UserRole)) return { ok: false, error: 'staff_account_not_allowed' }
  if (!user) {
    user = await prisma.user.create({
      data: { email: normalized, role: 'CUSTOMER', emailVerified: null },
    })
  } else if (user.role !== 'CUSTOMER') {
    return { ok: false, error: 'staff_account_not_allowed' }
  }

  const now = new Date()
  await prisma.customerMembership.upsert({
    where: { userId_customerAccountId: { userId: user.id, customerAccountId: input.customerAccountId } },
    create: {
      userId: user.id,
      customerAccountId: input.customerAccountId,
      role: input.role,
      invitedAt: now,
    },
    update: { role: input.role },
  })
  return { ok: true }
}

export async function createProjectFromTemplate(input: {
  actorUserId: string
  customerAccountId: string
  name: string
  templateId: string
  summary?: string
  targetDate?: Date | null
  projectType?: ProjectType
}): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'empty' }
  const template = getProjectTemplate(input.templateId)
  if (!template) return { ok: false, error: 'invalid_template' }

  const account = await prisma.customerAccount.findUnique({ where: { id: input.customerAccountId } })
  if (!account) return { ok: false, error: 'not_found' }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        customerAccountId: input.customerAccountId,
        name,
        type: input.projectType ?? template.projectType,
        status: 'ACTIVE',
        summary: input.summary?.trim() || template.description,
        targetDate: input.targetDate ?? null,
        templateId: template.id,
        templateVersion: template.version,
      },
    })
    await instantiateProjectTemplate(created.id, template, tx)
    return created
  })

  await writeProjectActivity({
    projectId: project.id,
    actorUserId: input.actorUserId,
    eventType: 'PROJECT_CREATED',
    summary: formatActivitySummary('PROJECT_CREATED', `${name} (${template.id}@${template.version})`),
    metadata: { templateId: template.id, templateVersion: template.version },
  })
  await automationHooks.projectCreated({
    projectId: project.id,
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    projectName: name,
  })
  await syncProjectProgressFromEta(project.id)

  if (account.status === 'ONBOARDING') {
    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { status: 'ACTIVE' },
    })
  }

  return { ok: true, projectId: project.id }
}
