'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { allowedUploadAccept, PROJECT_FILE_CATEGORIES } from '@/lib/files/policy'
import {
  postCommentAction,
  respondApprovalAction,
  submitChangeRequestAction,
  createSupportRequestAction,
  resolveDependencyAction,
  uploadProjectFileAction,
} from '@/lib/portal/actions'

function uploadErrorMessage(
  error: string,
  labels: { notConfigured: string; tooLarge: string; invalid: string; failed: string },
) {
  if (error === 'not_configured') return labels.notConfigured
  if (error === 'too_large') return labels.tooLarge
  if (error === 'invalid') return labels.invalid
  return labels.failed
}

export function CommentForm({ projectId, submitLabel }: { projectId: string; submitLabel: string }) {
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await postCommentAction(projectId, body)
          setBody('')
        })
      }}
    >
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function ApprovalActions({
  approvalId,
  approveLabel,
  changesLabel,
}: {
  approvalId: string
  approveLabel: string
  changesLabel: string
}) {
  const [pending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => startTransition(() => void respondApprovalAction(approvalId, 'APPROVED', notes))}
        >
          {approveLabel}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => void respondApprovalAction(approvalId, 'CHANGES_REQUESTED', notes))}
        >
          {changesLabel}
        </Button>
      </div>
    </div>
  )
}

export function ChangeRequestForm({
  projectId,
  submitLabel,
  priorityLabel,
  attachLabel,
  files = [],
}: {
  projectId: string
  submitLabel: string
  priorityLabel: string
  attachLabel: string
  files?: { id: string; originalName: string }[]
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [fileIds, setFileIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await submitChangeRequestAction(projectId, title, description, priority, fileIds)
          if (result.ok) {
            setTitle('')
            setDescription('')
            setFileIds([])
          }
        })
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Title" />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} />
      <div>
        <Label>{priorityLabel}</Label>
        <select
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
        >
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
      {files.length > 0 && (
        <FileCheckboxGroup label={attachLabel} files={files} selected={fileIds} onChange={setFileIds} />
      )}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function SupportForm({
  projectId,
  submitLabel,
  subjectLabel,
  messageLabel,
  attachLabel,
  files = [],
}: {
  projectId?: string
  submitLabel: string
  subjectLabel: string
  messageLabel: string
  attachLabel?: string
  files?: { id: string; originalName: string }[]
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [fileIds, setFileIds] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await createSupportRequestAction(subject, message, projectId, fileIds)
          if (result.ok) {
            setSubject('')
            setMessage('')
            setFileIds([])
          }
        })
      }}
    >
      <div>
        <Label htmlFor="support-subject">{subjectLabel}</Label>
        <Input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="support-message">{messageLabel}</Label>
        <Textarea id="support-message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="mt-1" />
      </div>
      {files.length > 0 && attachLabel && (
        <FileCheckboxGroup label={attachLabel} files={files} selected={fileIds} onChange={setFileIds} />
      )}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function DependencyResolveButton({ dependencyId, label }: { dependencyId: string; label: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(() => void resolveDependencyAction(dependencyId))}>
      {label}
    </Button>
  )
}

export function FileUploadForm({
  projectId,
  submitLabel,
  categoryLabel,
  categoryNames,
  hint,
  storageReady,
  errors,
}: {
  projectId: string
  submitLabel: string
  categoryLabel: string
  categoryNames: Record<(typeof PROJECT_FILE_CATEGORIES)[number], string>
  hint: string
  storageReady: boolean
  errors: { notConfigured: string; tooLarge: string; invalid: string; failed: string }
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const data = new FormData(form)
        data.set('projectId', projectId)
        startTransition(async () => {
          setError(null)
          const result = await uploadProjectFileAction(data)
          if (!result.ok) {
            setError(uploadErrorMessage(result.error, errors))
            return
          }
          form.reset()
        })
      }}
    >
      <div>
        <Label htmlFor={`category-${projectId}`}>{categoryLabel}</Label>
        <select
          id={`category-${projectId}`}
          name="category"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue="OTHER"
          disabled={!storageReady || pending}
        >
          {PROJECT_FILE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryNames[category]}
            </option>
          ))}
        </select>
      </div>
      <Input name="file" type="file" required accept={allowedUploadAccept()} disabled={!storageReady || pending} />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || !storageReady}>
        {submitLabel}
      </Button>
    </form>
  )
}

function FileCheckboxGroup({
  label,
  files,
  selected,
  onChange,
}: {
  label: string
  files: { id: string; originalName: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      {files.map((file) => (
        <label key={file.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(file.id)}
            onChange={(e) => {
              onChange(e.target.checked ? [...selected, file.id] : selected.filter((id) => id !== file.id))
            }}
          />
          <span className="truncate">{file.originalName}</span>
        </label>
      ))}
    </fieldset>
  )
}
