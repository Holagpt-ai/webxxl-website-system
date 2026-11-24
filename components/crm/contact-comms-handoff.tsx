'use client'

import Link from 'next/link'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useComms } from '@/lib/comms-ui/use-comms'
import { COMMS_API, type CrmContactCommsHandoff } from '@/lib/comms-ui/types'
import { Facts, LoadingRows, Section, StatusPill, WorkspaceState } from './workspace-kit'

type Props = { accountId: string; contactId: string; copy: CrmWorkspaceCopy; communicationsHref: string }

export function ContactCommsHandoff({ accountId, contactId, copy, communicationsHref }: Props) {
  const h = copy.contact.handoff
  const handoff = useComms<CrmContactCommsHandoff>(COMMS_API.contactHandoff(contactId), accountId)

  const presence = (present: boolean) => (
    <StatusPill label={present ? h.present : h.missing} tone={present ? 'success' : 'muted'} />
  )
  const toggle = (on: boolean) => <StatusPill label={on ? h.on : h.off} tone={on ? 'info' : 'muted'} />

  return (
    <Section title={h.title} description={h.body}>
      {handoff.isLoading ? (
        <LoadingRows label={copy.kit.loading} rows={3} />
      ) : handoff.error || !handoff.data ? (
        <WorkspaceState error={handoff.error} kit={copy.kit} workspace={copy.name} compact />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <Facts
            items={[
              [h.delivery, <StatusPill key="d" label={h.blocked} tone="neutral" />],
              [h.channels, handoff.data.supportedChannels.join(', ') || h.none],
              [h.email, presence(handoff.data.identitiesPresent.email)],
              [h.phone, presence(handoff.data.identitiesPresent.phone)],
              [h.whatsapp, presence(handoff.data.identitiesPresent.whatsapp)],
              [h.gates, toggle(handoff.data.integrationGatesEnabled)],
              [h.outbound, toggle(handoff.data.outboundModuleEnabled)],
            ]}
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{h.limitations}</p>
            {handoff.data.limitations.length ? (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-foreground">
                {handoff.data.limitations.map((item) => (
                  <li key={item} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground">{h.none}</p>
            )}
          </div>
          <Link
            href={communicationsHref}
            className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {h.readiness}
          </Link>
        </div>
      )}
    </Section>
  )
}
