'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section, StatusPill, td } from '@/components/commerce/ui'
import {
  Facts,
  FormActions,
  PlainTable,
  SelectField,
  TextAreaField,
  TextField,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  enumLabel,
  fill,
  formatDateTime,
  formatNumber,
  newIdempotencyKey,
  workspaceSend,
  type WorkspaceError,
} from '@/lib/crm-ui/workspace'
import {
  MKT_API,
  parseAudienceSnapshot,
  type AudienceBuckets,
  type AudiencePreview,
  type CampaignPreparationCreated,
  type CrmSegmentOption,
  type MarketingRequest,
} from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import type { MarketingStudioCopy } from '@/lib/i18n/dictionaries/marketing-studio-en'

/** A preview older than this is still valid evidence, but the user is nudged to refresh it. */
const PREVIEW_AGE_LIMIT_MINUTES = 15

type AudienceCopy = MarketingStudioCopy['audience']

const BUCKETS: { key: keyof AudienceBuckets; label: (a: AudienceCopy) => string }[] = [
  { key: 'marketingConsentGrantedContacts', label: (a) => a.consent },
  { key: 'revokedExpiredOrSuppressedContacts', label: (a) => a.revoked },
  { key: 'unknownMarketingConsentContacts', label: (a) => a.unknown },
  { key: 'missingUsableEmailContacts', label: (a) => a.missingEmail },
]

function time(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : Number.NaN
  return Number.isNaN(t) ? 0 : t
}

/** Maps MKT-25 failures to audience-specific explanations; returns undefined to keep the kit default. */
function audienceErrorBody(error: WorkspaceError | null, copy: MarketingStudioCopy, phase: 'list' | 'preview' | 'create') {
  if (!error) return undefined
  const a = copy.audience
  if (error.kind === 'DISABLED' || error.kind === 'NOT_CONFIGURED') {
    return phase === 'create' && /draft/i.test(error.detail ?? '') ? copy.flags.draftPreparation : copy.flags.audiencePlanning
  }
  if (error.code === 'FREE_SOFTWARE_NOT_ELIGIBLE') return a.notEntitled
  if (error.kind === 'QUOTA_EXCEEDED') return a.quota
  if (error.kind === 'NOT_FOUND' && phase !== 'list') return a.segmentGone
  if (error.kind === 'VALIDATION' && phase === 'preview') return a.notEvaluable
  return undefined
}

function isConflict(error: WorkspaceError | null) {
  return Boolean(error && (error.status === 409 || error.code === 'CONFLICT'))
}

export function PlanningBanner({ copy }: { copy: MarketingStudioCopy }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{copy.audience.planningBanner}</span> {copy.audience.noSending}
      </p>
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <span className="leading-relaxed">{children}</span>
    </p>
  )
}

/** Total first, then the overlapping buckets as a separate list so nothing reads as a breakdown of the total. */
export function AudienceCounts({ copy, locale, preview }: { copy: MarketingStudioCopy; locale: string; preview: AudiencePreview }) {
  const a = copy.audience
  const limit = preview.disclosures?.synchronousEvaluationLimit
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{a.total}</p>
        <p className="text-3xl font-semibold tabular-nums text-foreground">
          {formatNumber(preview.audience.totalMatchedContacts, locale)}
        </p>
        <p className="text-xs text-muted-foreground">{fill(a.evaluatedAt, { time: formatDateTime(preview.evaluatedAt, locale) })}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex items-baseline justify-between gap-4 rounded-lg border bg-card px-4 py-3">
            <dt className="text-sm text-muted-foreground">{b.label(a)}</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{formatNumber(preview.audience[b.key], locale)}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <li>{a.overlapNote}</li>
        <li>{fill(a.accountContacts, { count: formatNumber(preview.accountContactCount, locale) })}</li>
        {typeof limit === 'number' && <li>{fill(a.limit, { limit: formatNumber(limit, locale) })}</li>}
        <li>{a.pointInTime}</li>
      </ul>
    </div>
  )
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground"
      >
        {n}
      </span>
      {title}
    </h3>
  )
}

