'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { allowedUploadAccept, PROJECT_FILE_CATEGORIES } from '@/lib/files/policy'
import { useAdminCopy } from '@/components/admin/locale'
import { actionErrorLabel, enumLabel } from '@/lib/i18n/labels'
import {
  inviteCustomerMemberAction,
  resendCustomerInvitationAction,
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
  const { admin: copy, dashboard: dash } = useAdminCopy()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => void updateCustomerAccountStatusAction(customerId, status as never))
      }}
    >
      <div>
        <Label htmlFor="acct-status">{copy.customers.accountStatus}</Label>
        <select
          id="acct-status"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['ACTIVE', 'ONBOARDING', 'PAUSED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>
              {enumLabel(dash.accountStatuses, s)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {copy.save}
      </Button>
    </form>
  )
}

export function InviteCustomerForm({ customerId }: { customerId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [locale, setLocale] = useState<'en' | 'es'>('en')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await inviteCustomerMemberAction({
            customerAccountId: customerId,
            email,
            role: role as never,
            locale,
          })
          if (result.ok) setEmail('')
          else setError(actionErrorLabel(result.error, copy.errors))
        })
      }}
    >
      <div>
        <Label htmlFor="member-email">{copy.email}</Label>
        <Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="member-role">{copy.role}</Label>
        <select
          id="member-role"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="OWNER">{copy.owner}</option>
          <option value="MEMBER">{copy.member}</option>
        </select>
      </div>
      <div>
        <Label htmlFor="invite-locale">{copy.language}</Label>
        <select
          id="invite-locale"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'en' | 'es')}
        >
          <option value="en">{copy.english}</option>
          <option value="es">{copy.spanish}</option>
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {copy.customers.sendInvitation}
      </Button>
    </form>
  )
}

export function MembershipRowActions({
  membershipId,
  role,
  resendLocale = 'en',
}: {
  membershipId: string
  role: string
  resendLocale?: 'en' | 'es'
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await updateMembershipRoleAction(membershipId, role === 'OWNER' ? 'MEMBER' : 'OWNER')
              if (!result.ok) setError(actionErrorLabel(result.error, copy.errors))
            })
          }}
        >
          {copy.customers.toggleRole}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await resendCustomerInvitationAction({ membershipId, locale: resendLocale })
              if (!result.ok) setError(actionErrorLabel(result.error, copy.errors))
            })
          }}
        >
          {copy.customers.resendInvitation}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await removeMembershipAction(membershipId)
              if (!result.ok) setError(actionErrorLabel(result.error, copy.errors))
            })
          }}
        >
          {copy.customers.remove}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function CreateProjectForm({ customerAccountId }: { customerAccountId: string }) {
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
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
        <Label htmlFor="proj-name">{copy.customers.newProject}</Label>
        <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <Button type="submit" disabled={pending}>
        {copy.create}
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
  const { admin: copy, dashboard: dash } = useAdminCopy()
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
        <Label htmlFor="p-status">{copy.status}</Label>
        <select id="p-status" name="status" defaultValue={status} className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm">
          {['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {enumLabel(dash.projectStatuses, s)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="p-progress">{copy.projects.progressPercent}</Label>
        <Input id="p-progress" name="progress" type="number" min={0} max={100} defaultValue={progressPercent} className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>
        {copy.projects.updateProject}
      </Button>
    </form>
  )
}

export function MilestoneForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
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
      <Input placeholder={copy.projects.milestoneTitle} value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        {copy.projects.addMilestone}
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
  const { dashboard: dash } = useAdminCopy()
  const next = status === 'PENDING' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING'
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => void upsertMilestoneAction(projectId, { id: milestoneId, title, status: next as never }))}
    >
      → {enumLabel(dash.milestoneStatuses, next)}
    </Button>
  )
}

export function TaskForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
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
      <Input placeholder={copy.projects.taskTitle} value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        {copy.projects.addTask}
      </Button>
    </form>
  )
}

export function TaskStatusSelect({ projectId, taskId, title, status }: { projectId: string; taskId: string; title: string; status: string }) {
  const [pending, startTransition] = useTransition()
  const { dashboard: dash } = useAdminCopy()
  return (
    <select
      className="rounded-md border bg-background px-2 py-1 text-xs"
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => void upsertTaskAction(projectId, { id: taskId, title, status: e.target.value as never }))}
    >
      {['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].map((s) => (
        <option key={s} value={s}>
          {enumLabel(dash.taskStatuses, s)}
        </option>
      ))}
    </select>
  )
}

export function DependencyForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
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
      <Input placeholder={copy.projects.actionItem} value={title} onChange={(e) => setTitle(e.target.value)} required className="flex-1" />
      <Button type="submit" disabled={pending}>
        {copy.projects.requestAction}
      </Button>
    </form>
  )
}

