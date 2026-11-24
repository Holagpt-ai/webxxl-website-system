'use client'

import {
  EmptyNote,
  Facts,
  LoadingRows,
  Section,
  StatusPill,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { enumLabel, formatDateTime } from '@/lib/crm-ui/workspace'
import { useComms } from '@/lib/comms-ui/use-comms'
import { COMMS_API, type CommsProviderReadiness } from '@/lib/comms-ui/types'
import type { CommsViewProps } from '@/lib/comms-ui/server'

export function CommsProviderReadinessPanel({ accountId, locale, copy }: Pick<CommsViewProps, 'accountId' | 'locale' | 'copy'>) {
  const r = copy.connections.readiness
  const readiness = useComms<CommsProviderReadiness>(COMMS_API.providerReadiness, accountId)

  const toggle = (on: boolean) => <StatusPill label={on ? r.enabled : r.disabled} tone={on ? 'info' : 'muted'} />

  return (
    <Section title={r.title} description={r.description}>
      {readiness.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={3} />
      ) : readiness.error || !readiness.data ? (
        <WorkspaceState
          error={readiness.error}
          kit={copy.kit}
          workspace={copy.name}
          compact
          onRetry={() => readiness.mutate()}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <Facts
            items={[
              [r.liveDispatch, <StatusPill key="live" label={r.blocked} tone="neutral" />],
              [r.twilio, toggle(readiness.data.messaging.twilioAdapterEnabled)],
              [r.resend, toggle(readiness.data.messaging.resendTransportEnabled)],
              [r.smsSend, toggle(readiness.data.messaging.smsSendEnabled)],
              [r.emailSend, toggle(readiness.data.messaging.emailSendEnabled)],
              [r.assessedAt, formatDateTime(readiness.data.assessedAt, locale)],
            ]}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">{r.sendersTitle}</h3>
            {!readiness.data.messaging.senders.length ? (
              <EmptyNote>{r.sendersEmpty}</EmptyNote>
            ) : (
              <ul className="flex flex-col divide-y">
                {readiness.data.messaging.senders.map((s) => (
                  <li key={s.senderIdentityId} className="flex min-w-0 flex-col gap-1.5 py-3">
                    <span className="break-words font-medium text-foreground">{s.displayName}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {r.channel}: {enumLabel(copy.enums.channel, s.channel)}
                      </span>
                      <span>
                        {r.verification}: {enumLabel(copy.enums.verification, s.verificationState)}
                      </span>
                      <StatusPill
                        label={`${r.dispatch}: ${s.dispatchAllowed ? r.allowed : r.notAllowed}`}
                        tone={s.dispatchAllowed ? 'success' : 'muted'}
                      />
                    </span>
                    {s.blockReason && (
                      <span className="break-words text-xs leading-relaxed text-muted-foreground">{s.blockReason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}
