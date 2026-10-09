'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  postCommentAction,
  respondApprovalAction,
  submitChangeRequestAction,
  createSupportRequestAction,
  resolveDependencyAction,
  prepareFileUploadAction,
  registerUploadedFileAction,
} from '@/lib/portal/actions'

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
}: {
  projectId: string
  submitLabel: string
  priorityLabel: string
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await submitChangeRequestAction(projectId, title, description, priority)
          setTitle('')
          setDescription('')
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
}: {
  projectId?: string
  submitLabel: string
  subjectLabel: string
  messageLabel: string
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          await createSupportRequestAction(subject, message, projectId)
          setSubject('')
          setMessage('')
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
  notConfiguredMessage,
}: {
  projectId: string
  submitLabel: string
  notConfiguredMessage: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const input = (e.target as HTMLFormElement).elements.namedItem('file') as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return
        startTransition(async () => {
          setError(null)
          const prep = await prepareFileUploadAction(projectId, file.name, file.type || 'application/octet-stream', file.size)
          if (!prep.ok) {
            setError(prep.error === 'not_configured' ? notConfiguredMessage : prep.error)
            return
          }
          const upload = await fetch(prep.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
          if (!upload.ok) {
            setError(notConfiguredMessage)
            return
          }
          await registerUploadedFileAction({
            projectId,
            originalName: file.name,
            storageKey: prep.storageKey,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            category: 'OTHER',
          })
          input.value = ''
        })
      }}
    >
      <Input name="file" type="file" required />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}
