'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDateTime } from '@/lib/crm-ui/workspace'
import { CRM_API, type CrmConsent, type CrmConsentState } from '@/lib/crm-ui/types'
import { EmptyNote, LoadingRows, Section, StatusPill, WorkspaceState } from './workspace-kit'

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
                    <span className="text-xs text-muted-foreground">
                      {t.reason}: {s.reason} · {t.source}: {s.source} · {t.since} {formatDateTime(s.createdAt, locale)}
                    </span>
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
                {t.importNote} {t.readOnly}
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
