'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime, newIdempotencyKey, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, type CrmConsent, type CrmConsentState, type CrmSuppressionLiftResult } from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  LoadingRows,
  Section,
  StatusPill,
  SuccessNote,
  TextField,
  WorkspaceState,
} from './workspace-kit'

type Props = {
  accountId: string
  contactId: string
  locale: string
  copy: CrmWorkspaceCopy
  base: string
  canManage: boolean
}

const CONSENT_TONE: Record<string, 'success' | 'danger' | 'muted'> = { GRANTED: 'success', REVOKED: 'danger', UNKNOWN: 'muted' }

export function ContactConsentPanel({ accountId, contactId, locale, copy, base, canManage }: Props) {
  const state = useWorkspace<CrmConsentState>(CRM_API.consent(contactId), accountId)
  const t = copy.contact.consent
  const e = copy.enums

  const consents = [...(state.data?.consents ?? [])].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  const suppressions = (state.data?.suppressions ?? []).filter((s) => s.active)
  const channelPurpose = (channel: string, purpose: string) =>
    `${enumLabel(e.consentChannel, channel)} · ${enumLabel(e.consentPurpose, purpose)}`

  return (
    <Section title={t.title} description={t.description}>
      {state.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={3} />
      ) : state.error ? (
        <WorkspaceState error={state.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => state.mutate()} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t.suppressionsTitle}</h3>
            {suppressions.length === 0 ? (
              <EmptyNote>{t.suppressionsEmpty}</EmptyNote>
            ) : (
              <ul className="flex flex-col divide-y">
                {suppressions.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 py-2.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {channelPurpose(s.channel, s.purpose)}
                      <StatusPill label={t.suppressionsTitle} tone="danger" />
                    </span>
                    <span className="break-words text-xs text-muted-foreground">
                      {t.reason}: {s.reason} · {t.source}: {s.source} · {t.since} {formatDateTime(s.createdAt, locale)}
                    </span>
                    {canManage && (
                      <SuppressionLift
                        contactId={contactId}
                        suppressionId={s.id}
                        copy={copy}
                        onLifted={() => state.mutate()}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t.historyTitle}</h3>
            {consents.length === 0 ? (
              <EmptyNote>{t.historyEmpty}</EmptyNote>
            ) : (
              <ol className="flex flex-col divide-y">
                {consents.map((c) => (
                  <ConsentRow key={c.id} consent={c} label={channelPurpose(c.channel, c.purpose)} copy={copy} locale={locale} />
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {t.importNote} {canManage ? t.liftBody : t.readOnly}
              </span>
            </p>
            {canManage && (
              <Link href={`${base}/settings`} className="font-medium text-foreground underline underline-offset-4">
                {t.manageLink}
              </Link>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}

function SuppressionLift({
  contactId,
  suppressionId,
  copy,
  onLifted,
}: {
  contactId: string
  suppressionId: string
  copy: CrmWorkspaceCopy
  onLifted: () => void
}) {
  const t = copy.contact.consent
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [source, setSource] = useState('')
  const [idempotencyKey] = useState(newIdempotencyKey)
  const action = useAction<CrmSuppressionLiftResult>()

  if (action.data) {
    return <SuccessNote>{action.data.alreadyLifted ? t.alreadyLifted : t.lifted}</SuccessNote>
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-1 min-h-11 self-start sm:min-h-9" onClick={() => setOpen(true)}>
        {t.lift}
      </Button>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = await action.run(() =>
      workspaceSend<CrmSuppressionLiftResult>(CRM_API.suppressionLift(contactId), {
        suppressionId,
        reason: reason.trim(),
        source: source.trim(),
        idempotencyKey,
      }),
    )
    if (result.ok) onLifted()
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-3 rounded-md border bg-muted/40 p-3" aria-label={t.liftTitle}>
      <p className="text-sm font-semibold text-foreground">{t.liftTitle}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{t.liftBody}</p>
      <TextField label={t.liftReason} value={reason} onChange={setReason} required />
      <TextField label={t.liftSource} value={source} onChange={setSource} hint={t.liftSourceHint} required />
      {action.error &&
        (action.error.kind === 'FORBIDDEN' ? (
          <p role="alert" className="text-sm text-destructive">
            {t.liftOwnerOnly}
          </p>
        ) : (
          <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />
        ))}
      <FormActions>
        <Button type="submit" disabled={action.pending || !reason.trim() || !source.trim()}>
          {t.liftConfirm}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t.liftCancel}
        </Button>
      </FormActions>
    </form>
  )
}

function ConsentRow({ consent, label, copy, locale }: { consent: CrmConsent; label: string; copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.contact.consent
  const details: [string, string][] = [
    [t.source, consent.source],
    [t.captured, formatDateTime(consent.capturedAt, locale)],
  ]
  if (consent.revokedAt) details.push([t.revoked, formatDateTime(consent.revokedAt, locale)])
  if (consent.expiresAt) details.push([t.expires, formatDateTime(consent.expiresAt, locale)])
  if (consent.termsVersion) details.push([t.terms, consent.termsVersion])
  if (consent.jurisdiction) details.push([t.jurisdiction, consent.jurisdiction])

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
        {label}
        <StatusPill label={enumLabel(copy.enums.consentStatus, consent.status)} tone={CONSENT_TONE[consent.status] ?? 'muted'} />
      </span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words text-foreground">{value || DASH}</dd>
          </div>
        ))}
        {consent.evidence?.length ? (
          <div className="contents">
            <dt className="text-muted-foreground">{t.evidence}</dt>
            <dd className="break-all font-mono text-foreground">{consent.evidence.map((ev) => ev.evidenceRef).join(', ')}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  )
}
