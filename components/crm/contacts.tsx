'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { useDebouncedValue } from '@/lib/crm-ui/use-debounced-value'
import { DASH, fill, formatDate, isGateError, newIdempotencyKey, splitList, withQuery, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, CRM_SEARCH_MAX, contactName, primaryIdentity, type CrmContact, type CrmContactPage } from '@/lib/crm-ui/types'
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
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query.trim(), 300)
  const tooLong = debounced.length > CRM_SEARCH_MAX
  // Cursors belong to one search term; a new term starts again at page one.
  const [paging, setPaging] = useState<{ q: string; cursors: string[] }>({ q: '', cursors: [] })
  const cursors = paging.q === debounced ? paging.cursors : []
  const setCursors = (next: string[]) => setPaging({ q: debounced, cursors: next })
  const resetPaging = () => setPaging({ q: debounced, cursors: [] })
  const cursor = cursors.at(-1)
  const url = tooLong ? null : withQuery(CRM_API.contacts, { take: 50, q: debounced || undefined, cursor })
  const list = useWorkspace<CrmContactPage>(url, accountId)
  const staleCursor = Boolean(cursor) && list.error?.kind === 'VALIDATION'
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="crm-contact-search" className="text-sm font-medium text-foreground">
            {t.searchLabel}
          </label>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="crm-contact-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              maxLength={CRM_SEARCH_MAX}
              autoComplete="off"
              className="pl-9 pr-9"
              aria-describedby="crm-contact-search-status"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.clearSearch}</span>
              </button>
            )}
          </div>
          <p id="crm-contact-search-status" className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
            {tooLong ? fill(t.searchTooLong, { max: CRM_SEARCH_MAX }) : query.trim() !== debounced || list.isValidating ? t.searching : ''}
          </p>
        </div>

        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={5} />
        ) : staleCursor ? (
          <div className="flex flex-col items-start gap-3">
            <GapNotice title={t.staleCursor.title} body={t.staleCursor.body} />
            <Button variant="outline" size="sm" onClick={resetPaging}>
              {t.first}
            </Button>
          </div>
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.contacts.length ? (
          <EmptyNote>{debounced ? fill(t.noResults, { query: debounced }) : t.empty}</EmptyNote>
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

        {!staleCursor && (cursors.length > 0 || list.data?.nextCursor) && (
          <nav aria-label={t.paginationLabel} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm tabular-nums text-muted-foreground">{fill(t.pageLabel, { page: cursors.length + 1 })}</span>
            <div className="flex gap-2">
              {cursors.length > 1 && (
                <Button variant="ghost" size="sm" onClick={resetPaging}>
                  {t.first}
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={cursors.length === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!list.data?.nextCursor || list.isValidating}
                onClick={() => list.data?.nextCursor && setCursors([...cursors, list.data.nextCursor])}
              >
                {t.next}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
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
