'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireStaff } from '@/lib/portal/authz'
import { isLeadPipelineStage } from '@/lib/leads/pipeline'
import { writeLeadActivity } from '@/lib/leads/activity'
import { convertLeadToCustomer } from '@/lib/leads/conversion'
import type { MembershipRole, ProjectType } from '@prisma/client'
import type { CustomerAccessLocale } from '@/lib/portal/customer-access'

export type LeadActionResult = { ok: true } | { ok: false; error: string }

function revalidateLeads() {
  revalidatePath('/admin/leads')
  revalidatePath('/es/admin/leads')
}

export async function updateLeadStageAction(leadId: string, stage: string): Promise<LeadActionResult> {
  try {
    const staff = await requireStaff()
    if (!isLeadPipelineStage(stage)) return { ok: false, error: 'invalid_stage' }
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
    if (!lead) return { ok: false, error: 'not_found' }
    if (lead.stage === stage) return { ok: true }
    await prisma.salesLead.update({ where: { id: leadId }, data: { stage } })
    await writeLeadActivity({
      leadId,
      actorUserId: staff.id,
      type: 'STAGE_CHANGED',
      summary: `Stage changed from ${lead.stage} to ${stage}`,
      metadata: { from: lead.stage, to: stage },
    })
    revalidateLeads()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function assignLeadAction(leadId: string, assignedToId: string | null): Promise<LeadActionResult> {
  try {
    const staff = await requireStaff()
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
    if (!lead) return { ok: false, error: 'not_found' }
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } })
      if (!assignee || (assignee.role !== 'STAFF' && assignee.role !== 'ADMIN')) {
        return { ok: false, error: 'invalid_assignee' }
      }
    }
    await prisma.salesLead.update({ where: { id: leadId }, data: { assignedToId } })
    await writeLeadActivity({
      leadId,
      actorUserId: staff.id,
      type: 'ASSIGNED',
      summary: assignedToId ? 'Lead assigned' : 'Lead unassigned',
      metadata: { assignedToId },
    })
    revalidateLeads()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function setLeadFollowUpAction(leadId: string, followUpAt: string | null): Promise<LeadActionResult> {
  try {
    const staff = await requireStaff()
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
    if (!lead) return { ok: false, error: 'not_found' }
    const date = followUpAt ? new Date(followUpAt) : null
    if (followUpAt && Number.isNaN(date?.getTime())) return { ok: false, error: 'invalid_date' }
    await prisma.salesLead.update({ where: { id: leadId }, data: { followUpAt: date } })
    await writeLeadActivity({
      leadId,
      actorUserId: staff.id,
      type: 'FOLLOW_UP_SET',
      summary: date ? `Follow-up scheduled for ${date.toISOString().slice(0, 10)}` : 'Follow-up cleared',
    })
    revalidateLeads()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function appendLeadNoteAction(leadId: string, note: string): Promise<LeadActionResult> {
  try {
    const staff = await requireStaff()
    const trimmed = note.trim()
    if (!trimmed) return { ok: false, error: 'empty' }
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
    if (!lead) return { ok: false, error: 'not_found' }
    const merged = lead.internalNotes ? `${lead.internalNotes}\n\n${trimmed}` : trimmed
    await prisma.salesLead.update({ where: { id: leadId }, data: { internalNotes: merged } })
    await writeLeadActivity({
      leadId,
      actorUserId: staff.id,
      type: 'NOTE_ADDED',
      summary: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
    })
    revalidateLeads()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function convertLeadAction(input: {
  leadId: string
  mode: 'link' | 'create'
  customerAccountId?: string
  businessName?: string
  projectName?: string
  projectType?: ProjectType
  projectSummary?: string
  sendInvite?: boolean
  inviteRole?: MembershipRole
  locale?: CustomerAccessLocale
}): Promise<
  | {
      ok: true
      customerAccountId: string
      projectId: string
      idempotent: boolean
      inviteRequested: boolean
      inviteSent: boolean
      inviteError?: string
    }
  | { ok: false; error: string }
> {
  try {
    const staff = await requireStaff()
    const result = await convertLeadToCustomer({
      ...input,
      actorUserId: staff.id,
    })
    if (!result.ok) return result
    revalidateLeads()
    revalidatePath('/admin/customers')
    revalidatePath('/admin/projects')
    revalidatePath('/es/admin/customers')
    revalidatePath('/es/admin/projects')
    return {
      ok: true,
      customerAccountId: result.customerAccountId,
      projectId: result.projectId,
      idempotent: result.idempotent,
      inviteRequested: result.inviteRequested,
      inviteSent: result.inviteSent,
      inviteError: result.inviteError,
    }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
