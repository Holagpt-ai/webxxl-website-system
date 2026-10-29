'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, formatMoney, isGateError, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  contactName,
  type CrmCompany,
  type CrmContact,
  type CrmDeal,
  type CrmPipeline,
} from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  GapNotice,
  LoadingRows,
  Section,
  SectionHeading,
  SelectField,
  StatusPill,
  SuccessNote,
  TextField,
  WorkspaceState,
} from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

const DEAL_TONE: Record<string, 'success' | 'danger' | 'muted' | 'info'> = { OPEN: 'info', WON: 'success', LOST: 'danger', CANCELLED: 'muted' }

export function CrmPipelineView({ accountId, locale, copy }: Props) {
  const pipelines = useWorkspace<{ pipelines: CrmPipeline[] }>(CRM_API.pipelines, accountId)
  const deals = useWorkspace<{ deals: CrmDeal[] }>(CRM_API.deals, accountId)
  const contacts = useWorkspace<{ contacts: CrmContact[] }>(CRM_API.contacts, accountId)
  const companies = useWorkspace<{ companies: CrmCompany[] }>(CRM_API.companies, accountId)
  const [formOpen, setFormOpen] = useState(false)
  const [createdNote, setCreatedNote] = useState(false)
  const t = copy.pipeline
  const kit = copy.kit

  const gate = [pipelines.error, deals.error].find(isGateError)
  if (gate) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={gate} kit={kit} workspace={copy.name} />
      </>
    )
  }

  const contactNames = new Map((contacts.data?.contacts ?? []).map((c) => [c.id, contactName(c, copy.fields.unnamed)]))
  const companyNames = new Map((companies.data?.companies ?? []).map((c) => [c.id, c.name]))

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
            {t.addDeal}
          </Button>
        )}
      </div>

      {createdNote && <SuccessNote>{t.created}</SuccessNote>}

      {formOpen && (
        <CreateDealForm
          copy={copy}
          contacts={contacts.data?.contacts ?? []}
          companies={companies.data?.companies ?? []}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            setCreatedNote(true)
            deals.mutate()
          }}
        />
      )}

      <GapNotice title={t.moveUnavailable.title} body={t.moveUnavailable.body} />

      {pipelines.isLoading || deals.isLoading ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : pipelines.error || deals.error ? (
        <WorkspaceState
          error={pipelines.error ?? deals.error}
          kit={kit}
          workspace={copy.name}
          onRetry={() => {
            pipelines.mutate()
            deals.mutate()
          }}
        />
      ) : !pipelines.data?.pipelines.length ? (
        <EmptyNote>{t.noPipelines}</EmptyNote>
      ) : (
        pipelines.data.pipelines.map((pipeline) => {
          const stages = [...pipeline.stages].sort((a, b) => a.sortOrder - b.sortOrder)
          const stageIds = new Set(stages.map((s) => s.id))
          const pipelineDeals = (deals.data?.deals ?? []).filter((d) => d.pipelineId === pipeline.id)
          const orphaned = pipelineDeals.filter((d) => !stageIds.has(d.stageId))
          const columns = [
            ...stages.map((stage) => ({
              id: stage.id,
              name: stage.name,
              probability: stage.probabilityBps,
              deals: pipelineDeals.filter((d) => d.stageId === stage.id),
            })),
            ...(orphaned.length ? [{ id: 'other', name: t.otherStage, probability: null, deals: orphaned }] : []),
          ]
          return (
            <Section
              key={pipeline.id}
              title={pipeline.name}
              action={pipeline.isDefault ? <StatusPill label={t.defaultBadge} tone="info" /> : undefined}
            >
              <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0" role="region" aria-label={pipeline.name} tabIndex={0}>
                <ol className="flex min-w-max gap-3 pb-2">
                  {columns.map((column) => (
                    <li key={column.id} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{column.name}</h3>
                        <span className="text-xs tabular-nums text-muted-foreground">{column.deals.length}</span>
                      </div>
                      {column.probability !== null && (
                        <p className="text-xs text-muted-foreground">{fill(t.probability, { value: Math.round(column.probability / 100) })}</p>
                      )}
                      {column.deals.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">{t.noDealsInStage}</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {column.deals.map((deal) => (
                            <li key={deal.id} className="flex flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm">
                              <p className="text-sm font-medium leading-snug text-foreground">{deal.title}</p>
                              <p className="text-sm tabular-nums text-foreground">
                                {formatMoney(deal.amountMinorUnits, deal.currencyCode, locale)}
                              </p>
                              {(deal.contactId || deal.companyId) && (
                                <p className="text-xs text-muted-foreground">
                                  {[deal.contactId && contactNames.get(deal.contactId), deal.companyId && companyNames.get(deal.companyId)]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <StatusPill label={enumLabel(copy.enums.dealStatus, deal.status)} tone={DEAL_TONE[deal.status] ?? 'muted'} />
                                <span className="text-xs text-muted-foreground">{formatDate(deal.updatedAt, locale)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              {pipelineDeals.length === 0 && <EmptyNote>{t.empty}</EmptyNote>}
            </Section>
          )
        })
      )}
    </div>
  )
}

function CreateDealForm({
  copy,
  contacts,
  companies,
  onCancel,
  onCreated,
}: {
  copy: CrmWorkspaceCopy
  contacts: CrmContact[]
  companies: CrmCompany[]
  onCancel: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [amount, setAmount] = useState('')
  const action = useAction<{ deal: CrmDeal }>()
  const f = copy.fields
  const parsedAmount = amount.trim() ? Number(amount.replace(',', '.')) : null
  const amountInvalid = parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (amountInvalid) return
    const result = await action.run(() =>
      workspaceSend(CRM_API.deals, {
        title: title.trim(),
        contactId: contactId || undefined,
        companyId: companyId || undefined,
        amountMinorUnits: parsedAmount === null ? undefined : Math.round(parsedAmount * 100),
      }),
    )
    if (result.ok) onCreated()
  }

  return (
    <Section title={copy.pipeline.formTitle} description={copy.pipeline.formHint}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={f.title} value={title} onChange={setTitle} required />
          <TextField label={f.amount} value={amount} onChange={setAmount} type="text" hint={copy.pipeline.amountHint} placeholder="0.00" />
          <SelectField
            label={`${f.contact} (${copy.kit.optional})`}
            value={contactId}
            onChange={setContactId}
            options={[{ value: '', label: f.none }, ...contacts.map((c) => ({ value: c.id, label: contactName(c, f.unnamed) }))]}
          />
          <SelectField
            label={`${f.company} (${copy.kit.optional})`}
            value={companyId}
            onChange={setCompanyId}
            options={[{ value: '', label: f.none }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        {amountInvalid && <WorkspaceState kind="VALIDATION" kit={copy.kit} workspace={copy.name} compact />}
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={action.pending || !title.trim() || amountInvalid}>
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