export function ApprovalForm({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy } = useAdminCopy()
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
      <Input placeholder={copy.projects.approvalTitle} value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Textarea placeholder={copy.projects.approvalContext} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <Button type="submit" disabled={pending}>
        {copy.projects.requestApproval}
      </Button>
    </form>
  )
}

export function ChangeRequestStatusForm({ changeRequestId, current }: { changeRequestId: string; current: string }) {
  const [status, setStatus] = useState(current)
  const [note, setNote] = useState('')
  const [customerReply, setCustomerReply] = useState('')
  const [pending, startTransition] = useTransition()
  const { admin: copy, dashboard: dash } = useAdminCopy()
  return (
    <form
      className="flex min-w-[14rem] flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(() => void updateChangeRequestStatusAction(changeRequestId, status as never, note, customerReply))
      }}
    >
      <select className="rounded-md border bg-background px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
        {['SUBMITTED', 'REVIEWING', 'APPROVED', 'SCHEDULED', 'COMPLETED', 'DECLINED'].map((s) => (
          <option key={s} value={s}>
            {enumLabel(dash.changeRequestStatuses, s)}
          </option>
        ))}
      </select>
      <Textarea placeholder={copy.projects.customerReply} value={customerReply} onChange={(e) => setCustomerReply(e.target.value)} rows={2} />
      <Textarea placeholder={copy.projects.internalNote} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <Button type="submit" size="sm" disabled={pending}>
        {copy.update}
      </Button>
    </form>
  )
}

export function SupportStatusForm({ supportRequestId, current }: { supportRequestId: string; current: string }) {
  const [status, setStatus] = useState(current)
  const [pending, startTransition] = useTransition()
  const { admin: copy, dashboard: dash } = useAdminCopy()
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
            {enumLabel(dash.supportStatuses, s)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="ml-2" disabled={pending}>
        {copy.save}
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
  const { admin: copy } = useAdminCopy()
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
      {current === 'ACTIVE' ? copy.deactivate : copy.activate}
    </Button>
  )
}

export function StaffFileUploadForm({ projectId, storageReady }: { projectId: string; storageReady: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { admin: copy, dashboard: dash } = useAdminCopy()
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
            setError(actionErrorLabel(result.error, copy.errors))
            return
          }
          form.reset()
        })
      }}
    >
      <select name="category" className="rounded-md border bg-background px-2 py-1 text-sm" defaultValue="OTHER" disabled={!storageReady}>
        {PROJECT_FILE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category === 'BRAND'
              ? dash.categoryBrand
              : category === 'PHOTO'
                ? dash.categoryPhoto
                : category === 'DOCUMENT'
                  ? dash.categoryDocument
                  : dash.categoryOther}
          </option>
        ))}
      </select>
      <Input name="file" type="file" required accept={allowedUploadAccept()} disabled={!storageReady || pending} />
      <p className="text-xs text-muted-foreground">{copy.maxFile}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending || !storageReady}>
        {copy.uploadFile}
      </Button>
    </form>
  )
}

export function DeleteFileButton({ projectId, fileId }: { projectId: string; fileId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { admin: copy } = useAdminCopy()
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(copy.deleteConfirm)) return
          startTransition(async () => {
            const result = await deleteProjectFileAction(projectId, fileId)
            if (!result.ok) {
              setError(result.error === 'not_configured' ? copy.errors.notConfigured : copy.errors.deleteFailed)
            }
          })
        }}
      >
        {copy.delete}
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
  const { admin: copy } = useAdminCopy()
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await postStaffProjectCommentAction(projectId, body, visibility)
          if (!result.ok) {
            setError(actionErrorLabel(result.error, copy.errors))
            return
          }
          setBody('')
        })
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required placeholder={copy.projects.replyPlaceholder} />
      <select
        className="rounded-md border bg-background px-2 py-1 text-sm"
        value={visibility}
        onChange={(e) => setVisibility(e.target.value as 'CUSTOMER' | 'INTERNAL')}
      >
        <option value="CUSTOMER">{copy.projects.replyVisible}</option>
        <option value="INTERNAL">{copy.projects.internalOnly}</option>
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {copy.post}
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
  const { admin: copy } = useAdminCopy()
  if (files.length === 0) return <p className="text-xs text-muted-foreground">{copy.noProjectFiles}</p>
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          const result = await attachApprovalFilesAction(projectId, approvalId, selected)
          if (!result.ok) {
            setError(actionErrorLabel(result.error, copy.errors))
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
        {copy.projects.attachToApproval}
      </Button>
    </form>
  )
}