function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function AudiencePlanningFlow({
  accountId,
  copy,
  locale,
  sites,
  base,
  initialSiteId,
  controls,
  onCancel,
  onCreated,
}: MarketingViewProps & {
  initialSiteId: string | null
  controls: React.ReactNode
  onCancel: () => void
  onCreated: (requestId: string) => void
}) {
  const a = copy.audience
  const r = copy.requests
  const kit = copy.kit
  const segments = useWorkspace<{ segments: CrmSegmentOption[] }>(MKT_API.crmSegments, accountId)
  const preview = useAction<AudiencePreview>()
  const create = useAction<CampaignPreparationCreated>()
  const now = useMinuteClock()

  const [segmentId, setSegmentId] = useState('')
  const [goal, setGoal] = useState('')
  const [brief, setBrief] = useState('')
  const [audienceLabel, setAudienceLabel] = useState('')
  const [siteId, setSiteId] = useState(initialSiteId && sites.some((s) => s.id === initialSiteId) ? initialSiteId : '')
  const [draftLocale, setDraftLocale] = useState(locale === 'es' ? 'es' : 'en')
  const [attempt, setAttempt] = useState(0)
  const keys = useRef(new Map<string, string>())

  const list = segments.data?.segments ?? []
  const selected = list.find((s) => s.id === segmentId) ?? null
  const evidence = preview.data && preview.data.segmentId === segmentId ? preview.data : null
  const stale = Boolean(evidence && selected && time(selected.updatedAt) > time(evidence.evaluatedAt))
  const aged = Boolean(evidence && now - time(evidence.evaluatedAt) > PREVIEW_AGE_LIMIT_MINUTES * 60_000)
  const empty = evidence?.audience.totalMatchedContacts === 0
  const crmBase = base.replace(/\/marketing$/, '/crm')

  const payload = {
    category: 'CAMPAIGN_PREPARATION',
    crmSegmentId: segmentId,
    goal: goal.trim(),
    brief: brief.trim(),
    audienceLabel: audienceLabel.trim() || undefined,
    managedSiteId: siteId || undefined,
    locale: draftLocale,
  }
  // Retrying identical details reuses one key (safe replay); any change gets a new key instead of a 409.
  const signature = JSON.stringify([payload, attempt])
  if (!keys.current.has(signature)) keys.current.set(signature, newIdempotencyKey())
  const idempotencyKey = keys.current.get(signature) as string

  const canSubmit = Boolean(evidence && !stale && !empty && payload.goal && payload.brief) && !create.pending

  async function runPreview(id: string) {
    const result = await preview.run(() => workspaceSend<AudiencePreview>(MKT_API.audiencePreview(id)))
    // Refresh segment timestamps so the stale check compares against the latest edit.
    if (result.ok) segments.mutate()
  }

  function chooseSegment(id: string) {
    setSegmentId(id)
    preview.reset()
    create.reset()
  }

  return (
    <Section title={r.new}>
      <div className="flex flex-col gap-6">
        {controls}
        <PlanningBanner copy={copy} />

        <section className="flex flex-col gap-3" aria-labelledby="aud-step-1">
          <div id="aud-step-1">
            <StepHeading n={1} title={a.stepSegment} />
          </div>
          {segments.isLoading ? (
            <LoadingRows label={kit.loading} rows={3} />
          ) : segments.error ? (
            <WorkspaceState
              error={segments.error}
              kit={kit}
              workspace={copy.name}
              body={audienceErrorBody(segments.error, copy, 'list')}
              compact
              onRetry={() => segments.mutate()}
            />
          ) : !list.length ? (
            <div className="flex flex-col items-start gap-2">
              <EmptyNote>{a.segmentsEmpty}</EmptyNote>
              <Link href={`${crmBase}/segments`} className="text-sm font-medium underline underline-offset-4">
                {a.segmentsEmptyLink}
              </Link>
            </div>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{a.segmentsLabel}</legend>
              {list.map((s) => {
                const checked = s.id === segmentId
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer flex-col gap-2 rounded-lg border px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      checked ? 'border-primary bg-secondary' : 'bg-card hover:bg-muted'
                    } ${s.audiencePlanningEligible ? '' : 'cursor-not-allowed opacity-70'}`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="crm-segment"
                        value={s.id}
                        checked={checked}
                        disabled={!s.audiencePlanningEligible}
                        onChange={() => chooseSegment(s.id)}
                        className="mt-1 accent-primary"
                        aria-describedby={s.audiencePlanningEligible ? undefined : `seg-${s.id}-why`}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {enumLabel(a.kinds, s.kind)} · {fill(a.updated, { time: formatDateTime(s.updatedAt, locale) })}
                        </span>
                        {!s.audiencePlanningEligible && (
                          <span id={`seg-${s.id}-why`} className="text-xs text-muted-foreground">
                            {a.notEligibleReason}
                          </span>
                        )}
                      </span>
                    </span>
                    <StatusPill
                      label={s.audiencePlanningEligible ? a.eligible : a.notEligible}
                      tone={s.audiencePlanningEligible ? 'success' : 'muted'}
                      className="self-start sm:self-center"
                    />
                  </label>
                )
              })}
            </fieldset>
          )}
        </section>

        {selected && (
          <section className="flex flex-col gap-3" aria-labelledby="aud-step-2">
            <div id="aud-step-2" className="flex flex-wrap items-center justify-between gap-2">
              <StepHeading n={2} title={a.stepPreview} />
              <Button
                type="button"
                size="sm"
                variant={evidence ? 'outline' : 'default'}
                disabled={preview.pending}
                onClick={() => runPreview(selected.id)}
              >
                {preview.pending ? a.previewing : evidence ? a.previewAgain : a.preview}
              </Button>
            </div>
            {preview.error && (
              <WorkspaceState
                error={preview.error}
                kit={kit}
                workspace={copy.name}
                body={audienceErrorBody(preview.error, copy, 'preview')}
                compact
              />
            )}
            {evidence && (
              <>
                {stale && <Warning>{a.stale}</Warning>}
                {!stale && aged && <Warning>{fill(a.aged, { minutes: PREVIEW_AGE_LIMIT_MINUTES })}</Warning>}
                {empty && <Warning>{a.emptyAudience}</Warning>}
                <AudienceCounts copy={copy} locale={locale} preview={evidence} />
              </>
            )}
          </section>
        )}

        {evidence && !empty && (
          <form
            className="flex flex-col gap-4"
            aria-labelledby="aud-step-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!canSubmit) return
              const result = await create.run(() =>
                workspaceSend<CampaignPreparationCreated>(MKT_API.requests, { ...payload, idempotencyKey }),
              )
              if (result.ok) onCreated(result.data.requestId)
            }}
          >
            <div id="aud-step-3">
              <StepHeading n={3} title={a.stepConfirm} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField label={r.goal} value={goal} onChange={setGoal} required />
              <TextField
                label={a.audienceLabel}
                hint={a.audienceLabelHint}
                value={audienceLabel}
                onChange={setAudienceLabel}
              />
              <SelectField
                label={r.site}
                value={siteId}
                onChange={setSiteId}
                options={[{ value: '', label: r.noSite }, ...sites.map((s) => ({ value: s.id, label: s.domain ?? s.name }))]}
              />
              <SelectField
                label={r.language}
                value={draftLocale}
                onChange={setDraftLocale}
                options={['en', 'es'].map((l) => ({ value: l, label: enumLabel(copy.enums.locale, l) }))}
              />
            </div>
            <TextAreaField label={r.brief} hint={r.briefHint} value={brief} onChange={setBrief} required rows={5} />
            <p className="text-xs leading-relaxed text-muted-foreground">{a.reevaluateNote}</p>
            {create.error &&
              (isConflict(create.error) ? (
                <div className="flex flex-col items-start gap-2">
                  <Warning>{a.conflict}</Warning>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAttempt((n) => n + 1)
                      create.reset()
                    }}
                  >
                    {a.newAttempt}
                  </Button>
                </div>
              ) : (
                <WorkspaceState
                  error={create.error}
                  kit={kit}
                  workspace={copy.name}
                  body={audienceErrorBody(create.error, copy, 'create')}
                  compact
                />
              ))}
            <FormActions>
              <Button type="submit" disabled={!canSubmit}>
                {create.pending ? a.submitting : a.submit}
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                {kit.cancel}
              </Button>
            </FormActions>
          </form>
        )}

        {!(evidence && !empty) && (
          <FormActions>
            {selected && !evidence && <p className="text-sm text-muted-foreground">{a.needPreview}</p>}
            <Button type="button" variant="ghost" onClick={onCancel}>
              {kit.cancel}
            </Button>
          </FormActions>
        )}
      </div>
    </Section>
  )
}

/** Request detail: the stored snapshot is history; "current" is a separate, on-demand evaluation. */
export function AudienceSnapshotSection({ copy, locale, request }: MarketingViewProps & { request: MarketingRequest }) {
  const a = copy.audience
  const snapshot = parseAudienceSnapshot(request.audiencePlanningSummary)
  const current = useAction<AudiencePreview>()
  if (!request.crmSegmentId && !snapshot) return null

  const segmentId = request.crmSegmentId ?? null
  const live = current.data
  const changedSince = Boolean(snapshot && live && time(live.segmentUpdatedAt) > time(snapshot.evaluatedAt))
  const rows: { label: string; key: keyof AudienceBuckets }[] = [
    { label: a.total, key: 'totalMatchedContacts' },
    ...BUCKETS.map((b) => ({ label: b.label(a), key: b.key })),
  ]

  return (
    <Section title={a.snapshotTitle} description={a.snapshotBody}>
      <div className="flex flex-col gap-4">
        <PlanningBanner copy={copy} />
        {!snapshot ? (
          <EmptyNote>{a.snapshotMissing}</EmptyNote>
        ) : (
          <>
            <Facts
              items={[
                [a.segment, `${snapshot.segmentName} (${enumLabel(a.kinds, snapshot.segmentKind)})`],
                [a.snapshotAt, formatDateTime(request.audienceEvaluatedAt ?? snapshot.evaluatedAt, locale)],
              ]}
            />
            <PlainTable label={a.snapshotTitle} headers={live ? [a.measure, a.snapshotCol, a.currentCol] : [a.measure, a.snapshotCol]}>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className={`${td} text-foreground`}>{row.label}</td>
                  <td className={`${td} tabular-nums`}>{formatNumber(snapshot.audience[row.key], locale)}</td>
                  {live && <td className={`${td} tabular-nums`}>{formatNumber(live.audience[row.key], locale)}</td>}
                </tr>
              ))}
            </PlainTable>
            <p className="text-xs leading-relaxed text-muted-foreground">{a.overlapNote}</p>
          </>
        )}

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-foreground">{a.currentTitle}</h3>
              <p className="text-xs text-muted-foreground">{live ? fill(a.evaluatedAt, { time: formatDateTime(live.evaluatedAt, locale) }) : a.currentBody}</p>
            </div>
            {segmentId && (
              <Button
                size="sm"
                variant="outline"
                disabled={current.pending}
                onClick={() => current.run(() => workspaceSend<AudiencePreview>(MKT_API.audiencePreview(segmentId)))}
              >
                {current.pending ? a.checking : a.checkCurrent}
              </Button>
            )}
          </div>
          {!segmentId && <p className="text-sm text-muted-foreground">{a.segmentGone}</p>}
          {changedSince && <Warning>{a.changedSince}</Warning>}
          {current.error && (
            <WorkspaceState
              error={current.error}
              kit={copy.kit}
              workspace={copy.name}
              body={audienceErrorBody(current.error, copy, 'preview')}
              compact
            />
          )}
          {live && !snapshot && <AudienceCounts copy={copy} locale={locale} preview={live} />}
          {live && snapshot && <p className="text-xs text-muted-foreground">{a.currentBody}</p>}
        </div>
      </div>
    </Section>
  )
}
