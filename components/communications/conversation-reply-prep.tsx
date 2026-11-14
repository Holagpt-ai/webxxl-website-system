'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Facts, LoadingRows, Section, StatusPill, UnavailableAction } from '@/components/crm/workspace-kit'
import { CRM_API, type CrmTimelineEvent } from '@/lib/crm-ui/types'
import { fill, formatDateTime, newIdempotencyKey, workspaceSend } from '@/lib/crm-ui/workspace'
import { useComms } from '@/lib/comms-ui/use-comms'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { COMMS_API, type ConversationReplyContext } from '@/lib/comms-ui/types'
import type { CommsViewProps } from '@/lib/comms-ui/server'

type Props = CommsViewProps & {
  conversationId: string
  crmContactId: string | null
}

export function ConversationReplyPrep({ accountId, locale, copy, conversationId, crmContactId, crmContactsBase }: Props) {
  const url = COMMS_API.replyPreparation(conversationId)
  const contextRes = useComms<{ context: ConversationReplyContext }>(url, accountId)
  const timelineRes = useWorkspace<{ events: CrmTimelineEvent[] }>(
    crmContactId ? CRM_API.timeline(crmContactId) : null,
    accountId,
  )
  const [pending, setPending] = useState(false)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const r = copy.replyPrep

  if (contextRes.isLoading && !contextRes.data) {
    return (
      <Section title={r.title}>
        <LoadingRows label={copy.kit.loading} rows={3} />
      </Section>
    )
  }

  if (contextRes.error) {
    return null
  }

  const ctx = contextRes.data?.context
  if (!ctx) return null

  const prepare = async () => {
    setPending(true)
    setErrorDetail(null)
    const key = newIdempotencyKey()
    const result = await workspaceSend<{ intent: { intentId: string; status: string; policyDecision: string } }>(url, {
      idempotencyKey: key,
      contentVersion: 'comms-reply-v0',
      recipientAddress: ctx.recipientAddress ?? undefined,
    })
    setPending(false)
    if (!result.ok) {
      setErrorDetail(result.error.detail ?? result.error.code ?? null)
      return
    }
    setIntentId(result.data.intent.intentId)
    await contextRes.mutate()
  }

  return (
  <div className="flex flex-col gap-6">
    <Section title={r.title} description={r.description}>
      <div className="flex flex-col gap-4">
        <UnavailableAction label={r.sendBlocked} reason={r.sendBlockedReason} />
        <Facts
          items={[
            [r.channel, ctx.channel],
            [r.consentChannel, ctx.consentChannel ?? r.notMappable],
            [r.recipient, ctx.recipientAddress ?? r.noRecipient],
            [
              r.consentQuote,
              ctx.quote
                ? fill(r.quoteLine, {
                    eligible: String(ctx.quote.eligibleCount),
                    suppressed: String(ctx.quote.suppressedCount),
                    unknown: String(ctx.quote.unknownConsentCount),
                    decision: ctx.quote.policyDecision,
                  })
                : r.noQuote,
            ],
          ]}
        />
        {ctx.crmContactId && (
          <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`${crmContactsBase}/${encodeURIComponent(ctx.crmContactId)}/consent`}>
            {r.openConsent}
          </Link>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || !ctx.consentChannel || !ctx.crmContactId}
            onClick={() => void prepare()}
          >
            {pending ? r.preparing : r.prepare}
          </Button>
          {intentId && (
            <p className="text-sm text-muted-foreground">{fill(r.preparedIntent, { id: intentId.slice(0, 8) })}</p>
          )}
        </div>
        {errorDetail && <p className="text-sm text-destructive">{errorDetail}</p>}
      </div>
    </Section>

    <Section title={r.historyTitle} description={r.historyBody}>
      {!crmContactId ? (
        <p className="text-sm text-muted-foreground">{copy.detail.noContact}</p>
      ) : timelineRes.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={3} />
      ) : timelineRes.error ? (
        <p className="text-sm text-muted-foreground">{r.timelineUnavailable}</p>
      ) : !timelineRes.data?.events.length ? (
        <p className="text-sm text-muted-foreground">{r.timelineEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {timelineRes.data.events.slice(0, 8).map((event) => (
            <li key={event.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={event.eventKind} tone="muted" />
                <span className="text-xs text-muted-foreground">{formatDateTime(event.eventAt, locale)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{event.sourceSystem}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>

    {ctx.recentIntents.length > 0 && (
      <Section title={r.intentsTitle}>
        <ul className="flex flex-col divide-y divide-border">
          {ctx.recentIntents.map((intent) => (
            <li key={intent.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-mono text-xs">{intent.id.slice(0, 10)}…</span>
              <StatusPill label={intent.status} tone="info" />
              <span className="text-xs text-muted-foreground">{formatDateTime(intent.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      </Section>
    )}
  </div>
  )
}