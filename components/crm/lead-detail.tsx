'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowUpRight, Check, ClipboardList, Info, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Facts, GapNotice, LoadingRows, SuccessNote, TextAreaField } from './workspace-kit'
import { LeadIssueState, LeadStatusPill } from './lead-shared'
import type { CrmLeadsCopy } from '@/lib/i18n/dictionaries/crm-leads-en'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  LEADS_API,
  REJECT_REASON_MAX,
  canTransition,
  isRetryableIssue,
  leadIssue,
  type ConvertResult,
  type LeadDetailResponse,
  type LeadTransition,
  type SiteLead,
  type TransitionResult,
} from '@/lib/crm-ui/leads'
import { DASH, formatDateTime, newIdempotencyKey, workspaceSend, type MutationResult } from '@/lib/crm-ui/workspace'

type Outcome = { action: LeadTransition; contactId?: string } | null

export function LeadDetail({
  leadId,
  accountId,
  locale,
  copy,
  lc,
  base,
  siteLabel,
  onChanged,
  onClose,
}: {
  leadId: string
  accountId: string
  locale: string
  copy: CrmWorkspaceCopy
  lc: CrmLeadsCopy
  base: string
  siteLabel: (id: string) => string
  onChanged: () => void
  onClose: () => void
}) {
  const detail = useWorkspace<LeadDetailResponse>(LEADS_API.lead(leadId), accountId)
  const d = lc.detail

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{d.title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={d.close}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {detail.error ? (
        <LeadIssueState error={detail.error} lc={lc} retryLabel={copy.kit.retry} onRetry={() => detail.mutate()} />
      ) : !detail.data ? (
        <LoadingRows rows={4} label={d.loading} />
      ) : (
        <LeadReview
          lead={detail.data.lead}
          locale={locale}
          lc={lc}
          base={base}
          siteLabel={siteLabel}
          cancelLabel={copy.kit.cancel}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

function LeadReview({
  lead,
  locale,
  lc,
  base,
  siteLabel,
  cancelLabel,
  onChanged,
}: {
  lead: SiteLead
  locale: string
  lc: CrmLeadsCopy
  base: string
  siteLabel: (id: string) => string
  cancelLabel: string
  onChanged: () => void
}) {
  const d = lc.detail
  const f = d.fields
  const a = lc.actions
  const action = useAction<TransitionResult | ConvertResult>()
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertFailed, setConvertFailed] = useState(false)
  // One key per conversion attempt, reused on retries so the backend can deduplicate the request.
  const convertKey = useRef<string | null>(null)
  const inFlight = useRef(false)

  async function send<T>(request: () => Promise<MutationResult<T>>) {
    if (inFlight.current) return null
    inFlight.current = true
    setOutcome(null)
    const result = await action.run(request as () => Promise<MutationResult<TransitionResult | ConvertResult>>)
    inFlight.current = false
    // Refresh on failure too, so a status conflict shows the lead's real current status.
    onChanged()
    return result
  }

  async function transition(kind: 'pendingReview' | 'qualify' | 'reject', body?: unknown) {
    const result = await send(() => workspaceSend<TransitionResult>(LEADS_API.action(lead.id, kind), body))
    if (result?.ok) setOutcome({ action: kind })
    return result
  }

  async function confirmReject() {
    const trimmed = reason.trim()
    const result = await transition('reject', trimmed ? { reason: trimmed } : {})
    if (result) {
      setRejectOpen(false)
      setReason('')
    }
  }

  async function confirmConvert() {
    convertKey.current ??= newIdempotencyKey()
    const key = convertKey.current
    const result = await send(() =>
      workspaceSend<ConvertResult>(LEADS_API.action(lead.id, 'convert'), {}, 'POST', { 'x-idempotency-key': key }),
    )
    if (!result) return
    const contactId = result.ok && 'contactId' in result.data && typeof result.data.contactId === 'string' ? result.data.contactId : null
    if (result.ok && contactId) {
      convertKey.current = null
      setConvertFailed(false)
      setConvertOpen(false)
      setOutcome({ action: 'convert', contactId })
      return
    }
    if (!result.ok && isRetryableIssue(leadIssue(result.error))) {
      setConvertFailed(true)
      return
    }
    // Definitive answers (conflict, not found, permission) end this attempt; a later one gets a new key.
    convertKey.current = null
    setConvertFailed(false)
    setConvertOpen(false)
  }

  const available = (['pendingReview', 'qualify', 'reject', 'convert'] as const).filter((t) => canTransition(t, lead.status))
  const terminal = lead.status === 'REJECTED' || lead.status === 'CONVERTED' ? lead.status : null
  const pending = action.pending

  const facts: [string, React.ReactNode][] = [
    [f.name, lead.contactName || DASH],
    [
      f.email,
      <a key="email" href={`mailto:${lead.contactEmail}`} className="underline-offset-4 hover:underline">
        {lead.contactEmail}
      </a>,
    ],
    [f.phone, lead.contactPhone || DASH],
    [f.site, siteLabel(lead.managedSiteId)],
    [f.form, lead.formReference || DASH],
    [f.locale, lead.locale || DASH],
    [f.submitted, formatDateTime(lead.submittedAt, locale)],
    [f.received, formatDateTime(lead.createdAt, locale)],
  ]
  if (lead.crmContactId) {
    facts.push([
      f.crmContact,
      <Link key="contact" href={`${base}/contacts/${encodeURIComponent(lead.crmContactId)}`} className="font-mono text-xs underline-offset-4 hover:underline">
        {lead.crmContactId}
      </Link>,
    ])
  }
  if (lead.convertedAt) facts.push([f.convertedAt, formatDateTime(lead.convertedAt, locale)])
  if (lead.duplicateOfLeadId) facts.push([f.duplicateOf, <span key="dup" className="font-mono text-xs">{lead.duplicateOfLeadId}</span>])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-medium text-foreground">{lead.contactName || lead.contactEmail}</p>
        <LeadStatusPill status={lead.status} lc={lc} />
      </div>

      {outcome && (
        <SuccessNote>
          <span className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="flex flex-col gap-1">
              <span>{lc.results[outcome.action]}</span>
              {outcome.contactId && (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {lc.results.contactId}: <span className="font-mono text-xs">{outcome.contactId}</span>
                  </span>
                  <Link
                    href={`${base}/contacts/${encodeURIComponent(outcome.contactId)}`}
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    {d.openContact}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </span>
              )}
            </span>
          </span>
        </SuccessNote>
      )}
      {action.error && !convertOpen && <LeadIssueState error={action.error} lc={lc} compact />}

      {lead.status === 'DUPLICATE_REVIEW' && <GapNotice title={d.duplicateNotice.title} body={d.duplicateNotice.body} />}

      <section aria-label={d.contact} className="flex flex-col gap-3">
        <Facts items={facts} />
      </section>

      <section aria-label={f.message} className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.message}</h3>
        {lead.message ? (
          <p className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted p-3 text-sm leading-relaxed text-foreground">
            {lead.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{f.noMessage}</p>
        )}
      </section>

      <section aria-labelledby={`lead-actions-${lead.id}`} className="flex flex-col gap-3 border-t pt-4">
        <h3 id={`lead-actions-${lead.id}`} className="text-sm font-semibold text-foreground">
          {a.title}
        </h3>
        {terminal ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{d.terminal[terminal]}</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">{a.noneAvailable}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.includes('pendingReview') && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => transition('pendingReview')}>
                <ClipboardList className="size-4" aria-hidden="true" />
                {a.pendingReview}
              </Button>
            )}
            {available.includes('qualify') && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => transition('qualify')}>
                <Check className="size-4" aria-hidden="true" />
                {a.qualify}
              </Button>
            )}
            {available.includes('convert') && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  action.reset()
                  setConvertFailed(false)
                  setConvertOpen(true)
                }}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                {a.convert}
              </Button>
            )}
            {available.includes('reject') && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectOpen(true)}
              >
                <X className="size-4" aria-hidden="true" />
                {a.reject}
              </Button>
            )}
          </div>
        )}
        {pending && (
          <p role="status" className="text-xs text-muted-foreground">
            {a.working}
          </p>
        )}
        {!terminal && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {d.consentNotice}
          </p>
        )}
      </section>

      <Dialog open={rejectOpen} onOpenChange={(open) => !pending && setRejectOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{a.rejectDialog.title}</DialogTitle>
            <DialogDescription>{a.rejectDialog.body}</DialogDescription>
          </DialogHeader>
          <TextAreaField
            label={a.rejectDialog.reason}
            hint={a.rejectDialog.reasonHint}
            value={reason}
            rows={3}
            onChange={(v) => setReason(v.slice(0, REJECT_REASON_MAX))}
          />
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setRejectOpen(false)}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmReject}>
              {pending ? a.working : a.rejectDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={(open) => !pending && setConvertOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{a.convertDialog.title}</DialogTitle>
            <DialogDescription>{a.convertDialog.body}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            {a.convertDialog.points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          {action.error && (
            <div className="flex flex-col gap-2">
              <LeadIssueState error={action.error} lc={lc} compact />
              {convertFailed && <p className="text-xs leading-relaxed text-muted-foreground">{a.convertDialog.retryNote}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConvertOpen(false)}>
              {cancelLabel}
            </Button>
            <Button disabled={pending} onClick={confirmConvert}>
              {pending ? a.working : convertFailed ? a.convertDialog.retry : a.convertDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
