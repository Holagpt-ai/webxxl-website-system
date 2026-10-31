'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { ArrowLeft, Check, GitMerge, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusPill, type PillTone } from '@/components/commerce/ui'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import {
  DASH,
  enumLabel,
  fill,
  formatDate,
  formatNumber,
  formatPercent,
  isGateError,
  withQuery,
  workspaceSend,
  type WorkspaceError,
} from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  MERGE_STATUSES,
  contactName,
  primaryIdentity,
  type CrmConsentState,
  type CrmContact,
  type CrmMergeProposal,
  type MergeApproval,
} from '@/lib/crm-ui/types'
import { EmptyNote, FormActions, GapNotice, LoadingRows, SectionHeading, SelectField, SuccessNote, WorkspaceState } from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

type ConflictKind = 'consent' | 'chatwoot' | 'resolved' | 'invalid'

type Outcome = { tone: 'success'; text: string; survivorId?: string } | null

const STATUS_TONE: Record<string, PillTone> = { PENDING: 'info', APPROVED: 'success', REJECTED: 'muted', RESOLVING: 'neutral' }

/** The backend reports preflight blocks as a 409 with a descriptive message; nothing is merged in that case. */
function classifyConflict(error: WorkspaceError): ConflictKind | null {
  const detail = error.detail ?? ''
  if (/not pending/i.test(detail)) return 'resolved'
  if (/chatwoot/i.test(detail)) return 'chatwoot'
  if (/consent|suppress/i.test(detail)) return 'consent'
  if (error.kind === 'NOT_FOUND' && !/proposal/i.test(detail)) return 'invalid'
  if (/not active|merged/i.test(detail)) return 'invalid'
  return null
}

