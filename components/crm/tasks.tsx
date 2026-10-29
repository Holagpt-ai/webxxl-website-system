'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, fill, formatDate, isGateError, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  TASK_PRIORITIES,
  TASK_STATUSES,
  contactName,
  isTerminalTask,
  type CrmContact,
  type CrmTask,
  type CrmTaskPatch,
} from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  LoadingRows,
  PlainTable,
  Section,
  SectionHeading,
  SelectField,
  StatusPill,
  SuccessNote,
  TextField,
  WorkspaceState,
  td,
} from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

const STATUS_TONE: Record<string, 'info' | 'success' | 'muted' | 'neutral'> = {
  OPEN: 'info',
  IN_PROGRESS: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'muted',
}

export function CrmTasks({ accountId, locale, copy }: Props) {
  const list = useWorkspace<{ tasks: CrmTask[] }>(CRM_API.tasks, accountId)
  const contacts = useWorkspace<{ contacts: CrmContact[] }>(CRM_API.contacts, accountId)
  const [formOpen, setFormOpen] = useState(false)
  const [createdNote, setCreatedNote] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const t = copy.tasks
  const kit = copy.kit
  const f = copy.fields

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

  const names = new Map((contacts.data?.contacts ?? []).map((c) => [c.id, contactName(c, f.unnamed)]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title={t.title} description={t.description} />
        {!formOpen && (
          <Button
            onClick={() => {
              setFormOpen(true)
              setCreatedNote(false)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.add}
          </Button>
        )}
      </div>

      {createdNote && <SuccessNote>{t.created}</SuccessNote>}

      {formOpen && (
        <CreateTaskForm
          copy={copy}
          contacts={contacts.data?.contacts ?? []}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            setCreatedNote(true)
            list.mutate()
          }}
        />
      )}

      <Section title={t.listLabel}>
        {notice && <SuccessNote>{notice}</SuccessNote>}
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.tasks.length ? (
          <EmptyNote>{t.empty}</EmptyNote>
        ) : (
          <PlainTable label={t.listLabel} headers={[f.title, f.status, f.priority, f.due, f.contact, t.actions]}>
            {list.data.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                contactLabel={task.contactId ? (names.get(task.contactId) ?? DASH) : DASH}
                copy={copy}
                locale={locale}
                editing={editingId === task.id}
                onToggleEdit={() => {
                  setNotice(null)
                  setEditingId(editingId === task.id ? null : task.id)
                }}
                onChanged={(message) => {
                  setNotice(message)
                  setEditingId(null)
                  list.mutate()
                }}
              />
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Noon local time keeps the chosen calendar day stable across time zones.
const fromDateInput = (value: string) => (value ? new Date(`${value}T12:00:00`).toISOString() : null)

function TaskRow({
  task,
  contactLabel,
  copy,
  locale,
  editing,
  onToggleEdit,
  onChanged,
}: {
  task: CrmTask
  contactLabel: string
  copy: CrmWorkspaceCopy
  locale: string
  editing: boolean
  onToggleEdit: () => void
  onChanged: (message: string) => void
}) {
  const t = copy.tasks
  const terminal = isTerminalTask(task.status)
  const complete = useAction<{ task: CrmTask }>()

  async function markComplete() {
    const result = await complete.run(() => workspaceSend(CRM_API.task(task.id), { status: 'COMPLETED' }, 'PATCH'))
    if (result.ok) onChanged(t.completedNote)
  }

  return (
    <>
      <tr>
        <td className={`${td} font-medium text-foreground`}>
          {task.title}
          {task.disposition && <span className="block text-xs font-normal text-muted-foreground">{task.disposition}</span>}
        </td>
        <td className={td}>
          <StatusPill label={enumLabel(copy.enums.taskStatus, task.status)} tone={STATUS_TONE[task.status] ?? 'muted'} />
          {task.status === 'COMPLETED' && task.completedAt && (
            <span className="mt-1 block whitespace-nowrap text-xs text-muted-foreground">
              {fill(t.completedOn, { date: formatDate(task.completedAt, locale) })}
            </span>
          )}
        </td>
        <td className={td}>{enumLabel(copy.enums.taskPriority, task.priority)}</td>
        <td className={`${td} whitespace-nowrap`}>{task.dueAt ? formatDate(task.dueAt, locale) : t.noDue}</td>
        <td className={td}>{contactLabel}</td>
        <td className={td}>
          <div className="flex flex-wrap gap-2">
            {!terminal && (
              <Button size="sm" variant="secondary" disabled={complete.pending} onClick={markComplete}>
                <Check className="size-4" aria-hidden="true" />
                {complete.pending ? t.completing : t.complete}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onToggleEdit} aria-expanded={editing}>
              {editing ? t.closeEdit : t.edit}
            </Button>
          </div>
          {complete.error && (
            <div className="mt-2">
              <WorkspaceState error={complete.error} kit={copy.kit} workspace={copy.name} compact />
            </div>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-muted/50 px-4 py-4">
            <EditTaskForm task={task} copy={copy} onCancel={onToggleEdit} onSaved={() => onChanged(t.updated)} />
          </td>
        </tr>
      )}
    </>
  )
}

function EditTaskForm({
  task,
  copy,
  onCancel,
  onSaved,
}: {
  task: CrmTask
  copy: CrmWorkspaceCopy
  onCancel: () => void
  onSaved: () => void
}) {
  const t = copy.tasks
  const f = copy.fields
  const terminal = isTerminalTask(task.status)
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt))
  const [disposition, setDisposition] = useState(task.disposition ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const action = useAction<{ task: CrmTask }>()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLocalError(null)
    const patch: CrmTaskPatch = {}
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return setLocalError(t.titleRequired)
    if (trimmedTitle !== task.title) patch.title = trimmedTitle
    if (!terminal && status !== task.status) patch.status = status
    if (priority !== task.priority) patch.priority = priority
    if (dueAt !== toDateInput(task.dueAt)) patch.dueAt = fromDateInput(dueAt)
    const nextDisposition = disposition.trim() || null
    if (nextDisposition !== (task.disposition ?? null)) patch.disposition = nextDisposition
    if (Object.keys(patch).length === 0) return setLocalError(t.noChanges)
    const result = await action.run(() => workspaceSend(CRM_API.task(task.id), patch, 'PATCH'))
    if (result.ok) onSaved()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label={t.editTitle}>
      <h3 className="text-sm font-semibold text-foreground">{t.editTitle}</h3>
      {terminal && <p className="text-xs leading-relaxed text-muted-foreground">{t.terminalNote}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label={f.title} value={title} onChange={setTitle} required />
        {terminal ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{f.status}</span>
            <span className="py-2 text-sm text-muted-foreground">{enumLabel(copy.enums.taskStatus, task.status)}</span>
          </div>
        ) : (
          <SelectField
            label={f.status}
            value={status}
            onChange={setStatus}
            options={TASK_STATUSES.map((s) => ({ value: s, label: enumLabel(copy.enums.taskStatus, s) }))}
          />
        )}
        <SelectField
          label={f.priority}
          value={priority}
          onChange={setPriority}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: enumLabel(copy.enums.taskPriority, p) }))}
        />
        <TextField label={f.due} value={dueAt} onChange={setDueAt} type="date" hint={t.clearDue} />
      </div>
      <TextField label={`${t.disposition} (${copy.kit.optional})`} value={disposition} onChange={setDisposition} hint={t.dispositionHint} />
      {localError && (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      )}
      {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
      <FormActions>
        <Button type="submit" disabled={action.pending}>
          {action.pending ? copy.kit.saving : copy.kit.save}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {copy.kit.cancel}
        </Button>
      </FormActions>
    </form>
  )
}

function CreateTaskForm({
  copy,
  contacts,
  onCancel,
  onCreated,
}: {
  copy: CrmWorkspaceCopy
  contacts: CrmContact[]
  onCancel: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [contactId, setContactId] = useState('')
  const action = useAction<{ task: CrmTask }>()
  const f = copy.fields

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    // Noon local time keeps the chosen calendar day stable across time zones.
    const due = dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : undefined
    const result = await action.run(() =>
      workspaceSend(CRM_API.tasks, { title: title.trim(), dueAt: due, contactId: contactId || undefined }),
    )
    if (result.ok) onCreated()
  }

  return (
    <Section title={copy.tasks.formTitle}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label={f.title} value={title} onChange={setTitle} required />
          <TextField label={`${f.due} (${copy.kit.optional})`} value={dueAt} onChange={setDueAt} type="date" />
          <SelectField
            label={`${f.contact} (${copy.kit.optional})`}
            value={contactId}
            onChange={setContactId}
            options={[{ value: '', label: f.none }, ...contacts.map((c) => ({ value: c.id, label: contactName(c, f.unnamed) }))]}
          />
        </div>
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={action.pending || !title.trim()}>
            {action.pending ? copy.kit.creating : copy.kit.create}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.kit.cancel}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
