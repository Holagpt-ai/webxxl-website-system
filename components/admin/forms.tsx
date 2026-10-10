'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { allowedUploadAccept, PROJECT_FILE_CATEGORIES } from '@/lib/files/policy'
import {
  addCustomerMembershipAction,
  attachApprovalFilesAction,
  createApprovalRequestAction,
  createProjectAction,
  deleteProjectFileAction,
  postStaffProjectCommentAction,
  removeMembershipAction,
  updateChangeRequestStatusAction,
  updateCustomerAccountStatusAction,
  updateMembershipRoleAction,
  updateProjectAction,
  updateSupportRequestStatusAction,
  uploadStaffProjectFileAction,
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

export function StaffFileUploadForm({ projectId, storageReady }: { projectId: string; storageReady: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const data = new FormData(form)
        data.set('projectId', projectId)
        startTransition(async () => {
          setError(null)
          const result = await uploadStaffProjectFileAction(data)
          if (!result.ok) {
            setError(result.error === 'not_configured' ? 'File storage is not configured.' : result.error)
            return
          }
          form.reset()
        })
      }}
    >
      <select name="category" className="rounded-md border bg-background px-2 py-1 text-sm" defaultValue="OTHER" disabled={!storageReady}>
        {PROJECT_FILE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <Input name="file" type="file" required accept={allowedUploadAccept()} disabled={!storageReady || pending} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending || !storageReady}>
        Upload file
      </Button>
    </form>
  )
}

export function DeleteFileButton({ projectId, fileId }: { projectId: string; fileId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Delete this file from the project?')) return
          startTransition(async () => {
            const result = await deleteProjectFileAction(projectId, fileId)
            if (!result.ok) {
              setError(result.error === 'not_configured' ? 'File storage is not configured.' : 'Could not delete this file.')
            }
          })
        }}
      >
        Delete
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}

export function StaffCommentForm({ projectId }: { projectId: string }) {
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'CUSTOMER' | 'INTERNAL'>('CUSTOMER')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await postStaffProjectCommentAction(projectId, body, visibility)
          if (!result.ok) {
            setError(result.error)
            return
          }
          setBody('')
        })
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required placeholder="Write a reply or internal note" />
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as 'CUSTOMER' | 'INTERNAL')}
      >
        <option value="CUSTOMER">Reply visible to customer</option>
        <option value="INTERNAL">Internal note</option>
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        Post
      </Button>
    </form>
  )
}

export function AttachApprovalFilesForm({
  projectId,
  approvalId,
  files,
}: {
  projectId: string
  approvalId: string
  files: { id: string; originalName: string }[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (files.length === 0) return <p className="text-xs text-muted-foreground">No project files to attach.</p>
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await attachApprovalFilesAction(projectId, approvalId, selected)
          if (!result.ok) {
            setError(result.error === 'cross_project' ? 'Those files are not on this project.' : result.error)
            return
          }
          setSelected([])
        })
      }}
    >
      {files.map((file) => (
        <label key={file.id} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(file.id)}
            onChange={(e) =>
              setSelected((current) => (e.target.checked ? [...current, file.id] : current.filter((id) => id !== file.id)))
            }
          />
          <span className="truncate">{file.originalName}</span>
        </label>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending || selected.length === 0}>
        Attach to approval
      </Button>
    </form>
  )
}