export function CrmMergeReview({ accountId, locale, copy, base }: Props) {
  const t = copy.merges
  const kit = copy.kit
  const [status, setStatus] = useState<string>('PENDING')
  const [outcome, setOutcome] = useState<Outcome>(null)
  const list = useWorkspace<{ proposals: CrmMergeProposal[] }>(withQuery(CRM_API.mergeProposals, { status }), accountId)

  const heading = (
    <div className="flex flex-col gap-3">
      <Link
        href={`${base}/contacts`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.back}
      </Link>
      <SectionHeading title={t.title} description={t.description} />
    </div>
  )

  if (isGateError(list.error)) {
    return (
      <>
        {heading}
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

  const proposals = list.data?.proposals ?? []

  return (
    <div className="flex flex-col gap-6">
      {heading}
      <GapNotice title={kit.states.FORBIDDEN.title} body={t.adminOnly} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-64">
          <SelectField
            label={t.statusLabel}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setOutcome(null)
            }}
            options={MERGE_STATUSES.map((s) => ({ value: s, label: enumLabel(t.statuses, s) }))}
          />
        </div>
        <Button variant="outline" onClick={() => list.mutate()} disabled={list.isValidating}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t.refresh}
        </Button>
      </div>

      {outcome && (
        <SuccessNote>
          {outcome.text}{' '}
          {outcome.survivorId && (
            <Link href={`${base}/contacts/${encodeURIComponent(outcome.survivorId)}`} className="font-medium underline underline-offset-4">
              {t.viewKept}
            </Link>
          )}
        </SuccessNote>
      )}

      {status !== 'PENDING' && proposals.length > 0 && <p className="text-sm text-muted-foreground">{t.resolvedNote}</p>}

      {list.isLoading ? (
        <LoadingRows label={kit.loading} />
      ) : list.error ? (
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
      ) : proposals.length === 0 ? (
        <EmptyNote>{t.empty[status] ?? t.empty.PENDING}</EmptyNote>
      ) : (
        <ol className="flex flex-col gap-4">
          {proposals.map((proposal, index) => (
            <li key={proposal.id}>
              <ProposalCard
                proposal={proposal}
                index={index + 1}
                accountId={accountId}
                locale={locale}
                copy={copy}
                base={base}
                onResolved={(next) => {
                  setOutcome(next)
                  list.mutate()
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ProposalCard({
  proposal,
  index,
  accountId,
  locale,
  copy,
  base,
  onResolved,
}: {
  proposal: CrmMergeProposal
  index: number
  accountId: string
  locale: string
  copy: CrmWorkspaceCopy
  base: string
  onResolved: (outcome: Outcome) => void
}) {
  const t = copy.merges
  const headingId = useId()
  const pending = proposal.status === 'PENDING'
  const primary = useWorkspace<{ contact: CrmContact }>(CRM_API.contact(proposal.primaryContactId), accountId)
  const duplicate = useWorkspace<{ contact: CrmContact }>(CRM_API.contact(proposal.duplicateContactId), accountId)
  const primaryConsent = useWorkspace<CrmConsentState>(pending ? CRM_API.consent(proposal.primaryContactId) : null, accountId)
  const duplicateConsent = useWorkspace<CrmConsentState>(pending ? CRM_API.consent(proposal.duplicateContactId) : null, accountId)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const reject = useAction<unknown>()
  const approve = useAction<MergeApproval>()

  const primaryContact = primary.data?.contact
  const duplicateContact = duplicate.data?.contact
  const primaryName = primaryContact ? contactName(primaryContact, copy.fields.unnamed) : proposal.primaryContactId
  const duplicateName = duplicateContact ? contactName(duplicateContact, copy.fields.unnamed) : proposal.duplicateContactId
  const bothLoaded = Boolean(primaryContact && duplicateContact)
  const conflict = approve.error ? classifyConflict(approve.error) : null

  async function onReject() {
    const result = await reject.run(() => workspaceSend<unknown>(CRM_API.mergeProposal(proposal.id), { action: 'reject' }))
    if (result.ok) onResolved({ tone: 'success', text: t.rejected })
  }

  async function onApprove() {
    const result = await approve.run(() => workspaceSend<MergeApproval>(CRM_API.mergeProposal(proposal.id), { action: 'approve' }))
    setConfirmOpen(false)
    if (result.ok) {
      onResolved({
        tone: 'success',
        text: fill(t.approved, { duplicate: duplicateName, primary: primaryName }),
        survivorId: result.data.survivorContactId,
      })
    }
  }

  const rows: [string, (c: CrmContact) => string][] = [
    [copy.fields.name, (c) => contactName(c, copy.fields.unnamed)],
    [copy.fields.email, (c) => primaryIdentity(c, 'EMAIL') ?? DASH],
    [copy.fields.phone, (c) => primaryIdentity(c, 'PHONE') ?? DASH],
    [copy.fields.company, (c) => c.organizationName ?? DASH],
    [copy.fields.jobTitle, (c) => c.jobTitle ?? DASH],
    [copy.fields.city, (c) => c.city ?? DASH],
    [copy.fields.leadSource, (c) => c.leadSource ?? DASH],
    [copy.fields.created, (c) => formatDate(c.createdAt, locale)],
    [copy.fields.lastActivity, (c) => (c.lastActivityAt ? formatDate(c.lastActivityAt, locale) : DASH)],
  ]

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="font-semibold text-foreground">
            {fill(t.proposalLabel, { index })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {fill(t.proposed, { date: formatDate(proposal.createdAt, locale) })}
            {' · '}
            {fill(t.confidence, { value: formatPercent(proposal.confidenceBps / 10000, locale) })}
          </p>
        </div>
        <StatusPill label={enumLabel(t.statuses, proposal.status)} tone={STATUS_TONE[proposal.status] ?? 'neutral'} />
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ContactRef
          role={t.primary}
          hint={t.primaryHint}
          id={proposal.primaryContactId}
          name={primaryName}
          base={base}
          loading={primary.isLoading}
          failed={Boolean(primary.error)}
          consent={primaryConsent.data}
          consentFailed={Boolean(primaryConsent.error)}
          copy={copy}
          locale={locale}
        />
        <ContactRef
          role={t.duplicate}
          hint={t.duplicateHint}
          id={proposal.duplicateContactId}
          name={duplicateName}
          base={base}
          loading={duplicate.isLoading}
          failed={Boolean(duplicate.error)}
          consent={duplicateConsent.data}
          consentFailed={Boolean(duplicateConsent.error)}
          copy={copy}
          locale={locale}
        />
      </div>

      {bothLoaded && (
        <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label={t.compareLabel}>
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">{t.compareLabel}</caption>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t.field}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.primary}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.duplicate}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, read]) => {
                const a = read(primaryContact!)
                const b = read(duplicateContact!)
                const differs = a !== b
                return (
                  <tr key={label} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-muted-foreground">
                      <span className="flex items-center gap-2">
                        {label}
                        {differs && <StatusPill label={t.differs} tone="info" />}
                      </span>
                    </th>
                    <td className="break-words px-3 py-2 text-foreground">{a}</td>
                    <td className="break-words px-3 py-2 text-foreground">{b}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.reconcileNote}</p>

          {conflict && (
            <div role="alert" className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <p className="font-semibold text-destructive">{t.conflicts[conflict].title}</p>
              <p className="leading-relaxed text-foreground">{t.conflicts[conflict].body}</p>
              {approve.error?.detail && <p className="text-xs text-muted-foreground">{fill(t.backendDetail, { message: approve.error.detail })}</p>}
            </div>
          )}
          {approve.error && !conflict && <WorkspaceState error={approve.error} kit={copy.kit} workspace={copy.name} compact />}
          {reject.error && <WorkspaceState error={reject.error} kit={copy.kit} workspace={copy.name} compact />}

          <FormActions>
            <Button onClick={() => setConfirmOpen(true)} disabled={!bothLoaded || approve.pending || reject.pending || conflict === 'resolved'}>
              <GitMerge className="size-4" aria-hidden="true" />
              {t.approve}
            </Button>
            <Button variant="outline" onClick={onReject} disabled={reject.pending || approve.pending}>
              <X className="size-4" aria-hidden="true" />
              {reject.pending ? t.rejecting : t.reject}
            </Button>
          </FormActions>

          <ConfirmMerge
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            pending={approve.pending}
            primaryName={primaryName}
            duplicateName={duplicateName}
            onConfirm={onApprove}
            copy={copy}
          />
        </>
      )}
    </article>
  )
}

function ContactRef({
  role,
  hint,
  id,
  name,
  base,
  loading,
  failed,
  consent,
  consentFailed,
  copy,
  locale,
}: {
  role: string
  hint: string
  id: string
  name: string
  base: string
  loading: boolean
  failed: boolean
  consent?: CrmConsentState
  consentFailed: boolean
  copy: CrmWorkspaceCopy
  locale: string
}) {
  const t = copy.merges
  const activeSuppressions = consent?.suppressions.filter((s) => s.active).length ?? 0
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{role}</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">{copy.kit.loading}</p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">{t.contactUnavailable}</p>
      ) : (
        <Link href={`${base}/contacts/${encodeURIComponent(id)}`} className="w-fit font-semibold text-foreground underline-offset-4 hover:underline">
          {name}
        </Link>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {consent && (
        <p className="text-xs text-muted-foreground">
          {fill(t.consentCounts, {
            consents: formatNumber(consent.consents.length, locale),
            suppressions: formatNumber(activeSuppressions, locale),
          })}
        </p>
      )}
      {consentFailed && <p className="text-xs text-muted-foreground">{t.consentUnavailable}</p>}
    </div>
  )
}

function ConfirmMerge({
  open,
  onOpenChange,
  pending,
  primaryName,
  duplicateName,
  onConfirm,
  copy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  primaryName: string
  duplicateName: string
  onConfirm: () => void
  copy: CrmWorkspaceCopy
}) {
  const t = copy.merges
  const checkId = useId()
  const [acknowledged, setAcknowledged] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        if (!next) setAcknowledged(false)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.confirmTitle}</DialogTitle>
          <DialogDescription>{fill(t.confirmBody, { primary: primaryName, duplicate: duplicateName })}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3">
          <input
            id={checkId}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <label htmlFor={checkId} className="text-sm leading-relaxed text-foreground">
            {t.confirmCheck}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {copy.kit.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={!acknowledged || pending}>
            <Check className="size-4" aria-hidden="true" />
            {pending ? t.merging : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
