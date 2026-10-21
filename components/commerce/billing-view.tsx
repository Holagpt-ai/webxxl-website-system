'use client'

import { useState } from 'react'
import { LifeBuoy, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCommerce } from '@/lib/commerce-ui/client'
import { formatNumber } from '@/lib/commerce-ui/format'
import type { BillingGroupSummaryDto, WalletSummaryDto } from '@/lib/commerce-ui/types'
import type { CommerceCopy } from '@/lib/i18n/dictionaries/commerce-en'
import { PagedOrders } from './marketplace-view'
import { CommerceState, EmptyNote, LoadingRows, Section, StatusPill } from './ui'

export type BillingGroupOption = { id: string; name: string }

const WALLET_ROLES = new Set(['GROUP_OWNER', 'BILLING_ADMIN'])

export function BillingView({
  groups,
  locale,
  copy,
  loginHref,
  supportHref,
}: {
  groups: BillingGroupOption[]
  locale: string
  copy: CommerceCopy
  loginHref: string
  supportHref: string
}) {
  const b = copy.billing
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')

  if (groups.length === 0) {
    return (
      <Section title={b.noGroupsTitle}>
        <EmptyNote>{b.noGroupsBody}</EmptyNote>
      </Section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.length > 1 && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor="billing-group" className="text-sm font-medium text-foreground">
            {b.groupSelect}
          </label>
          <select
            id="billing-group"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-10 rounded-md border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <GroupDetail key={groupId} groupId={groupId} locale={locale} copy={copy} loginHref={loginHref} supportHref={supportHref} />
    </div>
  )
}

function GroupDetail({
  groupId,
  locale,
  copy,
  loginHref,
  supportHref,
}: {
  groupId: string
  locale: string
  copy: CommerceCopy
  loginHref: string
  supportHref: string
}) {
  const b = copy.billing
  const base = `/api/v1/commerce/billing-groups/${encodeURIComponent(groupId)}`
  const summary = useCommerce<BillingGroupSummaryDto>(`${base}/summary`)

  if (summary.error) {
    return <CommerceState error={summary.error} copy={copy} onRetry={() => summary.mutate()} loginHref={loginHref} />
  }
  if (!summary.data) return <LoadingRows label={copy.common.loading} rows={4} />

  const group = summary.data
  const canSeeWallet = group.callerRole !== null && WALLET_ROLES.has(group.callerRole)
  const accountNames = Object.fromEntries(group.memberAccounts.map((a) => [a.customerAccountId, a.businessName]))

  return (
    <>
      <Section id="group" title={group.name}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label={b.yourRole} value={copy.roles[group.callerRole ?? 'OPERATING']} />
          <Fact label={b.groupStatus} value={copy.activationStatuses[group.status] ?? group.status} />
          <Fact label={b.currency} value={group.defaultCurrency} />
        </dl>
      </Section>

      <Section
        id="members"
        title={b.membersTitle}
        description={group.callerRole === 'GROUP_OWNER' || group.callerRole === 'BILLING_ADMIN' ? undefined : b.membersOwnOnly}
      >
        {group.memberAccounts.length === 0 ? (
          <EmptyNote>{b.membersEmpty}</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {group.memberAccounts.map((account) => (
              <li key={account.customerAccountId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{account.businessName}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.walletUse}: {account.walletUseAllowed ? b.walletAllowed : b.walletNotAllowed}
                  </span>
                </span>
                <StatusPill
                  label={copy.fundingStatuses[account.fundingStatus] ?? account.fundingStatus}
                  tone={account.fundingStatus === 'ACTIVE' ? 'success' : account.fundingStatus === 'SUSPENDED' ? 'danger' : 'muted'}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="wallet" title={b.walletTitle}>
        {canSeeWallet ? (
          <WalletPanel url={`${base}/wallet-summary`} locale={locale} copy={copy} loginHref={loginHref} />
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted p-4">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium text-foreground">{b.walletRestrictedTitle}</p>
              <p className="leading-relaxed text-muted-foreground">{b.walletRestrictedBody}</p>
            </div>
          </div>
        )}
      </Section>

      <Section
        id="usage"
        title={b.usageTitle}
        description={b.usageBody}
        action={
          <Button variant="outline" size="sm" render={<a href={supportHref} />}>
            <LifeBuoy className="size-4" aria-hidden="true" />
            {b.usageCta}
          </Button>
        }
      >
        {null}
      </Section>

      <Section id="history" title={b.historyTitle}>
        <PagedOrders
          url={`${base}/orders`}
          copy={copy}
          locale={locale}
          empty={b.historyEmpty}
          loginHref={loginHref}
          accountNames={accountNames}
        />
      </Section>
    </>
  )
}

function WalletPanel({ url, locale, copy, loginHref }: { url: string; locale: string; copy: CommerceCopy; loginHref: string }) {
  const b = copy.billing
  const { data, error, mutate } = useCommerce<WalletSummaryDto>(url)

  if (error) return <CommerceState error={error} copy={copy} onRetry={() => mutate()} loginHref={loginHref} />
  if (!data) return <LoadingRows label={copy.common.loading} rows={1} />

  const reason = data.readDisabledReason ?? (data.walletId === null ? 'NO_WALLET' : null)
  if (reason) {
    return (
      <div className="rounded-lg border border-dashed bg-muted p-4 text-sm">
        <p className="font-medium text-foreground">{b.walletUnavailableTitle}</p>
        <p className="leading-relaxed text-muted-foreground">{b.walletReasons[reason]}</p>
      </div>
    )
  }

  const tiles = [
    { label: b.walletAvailable, hint: b.walletAvailableHint, value: data.availableBalance, primary: true },
    { label: b.walletPosted, hint: b.walletPostedHint, value: data.postedBalance, primary: false },
    { label: b.walletReserved, hint: b.walletReservedHint, value: data.reservedBalance, primary: false },
  ]

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={tile.primary ? 'flex flex-col gap-1 rounded-lg bg-primary p-4 text-primary-foreground' : 'flex flex-col gap-1 rounded-lg border bg-background p-4'}
        >
          <dt className={tile.primary ? 'text-sm font-medium opacity-90' : 'text-sm font-medium text-muted-foreground'}>{tile.label}</dt>
          <dd className="text-2xl font-bold tabular-nums">
            {tile.value === null ? copy.common.notAvailable : formatNumber(tile.value, locale)}
            <span className="ml-1 text-sm font-medium opacity-80">{data.unit || copy.common.credits}</span>
          </dd>
          <dd className={tile.primary ? 'text-xs opacity-80' : 'text-xs text-muted-foreground'}>{tile.hint}</dd>
        </div>
      ))}
    </dl>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  )
}
