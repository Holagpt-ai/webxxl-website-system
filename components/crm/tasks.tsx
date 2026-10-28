'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDate, isGateError, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, contactName, type CrmContact, type CrmTask } from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  GapNotice,
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
        <GapNotice title={t.completeUnavailable.title} body={t.completeUnavailable.body} />
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.tasks.length ? (
          <EmptyNote>{t.empty}</EmptyNote>
        ) : (
          <PlainTable label={t.listLabel} headers={[f.title, f.status, f.priority, f.due, f.contact]}>
            {list.data.tasks.map((task) => (
              <tr key={task.id}>
                <td className={`${td} font-medium text-foreground`}>{task.title}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.taskStatus, task.status)} tone={STATUS_TONE[task.status] ?? 'muted'} />
                </td>
                <td className={td}>{enumLabel(copy.enums.taskPriority, task.priority)}</td>
                <td className={`${td} whitespace-nowrap`}>{task.dueAt ? formatDate(task.dueAt, locale) : t.noDue}</td>
                <td className={td}>{task.contactId ? (names.get(task.contactId) ?? DASH) : DASH}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
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
