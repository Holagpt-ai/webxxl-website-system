'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, formatDate, isGateError, newIdempotencyKey, splitList, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, contactName, primaryIdentity, type CrmContact } from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  GapNotice,
  LoadingRows,
  PlainTable,
  Section,
  SectionHeading,
  SuccessNote,
  TextField,
  WorkspaceState,
  td,
} from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

export function CrmContacts({ accountId, locale, copy, base }: Props) {
  const list = useWorkspace<{ contacts: CrmContact[] }>(CRM_API.contacts, accountId)
  const [formOpen, setFormOpen] = useState(false)
  const [createdNote, setCreatedNote] = useState(false)
  const t = copy.contacts
  const kit = copy.kit

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

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
        <CreateContactForm
          copy={copy}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            setCreatedNote(true)
            list.mutate()
          }}
        />
      )}

      <Section title={t.listLabel}>
        <GapNotice title={kit.notAvailable} body={t.noSearch} />
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={5} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.contacts.length ? (
          <EmptyNote>{t.empty}</EmptyNote>
        ) : (
          <PlainTable
            label={t.listLabel}
            headers={[copy.fields.name, copy.fields.email, copy.fields.phone, copy.fields.leadSource, copy.fields.updated]}
          >
            {list.data.contacts.map((c) => (
              <tr key={c.id}>
                <td className={td}>
                  <Link href={`${base}/contacts/${c.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {contactName(c, copy.fields.unnamed)}
                  </Link>
                </td>
                <td className={td}>{primaryIdentity(c, 'EMAIL') ?? DASH}</td>
                <td className={td}>{primaryIdentity(c, 'PHONE') ?? DASH}</td>
                <td className={td}>{c.leadSource ?? DASH}</td>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(c.updatedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function CreateContactForm({ copy, onCancel, onCreated }: { copy: CrmWorkspaceCopy; onCancel: () => void; onCreated: () => void }) {
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [emails, setEmails] = useState('')
  const [phones, setPhones] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const action = useAction<{ contact: CrmContact }>()
  const f = copy.fields

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = await action.run(() =>
      workspaceSend(CRM_API.contacts, {
        givenName: givenName.trim() || undefined,
        familyName: familyName.trim() || undefined,
        emails: splitList(emails),
        phones: splitList(phones),
        leadSource: leadSource.trim() || undefined,
        idempotencyKey,
      }),
    )
    if (result.ok) onCreated()
  }

  return (
    <Section title={copy.contacts.formTitle}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={f.givenName} value={givenName} onChange={setGivenName} />
          <TextField label={f.familyName} value={familyName} onChange={setFamilyName} />
          <TextField label={f.emails} value={emails} onChange={setEmails} hint={f.listHint} />
          <TextField label={f.phones} value={phones} onChange={setPhones} hint={f.listHint} />
          <TextField label={`${f.leadSource} (${copy.kit.optional})`} value={leadSource} onChange={setLeadSource} />
        </div>
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={action.pending}>
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
