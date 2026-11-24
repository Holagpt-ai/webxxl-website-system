'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime, formatMoney, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, type CrmCompanyDetail, type CrmCustomFieldValue } from '@/lib/crm-ui/types'
import {
  EmptyNote,
  Facts,
  FormActions,
  GapNotice,
  LoadingRows,
  Section,
  SectionHeading,
  StatusPill,
  SuccessNote,
  TextField,
  WorkspaceState,
  selectClass,
} from './workspace-kit'

type Props = { accountId: string; companyId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

type FieldType = 'text' | 'number' | 'boolean' | 'empty'
type FieldRow = { id: number; key: string; type: FieldType; value: string }

const KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/
const MAX_FIELDS = 40

function isScalar(value: unknown): value is CrmCustomFieldValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function toRows(fields: Record<string, unknown> | null): FieldRow[] {
  return Object.entries(fields ?? {}).map(([key, value], id) => ({
    id,
    key,
    type: value === null ? 'empty' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text',
    value: value === null ? '' : String(value),
  }))
}

function contactName(c: CrmCompanyDetail['contacts'][number]) {
  return c.preferredName || [c.givenName, c.familyName].filter(Boolean).join(' ') || DASH
}

export function CrmCompanyDetail({ accountId, companyId, locale, copy, base }: Props) {
  const detail = useWorkspace<{ company: CrmCompanyDetail }>(CRM_API.company(companyId), accountId)
  const [editing, setEditing] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const t = copy.companyDetail
  const f = copy.fields
  const company = detail.data?.company

  const backLink = (
    <Link
      href={`${base}/companies`}
      className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t.back}
    </Link>
  )

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <LoadingRows label={copy.kit.loading} rows={5} />
      </div>
    )
  }

  if (detail.error || !company) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        {detail.error?.kind === 'NOT_FOUND' || !detail.error ? (
          <EmptyNote>{t.notFound}</EmptyNote>
        ) : (
          <WorkspaceState error={detail.error} kit={copy.kit} workspace={copy.name} onRetry={() => detail.mutate()} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {backLink}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <SectionHeading title={company.name} description={company.websiteDomain ?? undefined} />
        </div>
        {!editing && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(true)
              setSavedNote(false)
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t.edit}
          </Button>
        )}
      </div>

      {savedNote && <SuccessNote>{t.saved}</SuccessNote>}

      {editing ? (
        <CompanyEditForm
          company={company}
          copy={copy}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setSavedNote(true)
            detail.mutate()
          }}
        />
      ) : (
        <>
          <Section title={t.profileTitle}>
            <Facts
              items={[
                [f.website, company.websiteDomain ?? DASH],
                [f.industry, company.industry ?? DASH],
                [f.email, company.email ?? DASH],
                [f.phone, company.phone ?? DASH],
                [f.created, formatDateTime(company.createdAt, locale)],
                [t.updated, formatDateTime(company.updatedAt, locale)],
              ]}
            />
          </Section>
          <CustomFieldsView fields={company.customFields} copy={copy} />
        </>
      )}

      <Section title={t.contactsTitle}>
        {company.contacts.length === 0 ? (
          <EmptyNote>{t.contactsEmpty}</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y">
            {company.contacts.map((c) => (
              <li key={c.relationshipId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`${base}/contacts/${encodeURIComponent(c.contactId)}`}
                    className="break-words font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {contactName(c)}
                  </Link>
                  <span className="break-words text-xs text-muted-foreground">
                    {t.role}: {c.roleTitle || c.jobTitle || DASH}
                  </span>
                </div>
                {c.isPrimary && <StatusPill label={t.primary} tone="info" />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.dealsTitle}>
        {company.deals.length === 0 ? (
          <EmptyNote>{t.dealsEmpty}</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y">
            {company.deals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 break-words font-medium text-foreground">{d.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {d.amountMinorUnits !== null && d.currencyCode
                    ? formatMoney(d.amountMinorUnits, d.currencyCode, locale)
                    : DASH}
                  <StatusPill label={enumLabel(copy.enums.dealStatus ?? {}, d.status)} tone="muted" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function CustomFieldsView({ fields, copy }: { fields: Record<string, unknown> | null; copy: CrmWorkspaceCopy }) {
  const t = copy.companyDetail
  const entries = Object.entries(fields ?? {})
  return (
    <Section title={t.customTitle} description={t.customDescription}>
      {entries.length === 0 ? (
        <EmptyNote>{t.customEmpty}</EmptyNote>
      ) : (
        <Facts
          items={entries.map(([key, value]) => [
            key,
            !isScalar(value) ? (
              <span className="text-muted-foreground">{t.customUnsupported}</span>
            ) : value === null ? (
              DASH
            ) : typeof value === 'boolean' ? (
              value ? t.yes : t.no
            ) : (
              String(value)
            ),
          ])}
        />
      )}
    </Section>
  )
}

function CompanyEditForm({
  company,
  copy,
  onCancel,
  onSaved,
}: {
  company: CrmCompanyDetail
  copy: CrmWorkspaceCopy
  onCancel: () => void
  onSaved: () => void
}) {
  const t = copy.companyDetail
  const f = copy.fields
  const [name, setName] = useState(company.name)
  const [websiteDomain, setWebsiteDomain] = useState(company.websiteDomain ?? '')
  const [industry, setIndustry] = useState(company.industry ?? '')
  const [email, setEmail] = useState(company.email ?? '')
  const [phone, setPhone] = useState(company.phone ?? '')
  const hasStructured = Object.values(company.customFields ?? {}).some((v) => !isScalar(v))
  const [rows, setRows] = useState<FieldRow[]>(() => toRows(company.customFields))
  const [nextId, setNextId] = useState(rows.length)
  const [localError, setLocalError] = useState<string | null>(null)
  const action = useAction<{ id: string }>()

  function updateRow(id: number, patch: Partial<FieldRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function buildCustomFields(): Record<string, CrmCustomFieldValue> | string {
    const out: Record<string, CrmCustomFieldValue> = {}
    for (const row of rows) {
      const key = row.key.trim()
      if (!KEY_PATTERN.test(key)) return t.customInvalidKey
      if (key in out) return t.customDuplicateKey
      if (row.type === 'empty') out[key] = null
      else if (row.type === 'boolean') out[key] = row.value === 'true'
      else if (row.type === 'number') {
        const n = Number(row.value)
        if (row.value.trim() === '' || !Number.isFinite(n)) return t.customInvalidNumber
        out[key] = n
      } else out[key] = row.value
    }
    return out
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLocalError(null)
    const body: Record<string, unknown> = {
      name: name.trim(),
      websiteDomain: websiteDomain.trim() || null,
      industry: industry.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    }
    if (!hasStructured) {
      const customFields = buildCustomFields()
      if (typeof customFields === 'string') {
        setLocalError(customFields)
        return
      }
      body.customFields = Object.keys(customFields).length ? customFields : null
    }
    const result = await action.run(() => workspaceSend<{ id: string }>(CRM_API.company(company.id), body, 'PATCH'))
    if (result.ok) onSaved()
  }

  return (
    <Section title={t.edit}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={f.name} value={name} onChange={setName} required />
          <TextField label={f.website} value={websiteDomain} onChange={setWebsiteDomain} />
          <TextField label={f.industry} value={industry} onChange={setIndustry} />
          <TextField label={f.email} value={email} onChange={setEmail} type="email" />
          <TextField label={f.phone} value={phone} onChange={setPhone} type="tel" />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">{t.customTitle}</legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.customDescription} {t.customKeyHint}
          </p>
          {hasStructured ? (
            <GapNotice title={t.customTitle} body={t.customUnsupported} />
          ) : (
            <>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
                  <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {t.customKey}
                    <Input value={row.key} onChange={(e) => updateRow(row.id, { key: e.target.value })} maxLength={64} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {t.customType}
                    <select
                      className={selectClass}
                      value={row.type}
                      onChange={(e) => {
                        const type = e.target.value as FieldType
                        updateRow(row.id, { type, value: type === 'boolean' ? 'true' : type === 'empty' ? '' : row.value })
                      }}
                    >
                      {(Object.keys(t.types) as FieldType[]).map((type) => (
                        <option key={type} value={type}>
                          {t.types[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {t.customValue}
                    {row.type === 'boolean' ? (
                      <select className={selectClass} value={row.value} onChange={(e) => updateRow(row.id, { value: e.target.value })}>
                        <option value="true">{t.yes}</option>
                        <option value="false">{t.no}</option>
                      </select>
                    ) : (
                      <Input
                        value={row.value}
                        disabled={row.type === 'empty'}
                        inputMode={row.type === 'number' ? 'decimal' : undefined}
                        maxLength={2048}
                        onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      />
                    )}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 justify-self-end"
                    onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">{t.customRemove}</span>
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={rows.length >= MAX_FIELDS}
                onClick={() => {
                  setRows((current) => [...current, { id: nextId, key: '', type: 'text', value: '' }])
                  setNextId((n) => n + 1)
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t.customAdd}
              </Button>
            </>
          )}
        </fieldset>

        {localError && (
          <p role="alert" className="text-sm text-destructive">
            {localError}
          </p>
        )}
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}

        <FormActions>
          <Button type="submit" disabled={action.pending || !name.trim()}>
            {t.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
