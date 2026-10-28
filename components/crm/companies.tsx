'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, formatDate, isGateError, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, type CrmCompany } from '@/lib/crm-ui/types'
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

export function CrmCompanies({ accountId, locale, copy }: Props) {
  const list = useWorkspace<{ companies: CrmCompany[] }>(CRM_API.companies, accountId)
  const [formOpen, setFormOpen] = useState(false)
  const [createdNote, setCreatedNote] = useState(false)
  const t = copy.companies
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
        <CreateCompanyForm
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
        <GapNotice title={kit.notAvailable} body={t.noDetail} />
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.companies.length ? (
          <EmptyNote>{t.empty}</EmptyNote>
        ) : (
          <PlainTable label={t.listLabel} headers={[f.name, f.website, f.industry, f.created]}>
            {list.data.companies.map((company) => (
              <tr key={company.id}>
                <td className={`${td} font-medium text-foreground`}>{company.name}</td>
                <td className={td}>{company.websiteDomain ?? DASH}</td>
                <td className={td}>{company.industry ?? DASH}</td>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(company.createdAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function CreateCompanyForm({ copy, onCancel, onCreated }: { copy: CrmWorkspaceCopy; onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [websiteDomain, setWebsiteDomain] = useState('')
  const [industry, setIndustry] = useState('')
  const action = useAction<{ company: CrmCompany }>()
  const f = copy.fields

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = await action.run(() =>
      workspaceSend(CRM_API.companies, {
        name: name.trim(),
        websiteDomain: websiteDomain.trim() || undefined,
        industry: industry.trim() || undefined,
      }),
    )
    if (result.ok) onCreated()
  }

  return (
    <Section title={copy.companies.formTitle}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label={f.name} value={name} onChange={setName} required />
          <TextField label={`${f.website} (${copy.kit.optional})`} value={websiteDomain} onChange={setWebsiteDomain} placeholder="example.com" />
          <TextField label={`${f.industry} (${copy.kit.optional})`} value={industry} onChange={setIndustry} />
        </div>
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={action.pending || !name.trim()}>
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
