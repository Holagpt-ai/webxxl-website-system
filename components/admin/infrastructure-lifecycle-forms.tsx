'use client'

import { useTransition } from 'react'
import {
  adminUpdateDomainLifecycleAction,
  adminUpdateEmailLifecycleAction,
  adminUpdateHostingLifecycleAction,
} from '@/lib/infrastructure/admin-actions'
import { enumLabel } from '@/lib/i18n/labels'

const HOSTING_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'CANCELLED', 'UNKNOWN'] as const
const DOMAIN_VERIFICATION = ['UNVERIFIED', 'PENDING', 'VERIFIED'] as const
const DOMAIN_RENEWAL = ['UNKNOWN', 'AUTO', 'MANUAL', 'PENDING', 'EXPIRED'] as const
const EMAIL_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'CANCELLED', 'UNKNOWN'] as const

export function HostingLifecycleForm({
  hostingId,
  currentStatus,
  labels,
}: {
  hostingId: string
  currentStatus: string
  labels: { statusUpdate: string; save: string; hostingStatuses: Record<string, string> }
}) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => startTransition(() => void adminUpdateHostingLifecycleAction(fd))}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="hostingId" value={hostingId} />
      <select
        name="status"
        defaultValue={currentStatus}
        className="rounded-md border bg-background px-2 py-1 text-xs"
        disabled={pending}
      >
        {HOSTING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {enumLabel(labels.hostingStatuses, s)}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-medium text-primary underline" disabled={pending}>
        {labels.save}
      </button>
    </form>
  )
}

export function DomainLifecycleForm({
  domainId,
  verificationStatus,
  renewalStatus,
  labels,
}: {
  domainId: string
  verificationStatus: string
  renewalStatus: string
  labels: {
    save: string
    domainVerificationStatuses: Record<string, string>
    domainRenewalStatuses: Record<string, string>
  }
}) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => startTransition(() => void adminUpdateDomainLifecycleAction(fd))}
      className="flex flex-col gap-1 text-xs"
    >
      <input type="hidden" name="domainId" value={domainId} />
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Verification</span>
        <select name="verificationStatus" defaultValue={verificationStatus} className="rounded-md border px-2 py-1" disabled={pending}>
          {DOMAIN_VERIFICATION.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.domainVerificationStatuses, s)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Renewal</span>
        <select name="renewalStatus" defaultValue={renewalStatus} className="rounded-md border px-2 py-1" disabled={pending}>
          {DOMAIN_RENEWAL.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.domainRenewalStatuses, s)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="self-start text-primary underline" disabled={pending}>
        {labels.save}
      </button>
    </form>
  )
}

export function EmailLifecycleForm({
  emailId,
  currentStatus,
  labels,
}: {
  emailId: string
  currentStatus: string
  labels: { save: string; emailStatuses: Record<string, string> }
}) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={(fd) => startTransition(() => void adminUpdateEmailLifecycleAction(fd))}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="emailId" value={emailId} />
      <select name="status" defaultValue={currentStatus} className="rounded-md border px-2 py-1 text-xs" disabled={pending}>
        {EMAIL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {enumLabel(labels.emailStatuses, s)}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs text-primary underline" disabled={pending}>
        {labels.save}
      </button>
    </form>
  )
}