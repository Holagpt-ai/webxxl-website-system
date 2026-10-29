'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Mail, MessageSquare, MessageSquareText, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, formatDate, formatDateTime, isGateError, workspaceSend } from '@/lib/crm-ui/workspace'
import { CRM_API, contactName, type CrmContact, type CrmTimelineEvent } from '@/lib/crm-ui/types'
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
} from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string; contactId: string }

export function CrmContactDetail({ accountId, locale, copy, base, contactId }: Props) {
  const contact = useWorkspace<{ contact: CrmContact }>(CRM_API.contact(contactId), accountId)
  const timeline = useWorkspace<{ events: CrmTimelineEvent[] }>(CRM_API.timeline(contactId), accountId)
  const t = copy.contact
  const kit = copy.kit

  const back = (
    <Link
      href={`${base}/contacts`}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t.back}
    </Link>
  )

  if (contact.isLoading) {
    return (
      <>
        {back}
        <LoadingRows label={kit.loading} rows={4} />
      </>
    )
  }

  if (contact.error || !contact.data) {
    return (
      <>
        {back}
        <WorkspaceState
          error={contact.error}
          kit={kit}
          workspace={copy.name}
          onRetry={isGateError(contact.error) ? undefined : () => contact.mutate()}
        />
      </>
    )
  }

  const c = contact.data.contact
  const f = copy.fields

  return (
    <div className="flex flex-col gap-6">
      <div>
        {back}
        <SectionHeading title={contactName(c, f.unnamed)} description={c.jobTitle ?? undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title={t.profile}>
            <Facts
              items={[
                [f.givenName, c.givenName ?? DASH],
                [f.familyName, c.familyName ?? DASH],
                [f.preferredName, c.preferredName ?? DASH],
                [f.jobTitle, c.jobTitle ?? DASH],
                [f.company, c.organizationName ?? DASH],
                [f.leadSource, c.leadSource ?? DASH],
                [f.city, c.city ?? DASH],
                [f.locale, c.locale],
                [f.lastActivity, formatDateTime(c.lastActivityAt, locale)],
                [f.created, formatDate(c.createdAt, locale)],
              ]}
            />
          </Section>

          <EditContactForm contact={c} copy={copy} onSaved={() => contact.mutate()} />

          <Section title={t.timeline} description={t.timelineHint}>
            {timeline.isLoading ? (
              <LoadingRows label={kit.loading} />
            ) : timeline.error ? (
              <WorkspaceState error={timeline.error} kit={kit} workspace={copy.name} compact onRetry={() => timeline.mutate()} />
            ) : !timeline.data?.events.length ? (
              <EmptyNote>{t.timelineEmpty}</EmptyNote>
            ) : (
              <ol className="flex flex-col gap-0 border-l pl-5">
                {timeline.data.events.map((event) => (
                  <li key={event.id} className="relative pb-5 last:pb-0">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
                    <p className="font-medium text-foreground">{enumLabel(copy.enums.timeline, event.eventKind)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.eventAt, locale)}
                      {event.channel ? ` · ${event.channel}` : ''}
                      {event.disposition ? ` · ${event.disposition}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title={t.channels}>
            {!c.channelIdentities?.length ? (
              <EmptyNote>{t.channelsEmpty}</EmptyNote>
            ) : (
              <ul className="flex flex-col divide-y">
                {c.channelIdentities.map((ch) => (
                  <li key={ch.id} className="flex flex-col gap-1 py-3">
                    <span className="break-all font-medium text-foreground">{ch.displayValue}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {enumLabel(copy.enums.identityType, ch.identityType)}
                      {ch.isPrimary && <StatusPill label={t.primary} tone="info" />}
                      <span>
                        {t.verification}: {enumLabel({}, ch.verificationState)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t.actionsTitle}>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled aria-describedby="crm-actions-reason">
                <MessageSquare className="size-4" aria-hidden="true" />
                {t.actions.chat}
              </Button>
              <Button variant="outline" size="sm" disabled aria-describedby="crm-actions-reason">
                <MessageSquareText className="size-4" aria-hidden="true" />
                {t.actions.sms}
              </Button>
              <Button variant="outline" size="sm" disabled aria-describedby="crm-actions-reason">
                <Mail className="size-4" aria-hidden="true" />
                {t.actions.email}
              </Button>
              <Button variant="outline" size="sm" disabled aria-describedby="crm-actions-reason">
                <Phone className="size-4" aria-hidden="true" />
                {t.actions.call}
              </Button>
            </div>
            <p id="crm-actions-reason" className="text-xs leading-relaxed text-muted-foreground">
              {t.actionsReason}
            </p>
          </Section>

          <Section title={t.consentTitle}>
            <GapNotice title={copy.kit.notAvailable} body={t.consentBody} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function EditContactForm({ contact, copy, onSaved }: { contact: CrmContact; copy: CrmWorkspaceCopy; onSaved: () => void }) {
  const [givenName, setGivenName] = useState(contact.givenName ?? '')
  const [familyName, setFamilyName] = useState(contact.familyName ?? '')
  const [preferredName, setPreferredName] = useState(contact.preferredName ?? '')
  const [jobTitle, setJobTitle] = useState(contact.jobTitle ?? '')
  const action = useAction<{ id: string }>()
  const f = copy.fields

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = await action.run(() =>
      workspaceSend(
        CRM_API.contact(contact.id),
        { givenName: givenName.trim(), familyName: familyName.trim(), preferredName: preferredName.trim(), jobTitle: jobTitle.trim() },
        'PATCH',
      ),
    )
    if (result.ok) onSaved()
  }

  return (
    <Section title={copy.contact.edit} description={copy.contact.editHint}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={f.givenName} value={givenName} onChange={setGivenName} />
          <TextField label={f.familyName} value={familyName} onChange={setFamilyName} />
          <TextField label={f.preferredName} value={preferredName} onChange={setPreferredName} />
          <TextField label={f.jobTitle} value={jobTitle} onChange={setJobTitle} />
        </div>
        {action.error && <WorkspaceState error={action.error} kit={copy.kit} workspace={copy.name} compact />}
        {action.data && <SuccessNote>{copy.contact.updated}</SuccessNote>}
        <FormActions>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? copy.kit.saving : copy.kit.save}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
