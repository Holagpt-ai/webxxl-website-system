'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import {
  FormActions,
  GapNotice,
  PlainTable,
  SectionHeading,
  SelectField,
  SuccessNote,
  TextAreaField,
  TextField,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  enumLabel,
  fill,
  formatDate,
  isGateError,
  newIdempotencyKey,
  workspaceSend,
} from '@/lib/crm-ui/workspace'
import { MKT_API, REQUEST_CATEGORIES, type MarketingRequest } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { BrandContextSection } from './brand-context'
import { REQUEST_TONE, flagBody, siteLabel } from './shared'

export function MarketingRequests(props: MarketingViewProps) {
  const { accountId, locale, copy, base, sites } = props
  const search = useSearchParams()
  const opportunityId = search.get('seoOpportunityId')
  const list = useWorkspace<{ requests: MarketingRequest[] }>(MKT_API.requests, accountId)
  const [formOpen, setFormOpen] = useState(Boolean(opportunityId))
  const [created, setCreated] = useState(false)
  const r = copy.requests
  const kit = copy.kit

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={r.title} description={r.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title={r.title} description={r.description} />
        {!formOpen && (
          <Button
            onClick={() => {
              setFormOpen(true)
              setCreated(false)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {r.new}
          </Button>
        )}
      </div>

      {created && <SuccessNote>{r.created}</SuccessNote>}

      {formOpen && (
        <CreateRequestForm
          {...props}
          opportunityId={opportunityId}
          initialSiteId={search.get('site')}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            setCreated(true)
            list.mutate()
          }}
        />
      )}

      <Section title={r.tableLabel}>
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.requests.length ? (
          <EmptyNote>{r.empty}</EmptyNote>
        ) : (
          <PlainTable label={r.tableLabel} headers={[r.goal, r.category, r.site, r.status, r.created_at]}>
            {list.data.requests.map((row) => (
              <tr key={row.id}>
                <td className={`${td} font-medium text-foreground`}>
                  <Link href={`${base}/requests/${row.id}`} className="underline-offset-4 hover:underline">
                    {row.goal ?? row.brief.slice(0, 60)}
                  </Link>
                </td>
                <td className={td}>{enumLabel(copy.enums.category, row.requestType)}</td>
                <td className={td}>{siteLabel(sites, row.managedSiteId, r.noSite)}</td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.requestStatus, row.status)} tone={REQUEST_TONE[row.status] ?? 'muted'} />
                </td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(row.createdAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>

      <BrandContextSection {...props} />
    </div>
  )
}

function CreateRequestForm({
  copy,
  sites,
  locale,
  opportunityId,
  initialSiteId,
  onCancel,
  onCreated,
}: MarketingViewProps & {
  opportunityId: string | null
  initialSiteId: string | null
  onCancel: () => void
  onCreated: () => void
}) {
  const r = copy.requests
  const [category, setCategory] = useState<string>(opportunityId ? 'SEO_CONTENT_FIX' : REQUEST_CATEGORIES[0])
  const [goal, setGoal] = useState('')
  const [brief, setBrief] = useState('')
  const [audience, setAudience] = useState('')
  const [siteId, setSiteId] = useState(initialSiteId && sites.some((s) => s.id === initialSiteId) ? initialSiteId : '')
  const [draftLocale, setDraftLocale] = useState(locale === 'es' ? 'es' : 'en')
  const [key] = useState(newIdempotencyKey)
  const action = useAction<unknown>()

  return (
    <Section title={r.new}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await action.run(() =>
            workspaceSend(MKT_API.requests, {
              category,
              goal: goal.trim(),
              brief: brief.trim(),
              audience: audience.trim() || undefined,
              managedSiteId: siteId || undefined,
              locale: draftLocale,
              seoOpportunityId: opportunityId ?? undefined,
              idempotencyKey: key,
            }),
          )
          if (result.ok) onCreated()
        }}
      >
        {opportunityId && <GapNotice title={r.category} body={fill(r.fromOpportunity, { id: opportunityId })} />}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label={r.category}
            value={category}
            onChange={setCategory}
            options={REQUEST_CATEGORIES.map((c) => ({ value: c, label: enumLabel(copy.enums.category, c) }))}
          />
          <SelectField
            label={r.site}
            value={siteId}
            onChange={setSiteId}
            options={[{ value: '', label: r.noSite }, ...sites.map((s) => ({ value: s.id, label: s.domain ?? s.name }))]}
          />
          <TextField label={r.goal} value={goal} onChange={setGoal} required />
          <TextField label={r.audience} value={audience} onChange={setAudience} />
          <SelectField
            label={r.language}
            value={draftLocale}
            onChange={setDraftLocale}
            options={['en', 'es'].map((l) => ({ value: l, label: enumLabel(copy.enums.locale, l) }))}
          />
        </div>
        <TextAreaField label={r.brief} hint={r.briefHint} value={brief} onChange={setBrief} required rows={5} />
        {action.error && (
          <WorkspaceState
            error={action.error}
            kit={copy.kit}
            workspace={copy.name}
            body={flagBody(action.error, copy.flags.draftPreparation)}
            compact
          />
        )}
        <FormActions>
          <Button type="submit" disabled={action.pending || !goal.trim() || !brief.trim()}>
            {action.pending ? copy.kit.saving : copy.kit.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {copy.kit.cancel}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
