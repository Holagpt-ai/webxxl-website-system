'use client'

import { useState, useTransition } from 'react'
import type { LeadStage, MembershipRole, ProjectType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  appendLeadNoteAction,
  assignLeadAction,
  convertLeadAction,
  setLeadFollowUpAction,
  updateLeadStageAction,
} from '@/lib/admin/lead-actions'
import { LEAD_PIPELINE_STAGES } from '@/lib/leads/pipeline'
import { useAdminCopy } from '@/components/admin/locale'
import { actionErrorLabel, enumLabel } from '@/lib/i18n/labels'
import { format } from '@/lib/i18n/localize'
import { listProjectTemplates } from '@/lib/project-templates/registry'
import { STANDARD_BUSINESS_WEBSITE_TEMPLATE } from '@/lib/project-templates/standard-business-website'

export function LeadStageForm({ leadId, current }: { leadId: string; current: LeadStage }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const { admin: copy } = useAdminCopy()

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const stage = new FormData(form).get('stage') as string
        setMessage(null)
        startTransition(async () => {
          const result = await updateLeadStageAction(leadId, stage)
          setMessage(result.ok ? copy.leads.stageUpdated : actionErrorLabel(result.error, copy.errors))
        })
      }}
    >
      <div>
        <Label htmlFor={`lead-stage-${leadId}`}>{copy.leads.stage}</Label>
        <select
          id={`lead-stage-${leadId}`}
          name="stage"
          defaultValue={current}
          className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        >
          {LEAD_PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {enumLabel(copy.leads.stages, stage)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.leads.saveStage}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}

export function LeadAssignForm({
  leadId,
  currentAssigneeId,
  staff,
}: {
  leadId: string
  currentAssigneeId: string | null
  staff: { id: string; email: string; name: string | null }[]
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const { admin: copy } = useAdminCopy()

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const assignee = new FormData(e.currentTarget).get('assignedToId') as string
        setMessage(null)
        startTransition(async () => {
          const result = await assignLeadAction(leadId, assignee || null)
          setMessage(result.ok ? copy.leads.assignmentSaved : actionErrorLabel(result.error, copy.errors))
        })
      }}
    >
      <div>
        <Label htmlFor={`lead-assign-${leadId}`}>{copy.leads.assignedTo}</Label>
        <select
          id={`lead-assign-${leadId}`}
          name="assignedToId"
          defaultValue={currentAssigneeId ?? ''}
          className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        >
          <option value="">{copy.unassigned}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name || member.email}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.leads.saveAssignment}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}

