'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  addCustomerMembershipAction,
  createApprovalRequestAction,
  createProjectAction,
  removeMembershipAction,
  updateChangeRequestStatusAction,
  updateCustomerAccountStatusAction,
  updateMembershipRoleAction,
  updateProjectAction,
  updateSupportRequestStatusAction,
  upsertCustomerServiceAction,
  upsertDependencyAction,
  upsertMilestoneAction,
  upsertTaskAction,
} from '@/lib/admin/actions'

export function CustomerStatusForm({
  customerId,
  current,
}: {
  customerId: string
  current: string
}) {
  const [status, setStatus] = useState(current)
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => void updateCustomerAccountStatusAction(customerId, status as never))
      }}
    >
      <div>
        <Label htmlFor="acct-status">Account status</Label>
        <select
          id="acct-status"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['ACTIVE', 'ONBOARDING', 'PAUSED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  )
}

export function AddMembershipForm({ customerId }: { customerId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await addCustomerMembershipAction(customerId, email, role as never)
          setEmail('')
        })
      }}
    >
      <div>
        <Label htmlFor="member-email">Existing user email</Label>
        <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="member-role">Membership role</Label>
        <select
          id="member-role"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="OWNER">OWNER</option>
          <option value="MEMBER">MEMBER</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        Add membership
      </Button>
    </form>
  )
}

export function MembershipRowActions({ membershipId, role }: { membershipId: string; role: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => void updateMembershipRoleAction(membershipId, role === 'OWNER' ? 'MEMBER' : 'OWNER'))
        }
      >
        Toggle role
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => void removeMembershipAction(membershipId))}
      >
        Remove
      </Button>
    </div>
  )
}

export function CreateProjectForm({ customerAccountId }: { customerAccountId: string }) {
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await createProjectAction({ customerAccountId, name, type: 'WEBSITE' })
          setName('')
        })
      }}
    >
      <div className="min-w-[200px] flex-1">
        <Label htmlFor="proj-name">New project</Label>
        <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <Button type="submit" disabled={pending}>
        Create
      </Button>
    </form>
  )
}

export function ProjectStatusForm({
  projectId,
  status,
  progressPercent,
}: {
  projectId: string
  status: string
  progressPercent: number
}) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() =>
          void updateProjectAction(projectId, {
            status: fd.get('status') as never,
            progressPercent: Number(fd.get('progress')),
          }),
        )
      }}
    >
      <div>
        <Label htmlFor="p-status">Status</Label>
        <select id="p-status" name="status" defaultValue={status} className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm">
          {['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="p-progress">Progress %</Label>
        <Input id="p-progress" name="progress" type="number" min={0} max={100} defaultValue={progressPercent} className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>
        Update project
      </Button>
    </form>
  )
}

export function MilestoneForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await upsertMilestoneAction(projectId, { title, sortOrder: 99 })
          setTitle('')
        })
      }}
    >
      <Input placeholder="Milestone title" value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        Add milestone
      </Button>
    </form>
  )
}

export function MilestoneStatusButton({
  projectId,
  milestoneId,
  title,
  status,
}: {
  projectId: string
  milestoneId: string
  title: string
  status: string
}) {
  const [pending, startTransition] = useTransition()
  const next = status === 'PENDING' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING'
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => void upsertMilestoneAction(projectId, { id: milestoneId, title, status: next as never }))}
    >
      → {next}
    </Button>
  )
}

export function TaskForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await upsertTaskAction(projectId, { title })
          setTitle('')
        })
      }}
    >
      <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        Add task
      </Button>
    </form>
  )
}

export function TaskStatusSelect({ projectId, taskId, title, status }: { projectId: string; taskId: string; title: string; status: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <select
      className="rounded-md border bg-background px-2 py-1 text-xs"
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => void upsertTaskAction(projectId, { id: taskId, title, status: e.target.value as never }))}
    >
      {['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}

export function DependencyForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await upsertDependencyAction(projectId, { title })
          setTitle('')
        })
      }}
    >
      <Input placeholder="Customer action item" value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        Request action
      </Button>
    </form>
  )
}

export function ApprovalForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await createApprovalRequestAction(projectId, title, description)
          setTitle('')
          setDescription('')
        })
      }}
    >
      <Input placeholder="Approval title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Textarea placeholder="Context (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <Button type="submit" disabled={pending}>
        Request approval
      </Button>
    </form>
  )
}

export function ChangeRequestStatusForm({ changeRequestId, current }: { changeRequestId: string; current: string }) {
  const [status, setStatus] = useState(current)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => void updateChangeRequestStatusAction(changeRequestId, status as never, note))
      }}
    >
      <select className="rounded-md border bg-background px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        {['SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'DECLINED'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Textarea placeholder="Internal note (not visible to customer)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <Button type="submit" size="sm" disabled={pending}>
        Update
      </Button>
    </form>
  )
}

export function SupportStatusForm({ supportRequestId, current }: { supportRequestId: string; current: string }) {
  const [status, setStatus] = useState(current)
  const [pending, startTransition] = useTransition()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => void updateSupportRequestStatusAction(supportRequestId, status as never))
      }}
    >
      <select className="rounded-md border bg-background px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        {['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="ml-2" disabled={pending}>
        Save
      </Button>
    </form>
  )
}

export function ServiceToggleForm({
  customerAccountId,
  serviceKey,
  current,
}: {
  customerAccountId: string
  serviceKey: string
  current: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(() =>
          void upsertCustomerServiceAction(customerAccountId, serviceKey, current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
        )
      }
    >
      {current === 'ACTIVE' ? 'Deactivate' : 'Activate'}
    </Button>
  )
}
