'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
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
  TextField,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  DASH,
  asStringArray,
  enumLabel,
  formatDate,
  isGateError,
  newIdempotencyKey,
  workspaceSend,
} from '@/lib/crm-ui/workspace'
import { MKT_API, SOCIAL_PLATFORMS, type SocialCampaign } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { CAMPAIGN_TONE, flagBody } from './shared'

export function campaignDates(c: SocialCampaign, locale: string) {
  if (!c.startDate && !c.endDate) return DASH
  return `${formatDate(c.startDate, locale)} – ${formatDate(c.endDate, locale)}`
}

export function MarketingCampaigns(props: MarketingViewProps) {
  const { accountId, locale, copy, base } = props
  const list = useWorkspace<{ campaigns: SocialCampaign[] }>(MKT_API.campaigns, accountId)
  const [formOpen, setFormOpen] = useState(false)
  const [created, setCreated] = useState(false)
  const c = copy.campaigns
  const kit = copy.kit

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={c.title} description={c.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} body={flagBody(list.error, copy.flags.social)} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title={c.title} description={c.description} />
        {!formOpen && (
          <Button
            onClick={() => {
              setFormOpen(true)
              setCreated(false)
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {c.new}
          </Button>
        )}
      </div>

      <GapNotice title={c.title} body={c.handoffNote} />
      {created && <SuccessNote>{c.created}</SuccessNote>}

      {formOpen && (
        <CreateCampaignForm
          copy={copy}
          locale={locale}
          onCancel={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            setCreated(true)
            list.mutate()
          }}
        />
      )}

      <Section title={c.tableLabel}>
        {list.isLoading ? (
          <LoadingRows label={kit.loading} rows={4} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.campaigns.length ? (
          <EmptyNote>{c.empty}</EmptyNote>
        ) : (
          <PlainTable label={c.tableLabel} headers={[c.goal, c.platforms, c.status, c.dates, c.updated]}>
            {list.data.campaigns.map((row) => (
              <tr key={row.id}>
                <td className={`${td} font-medium text-foreground`}>
                  <Link href={`${base}/campaigns/${row.id}`} className="underline-offset-4 hover:underline">
                    {row.goal}
                  </Link>
                </td>
                <td className={td}>
                  {asStringArray(row.targetPlatforms)
                    .map((p) => enumLabel(copy.enums.platform, p))
                    .join(', ') || DASH}
                </td>
                <td className={td}>
                  <StatusPill label={enumLabel(copy.enums.campaignStatus, row.status)} tone={CAMPAIGN_TONE[row.status] ?? 'muted'} />
                </td>
                <td className={`${td} whitespace-nowrap`}>{campaignDates(row, locale)}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(row.updatedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function CreateCampaignForm({
  copy,
  locale,
  onCancel,
  onCreated,
}: {
  copy: MarketingViewProps['copy']
  locale: string
  onCancel: () => void
  onCreated: () => void
}) {
  const c = copy.campaigns
  const groupId = useId()
  const [goal, setGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [brand, setBrand] = useState('')
  const [campaignLocale, setCampaignLocale] = useState(locale === 'es' ? 'es' : 'en')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [key] = useState(newIdempotencyKey)
  const action = useAction<unknown>()

  return (
    <Section title={c.new} description={c.quota}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await action.run(() =>
            workspaceSend(MKT_API.campaigns, {
              goal: goal.trim(),
              locale: campaignLocale,
              targetPlatforms: platforms,
              targetAudience: audience.trim() || undefined,
              brandProfile: brand.trim() || undefined,
              idempotencyKey: key,
            }),
          )
          if (result.ok) onCreated()
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label={c.goal} value={goal} onChange={setGoal} required />
          <TextField label={c.audience} value={audience} onChange={setAudience} />
          <TextField label={c.brand} value={brand} onChange={setBrand} />
          <SelectField
            label={c.language}
            value={campaignLocale}
            onChange={setCampaignLocale}
            options={['en', 'es'].map((l) => ({ value: l, label: enumLabel(copy.enums.locale, l) }))}
          />
        </div>
        <fieldset className="flex flex-col gap-2" aria-describedby={`${groupId}-hint`}>
          <legend className="text-sm font-medium text-foreground">{c.platforms}</legend>
          <p id={`${groupId}-hint`} className="text-xs text-muted-foreground">
            {c.platformsHint}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <label key={p} className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={platforms.includes(p)}
                  onChange={(e) => setPlatforms((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))}
                />
                {enumLabel(copy.enums.platform, p)}
              </label>
            ))}
          </div>
        </fieldset>
        {action.error && (
          <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} body={flagBody(action.error, copy.flags.social)} compact />
        )}
        <FormActions>
          <Button type="submit" disabled={action.pending || !goal.trim() || !platforms.length}>
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
