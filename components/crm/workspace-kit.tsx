'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId } from 'react'
import {
  AlertCircle,
  Ban,
  Clock,
  FileQuestion,
  Gauge,
  Lock,
  LogIn,
  PauseCircle,
  PlugZap,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyNote, LoadingRows, Section, StatusPill, TableFrame, td, th, type PillTone } from '@/components/commerce/ui'
import {
  fill,
  type ManagedSiteOption,
  type WorkspaceError,
  type WorkspaceKitCopy,
  type WorkspaceStateKind,
} from '@/lib/crm-ui/workspace'
import { cn } from '@/lib/utils'

export { EmptyNote, LoadingRows, Section, StatusPill, TableFrame, td, th }
export type { PillTone }

const STATE_ICONS: Record<WorkspaceStateKind, typeof AlertCircle> = {
  DISABLED: PauseCircle,
  POLICY_UNRESOLVED: ShieldAlert,
  NOT_CONFIGURED: Ban,
  PENDING_PILOT: Clock,
  FORBIDDEN: Lock,
  NOT_FOUND: FileQuestion,
  UNAUTHORIZED: LogIn,
  QUOTA_EXCEEDED: Gauge,
  VALIDATION: AlertCircle,
  ERROR: AlertCircle,
}

/** Renders one non-data state. `body` overrides the default body for a region-specific flag. */
export function WorkspaceState({
  error,
  kind,
  kit,
  workspace,
  body,
  compact,
  onRetry,
}: {
  error?: WorkspaceError | null
  kind?: WorkspaceStateKind
  kit: WorkspaceKitCopy
  workspace: string
  body?: string
  compact?: boolean
  onRetry?: () => void
}) {
  const resolved = kind ?? error?.kind ?? 'ERROR'
  const state = kit.states[resolved]
  const Icon = STATE_ICONS[resolved]
  // Validation and server errors are the only ones where the API's own message adds information.
  const detail = (resolved === 'ERROR' || resolved === 'VALIDATION') && error?.detail ? error.detail : null
  const text = fill(body ?? state.body, { workspace })
  const retry = resolved === 'ERROR' && onRetry

  if (compact) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">{fill(state.title, { workspace })}.</span> {text}
          {detail && <span className="mt-1 block font-mono text-xs">{detail}</span>}
        </span>
      </p>
    )
  }

  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{fill(state.title, { workspace })}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      {retry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {kit.retry}
        </Button>
      )}
    </div>
  )
}

/** Provider-not-connected state: data never arrived, which is different from an empty list. */
export function DisconnectedState({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-muted p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <PlugZap className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

/** The workspace's single FREE badge plus the fair-use line. */
export function WorkspaceIntro({ kit, workspace }: { kit: WorkspaceKitCopy; workspace: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wide text-primary-foreground"
        aria-label={fill(kit.freeBadgeLabel, { workspace })}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        {kit.freeBadge}
      </span>
      <p className="text-xs leading-relaxed text-muted-foreground">{kit.fairUse}</p>
    </div>
  )
}

export type SubnavItem = { href: string; label: string; exact?: boolean }

/** Horizontally scrollable on phones so every screen stays reachable; keeps `?site=` across screens. */
export function WorkspaceSubnav({ items, label, keepParams = [] }: { items: SubnavItem[]; label: string; keepParams?: string[] }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const kept = new URLSearchParams()
  for (const key of keepParams) {
    const value = search.get(key)
    if (value) kept.set(key, value)
  }
  const suffix = kept.toString() ? `?${kept.toString()}` : ''

  return (
    <nav aria-label={label} className="-mx-4 mb-8 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href}>
              <Link
                href={`${item.href}${suffix}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Authorized managed sites come from the server page, independent of any disabled SEO API. */
export function SiteSelector({ sites, selectedId, label }: { sites: ManagedSiteOption[]; selectedId: string; label: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <select
        id={id}
        value={selectedId}
        onChange={(e) => {
          const next = new URLSearchParams(search.toString())
          next.set('site', e.target.value)
          router.replace(`${pathname}?${next.toString()}`)
        }}
        className={selectClass}
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.domain ? `${site.name} (${site.domain})` : site.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-56'

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  id: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  const id = useId()
  return (
    <Field id={id} label={label} hint={hint}>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  required,
  rows = 4,
  mono,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  required?: boolean
  rows?: number
  mono?: boolean
}) {
  const id = useId()
  return (
    <Field id={id} label={label} hint={hint}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(mono && 'font-mono text-xs')}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <Field id={id} label={label} hint={hint}>
      <select
        id={id}
        value={value}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectClass, 'sm:w-full')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** A control the product plans but the API does not support yet. Always disabled, always explained. */
export function UnavailableAction({ label, reason, icon: Icon }: { label: string; reason: string; icon?: typeof AlertCircle }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" disabled aria-describedby={id} className="justify-start">
        {Icon && <Icon className="size-4" aria-hidden="true" />}
        {label}
      </Button>
      <p id={id} className="text-xs leading-relaxed text-muted-foreground">
        {reason}
      </p>
    </div>
  )
}

export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{term}</dt>
          <dd className="break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Inline gap notice used for honest "this has no API yet" explanations. */
export function GapNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
      <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{title}.</span> {body}
      </p>
    </div>
  )
}

export function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-lg border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
      {children}
    </p>
  )
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>
}

export function PlainTable({
  label,
  headers,
  children,
}: {
  label: string
  headers: string[]
  children: React.ReactNode
}) {
  return (
    <TableFrame label={label}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col" className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </TableFrame>
  )
}

/** Shows a JSON value readably without inventing structure. */
export function JsonBlock({ value, label }: { value: unknown; label: string }) {
  if (value === null || value === undefined) return null
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      className="max-h-96 overflow-auto rounded-lg border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