export function LeadFollowUpForm({ leadId, followUpAt }: { leadId: string; followUpAt: Date | null }) {
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
  const value = followUpAt ? followUpAt.toISOString().slice(0, 10) : ''

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const date = new FormData(e.currentTarget).get('followUpAt') as string
        startTransition(async () => {
          await setLeadFollowUpAction(leadId, date || null)
        })
      }}
    >
      <div>
        <Label htmlFor={`lead-follow-${leadId}`}>{copy.leads.followUp}</Label>
        <Input id={`lead-follow-${leadId}`} name="followUpAt" type="date" defaultValue={value} disabled={pending} className="mt-1" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {copy.leads.saveFollowUp}
      </Button>
    </form>
  )
}

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const { admin: copy } = useAdminCopy()

  return (
    <div className="space-y-2">
      <Label htmlFor={`lead-note-${leadId}`}>{copy.leads.addNote}</Label>
      <Textarea
        id={`lead-note-${leadId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        disabled={pending}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !note.trim()}
        onClick={() => {
          startTransition(async () => {
            const result = await appendLeadNoteAction(leadId, note)
            if (result.ok) setNote('')
          })
        }}
      >
        {copy.leads.addNoteButton}
      </Button>
    </div>
  )
}

const PROJECT_TYPES: ProjectType[] = ['WEBSITE', 'REDESIGN', 'ECOMMERCE', 'LANDING', 'CRM', 'OTHER']

export function LeadConvertForm({
  leadId,
  defaultBusinessName,
  defaultProjectName,
  defaultEmail,
  customers,
  converted,
}: {
  leadId: string
  defaultBusinessName: string
  defaultProjectName: string
  defaultEmail: string
  customers: { id: string; businessName: string; slug: string }[]
  converted: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [message, setMessage] = useState<string | null>(null)
  const { admin: copy } = useAdminCopy()

  if (converted) {
    return <p className="text-sm text-muted-foreground">{copy.leads.alreadyConverted}</p>
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">{copy.leads.convertTitle}</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} />
          {copy.leads.createCustomer}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} />
          {copy.leads.linkCustomer}
        </label>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          setMessage(null)
          startTransition(async () => {
            const templateRaw = (data.get('templateId') as string) || undefined
            const result = await convertLeadAction({
              leadId,
              mode,
              customerAccountId: (data.get('customerAccountId') as string) || undefined,
              businessName: (data.get('businessName') as string) || undefined,
              projectName: (data.get('projectName') as string) || undefined,
              projectType: (data.get('projectType') as ProjectType) || undefined,
              templateId: templateRaw === '__none__' ? null : templateRaw,
              sendInvite: data.get('sendInvite') === 'on',
              inviteRole: (data.get('inviteRole') as MembershipRole) || 'OWNER',
              locale: (data.get('locale') as 'en' | 'es') || 'en',
            })
            if (!result.ok) {
              setMessage(result.error)
              return
            }
            const conversionLine = result.idempotent ? copy.leads.convertedIdempotent : copy.leads.convertedReady
            if (!result.inviteRequested) {
              setMessage(conversionLine)
              return
            }
            if (result.inviteSent) {
              setMessage(`${conversionLine} ${copy.leads.inviteSent}`)
              return
            }
            if (result.inviteError === 'auth_email_not_configured' || result.inviteError === 'not_configured') {
              setMessage(`${conversionLine} ${copy.leads.invitePendingEmail}`)
              return
            }
            setMessage(
              `${conversionLine} ${format(copy.leads.inviteFailed, { error: result.inviteError ?? 'delivery_error' })}`,
            )
          })
        }}
      >
        {mode === 'link' ? (
          <div>
            <Label htmlFor={`lead-customer-${leadId}`}>{copy.customer}</Label>
            <select
              id={`lead-customer-${leadId}`}
              name="customerAccountId"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">{copy.customer}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.slug})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label htmlFor={`lead-business-${leadId}`}>{copy.customers.business}</Label>
            <Input id={`lead-business-${leadId}`} name="businessName" defaultValue={defaultBusinessName} required />
          </div>
        )}
        <div>
          <Label htmlFor={`lead-project-${leadId}`}>{copy.project}</Label>
          <Input id={`lead-project-${leadId}`} name="projectName" defaultValue={defaultProjectName} required />
        </div>
        <div>
          <Label htmlFor={`lead-type-${leadId}`}>{copy.leads.projectTypeLabel}</Label>
          <select
            id={`lead-type-${leadId}`}
            name="projectType"
            defaultValue="WEBSITE"
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`lead-template-${leadId}`}>{copy.leads.templateLabel}</Label>
          <select
            id={`lead-template-${leadId}`}
            name="templateId"
            defaultValue={STANDARD_BUSINESS_WEBSITE_TEMPLATE.id}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {listProjectTemplates().map((template) => (
              <option key={template.id} value={template.id}>
                {template.displayName}
              </option>
            ))}
            <option value="__none__">{copy.leads.templateNone}</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{copy.leads.templateHelp}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="sendInvite" defaultChecked />
            Send portal invite to {defaultEmail}
          </label>
          <select name="inviteRole" defaultValue="OWNER" className="rounded-md border px-2 py-1">
            <option value="OWNER">{copy.owner}</option>
            <option value="MEMBER">{copy.member}</option>
          </select>
          <select name="locale" defaultValue="en" className="rounded-md border px-2 py-1">
            <option value="en">{copy.english}</option>
            <option value="es">{copy.spanish}</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          Convert lead
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </form>
    </div>
  )
}
