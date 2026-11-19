'use client'

import { useState, useTransition } from 'react'
import {
  adminUpdateDomainLifecycleAction,
  adminUpdateEmailLifecycleAction,
  adminUpdateHostingLifecycleAction,
} from '@/lib/infrastructure/admin-actions'
import {
  BUSINESS_EMAIL_STATUS_VALUES,
  DOMAIN_RENEWAL_STATUS_VALUES,
  DOMAIN_VERIFICATION_STATUS_VALUES,
  HOSTING_SERVICE_STATUS_VALUES,
} from '@/lib/infrastructure/lifecycle-enums'
import { enumLabel } from '@/lib/i18n/labels'

type LifecycleLabels = {
  save: string
  lifecycleSaved: string
  lifecycleErrors: Record<string, string>
  hostingStatuses?: Record<string, string>
  domainVerificationStatuses?: Record<string, string>
  domainRenewalStatuses?: Record<string, string>
  emailStatuses?: Record<string, string>
}

function LifecycleFeedback({ message, tone }: { message: string; tone: 'ok' | 'err' }) {
  return (
    <p className={`break-words text-xs ${tone === 'ok' ? 'text-muted-foreground' : 'text-destructive'}`} role="status">
      {message}
    </p>
  )
}

export function HostingLifecycleForm({
  hostingId,
  currentStatus,
  labels,
}: {
  hostingId: string
  currentStatus: string
  labels: LifecycleLabels & { hostingStatuses: Record<string, string> }
}) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await adminUpdateHostingLifecycleAction(fd)
          if (!result.ok) {
            setFeedback({
              tone: 'err',
              text: labels.lifecycleErrors[result.error] ?? labels.lifecycleErrors.unknown,
            })
            return
          }
          setFeedback({ tone: 'ok', text: labels.lifecycleSaved })
        })
      }}
    >
      <input type="hidden" name="hostingId" value={hostingId} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="status"
          defaultValue={currentStatus}
          className="rounded-md border bg-background px-2 py-1 text-xs"
          disabled={pending}
        >
          {HOSTING_SERVICE_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.hostingStatuses, s)}
            </option>
          ))}
        </select>
        <button type="submit" className="text-xs font-medium text-primary underline" disabled={pending}>
          {labels.save}
        </button>
      </div>
      {feedback && <LifecycleFeedback message={feedback.text} tone={feedback.tone} />}
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
  labels: LifecycleLabels & {
    domainVerificationStatuses: Record<string, string>
    domainRenewalStatuses: Record<string, string>
  }
}) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  return (
    <form
      className="flex flex-col gap-1 text-xs"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await adminUpdateDomainLifecycleAction(fd)
          if (!result.ok) {
            setFeedback({
              tone: 'err',
              text: labels.lifecycleErrors[result.error] ?? labels.lifecycleErrors.unknown,
            })
            return
          }
          setFeedback({ tone: 'ok', text: labels.lifecycleSaved })
        })
      }}
    >
      <input type="hidden" name="domainId" value={domainId} />
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Verification</span>
        <select
          name="verificationStatus"
          defaultValue={verificationStatus}
          className="rounded-md border px-2 py-1"
          disabled={pending}
        >
          {DOMAIN_VERIFICATION_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.domainVerificationStatuses, s)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Renewal</span>
        <select name="renewalStatus" defaultValue={renewalStatus} className="rounded-md border px-2 py-1" disabled={pending}>
          {DOMAIN_RENEWAL_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.domainRenewalStatuses, s)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="self-start text-primary underline" disabled={pending}>
        {labels.save}
      </button>
      {feedback && <LifecycleFeedback message={feedback.text} tone={feedback.tone} />}
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
  labels: LifecycleLabels & { emailStatuses: Record<string, string> }
}) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await adminUpdateEmailLifecycleAction(fd)
          if (!result.ok) {
            setFeedback({
              tone: 'err',
              text: labels.lifecycleErrors[result.error] ?? labels.lifecycleErrors.unknown,
            })
            return
          }
          setFeedback({ tone: 'ok', text: labels.lifecycleSaved })
        })
      }}
    >
      <input type="hidden" name="emailId" value={emailId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={currentStatus} className="rounded-md border px-2 py-1 text-xs" disabled={pending}>
          {BUSINESS_EMAIL_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {enumLabel(labels.emailStatuses, s)}
            </option>
          ))}
        </select>
        <button type="submit" className="text-xs text-primary underline" disabled={pending}>
          {labels.save}
        </button>
      </div>
      {feedback && <LifecycleFeedback message={feedback.text} tone={feedback.tone} />}
    </form>
  )
}
