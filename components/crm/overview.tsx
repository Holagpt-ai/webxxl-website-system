'use client'

import Link from 'next/link'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, enumLabel, fill, formatDate, isGateError } from '@/lib/crm-ui/workspace'
import { CRM_API, CRM_PAGE_SIZE, contactName, type CrmCompany, type CrmContact, type CrmDeal, type CrmTask } from '@/lib/crm-ui/types'
import { EmptyNote, LoadingRows, Section, SectionHeading, StatTile, StatusPill, WorkspaceState } from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

const OPEN_TASK = new Set(['OPEN', 'IN_PROGRESS'])

function countLabel(length: number | undefined, locale: string) {
  if (length === undefined) return DASH
  return length >= CRM_PAGE_SIZE ? `${new Intl.NumberFormat(locale).format(CRM_PAGE_SIZE)}+` : new Intl.NumberFormat(locale).format(length)
}

export function CrmOverview({ accountId, locale, copy, base }: Props) {
  const contacts = useWorkspace<{ contacts: CrmContact[] }>(CRM_API.contacts, accountId)
  const companies = useWorkspace<{ companies: CrmCompany[] }>(CRM_API.companies, accountId)
  const deals = useWorkspace<{ deals: CrmDeal[] }>(CRM_API.deals, accountId)
  const tasks = useWorkspace<{ tasks: CrmTask[] }>(CRM_API.tasks, accountId)
  const t = copy.overview
  const kit = copy.kit

  const gate = [contacts.error, companies.error, deals.error, tasks.error].find(isGateError)
  if (gate) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={gate} kit={kit} workspace={copy.name} />
      </>
    )
  }

  const openDeals = deals.data?.deals.filter((d) => d.status === 'OPEN')
  const openTasks = tasks.data?.tasks.filter((task) => OPEN_TASK.has(task.status))
  const hint = fill(t.pageHint, { count: CRM_PAGE_SIZE })

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t.contacts} value={countLabel(contacts.data?.contacts.length, locale)} hint={hint} />
        <StatTile label={t.companies} value={countLabel(companies.data?.companies.length, locale)} hint={hint} />
        <StatTile label={t.openDeals} value={countLabel(openDeals?.length, locale)} hint={hint} />
        <StatTile label={t.openTasks} value={countLabel(openTasks?.length, locale)} hint={hint} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title={t.recentContacts}
          action={
            <Link href={`${base}/contacts`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t.viewAll}
            </Link>
          }
        >
          {contacts.isLoading ? (
            <LoadingRows label={kit.loading} />
          ) : contacts.error ? (
            <WorkspaceState error={contacts.error} kit={kit} workspace={copy.name} compact onRetry={() => contacts.mutate()} />
          ) : !contacts.data?.contacts.length ? (
            <EmptyNote>{t.emptyContacts}</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y">
              {contacts.data.contacts.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`${base}/contacts/${c.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {contactName(c, copy.fields.unnamed)}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDate(c.updatedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={t.upcomingTasks}
          action={
            <Link href={`${base}/tasks`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t.viewAll}
            </Link>
          }
        >
          {tasks.isLoading ? (
            <LoadingRows label={kit.loading} />
          ) : tasks.error ? (
            <WorkspaceState error={tasks.error} kit={kit} workspace={copy.name} compact onRetry={() => tasks.mutate()} />
          ) : !openTasks?.length ? (
            <EmptyNote>{t.emptyTasks}</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y">
              {openTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-foreground">{task.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusPill label={enumLabel(copy.enums.taskPriority, task.priority)} tone={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'danger' : 'muted'} />
                    {task.dueAt ? formatDate(task.dueAt, locale) : copy.tasks.noDue}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
