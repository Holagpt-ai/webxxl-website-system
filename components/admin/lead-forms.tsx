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
import { LEAD_PIPELINE_STAGES, LEAD_STAGE_LABELS } from '@/lib/leads/pipeline'

export function LeadStageForm({ leadId, current }: { leadId: string; current: LeadStage }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

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
          setMessage(result.ok ? 'Stage updated' : result.error)
        })
      }}
    >
      <div>
        <Label htmlFor={`lead-stage-${leadId}`}>Stage</Label>
        <select
          id={`lead-stage-${leadId}`}
          name="stage"
          defaultValue={current}
          className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        >
          {LEAD_PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {LEAD_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Save stage
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

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const assignee = new FormData(e.currentTarget).get('assignedToId') as string
        setMessage(null)
        startTransition(async () => {
          const result = await assignLeadAction(leadId, assignee || null)
          setMessage(result.ok ? 'Assignment saved' : result.error)
        })
      }}
    >
      <div>
        <Label htmlFor={`lead-assign-${leadId}`}>Assigned to</Label>
        <select
          id={`lead-assign-${leadId}`}
          name="assignedToId"
          defaultValue={currentAssigneeId ?? ''}
          className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name || member.email}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Save assignment
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  )
}

export function LeadFollowUpForm({ leadId, followUpAt }: { leadId: string; followUpAt: Date | null }) {
  const [pending, startTransition] = useTransition()
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
        <Label htmlFor={`lead-follow-${leadId}`}>Follow-up date</Label>
        <Input id={`lead-follow-${leadId}`} name="followUpAt" type="date" defaultValue={value} disabled={pending} className="mt-1" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Save follow-up
      </Button>
    </form>
  )
}

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')

  return (
    <div className="space-y-2">
      <Label htmlFor={`lead-note-${leadId}`}>Add internal note</Label>
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
        Add note
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

  if (converted) {
    return <p className="text-sm text-muted-foreground">This lead is already linked to a customer and project.</p>
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">Convert to customer (Won)</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} />
          Create new customer
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} />
          Link existing customer
        </label>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          setMessage(null)
          startTransition(async () => {
            const result = await convertLeadAction({
              leadId,
              mode,
              customerAccountId: (data.get('customerAccountId') as string) || undefined,
              businessName: (data.get('businessName') as string) || undefined,
              projectName: (data.get('projectName') as string) || undefined,
              projectType: (data.get('projectType') as ProjectType) || undefined,
              sendInvite: data.get('sendInvite') === 'on',
              inviteRole: (data.get('inviteRole') as MembershipRole) || 'OWNER',
              locale: (data.get('locale') as 'en' | 'es') || 'en',
            })
            if (!result.ok) {
              setMessage(result.error)
              return
            }
            const conversionLine = result.idempotent
              ? 'Conversion already completed — no duplicate customer or project was created.'
              : 'Conversion succeeded — customer account and project are ready.'
            if (!result.inviteRequested) {
              setMessage(conversionLine)
              return
            }
            if (result.inviteSent) {
              setMessage(`${conversionLine} Portal invitation sent.`)
              return
            }
            setMessage(
              `${conversionLine} Portal invitation failed (${result.inviteError ?? 'delivery_error'}). Open the customer record to resend the invitation — no need to convert again.`,
            )
          })
        }}
      >
        {mode === 'link' ? (
          <div>
            <Label htmlFor={`lead-customer-${leadId}`}>Customer account</Label>
            <select
              id={`lead-customer-${leadId}`}
              name="customerAccountId"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.slug})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Label htmlFor={`lead-business-${leadId}`}>Business name</Label>
            <Input id={`lead-business-${leadId}`} name="businessName" defaultValue={defaultBusinessName} required />
          </div>
        )}
        <div>
          <Label htmlFor={`lead-project-${leadId}`}>Project name</Label>
          <Input id={`lead-project-${leadId}`} name="projectName" defaultValue={defaultProjectName} required />
        </div>
        <div>
          <Label htmlFor={`lead-type-${leadId}`}>Project type</Label>
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
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="sendInvite" defaultChecked />
            Send portal invite to {defaultEmail}
          </label>
          <select name="inviteRole" defaultValue="OWNER" className="rounded-md border px-2 py-1">
            <option value="OWNER">Owner</option>
            <option value="MEMBER">Member</option>
          </select>
          <select name="locale" defaultValue="en" className="rounded-md border px-2 py-1">
            <option value="en">Invite EN</option>
            <option value="es">Invite ES</option>
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
