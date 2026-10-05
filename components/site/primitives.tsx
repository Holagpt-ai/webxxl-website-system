import Link from 'next/link'
import { ArrowRight, Check, Info } from 'lucide-react'
import { icons, type IconName } from '@/lib/icons'
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Cmp = icons[name]
  return <Cmp className={cn('size-5', className)} aria-hidden="true" />
}

export function IconTile({ name, className, size = 'md' }: { name: IconName; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'size-9 rounded-lg', md: 'size-11 rounded-xl', lg: 'size-14 rounded-2xl' }[size]
  const icon = { sm: 'size-4', md: 'size-5', lg: 'size-6' }[size]
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-secondary text-primary', box, className)}>
      <Icon name={name} className={icon} />
    </span>
  )
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

export function Section({
  id,
  className,
  children,
  tone = 'default',
  labelledBy,
}: {
  id?: string
  className?: string
  children: React.ReactNode
  tone?: 'default' | 'muted' | 'inverse'
  labelledBy?: string
}) {
  const tones = {
    default: 'bg-background',
    muted: 'bg-muted',
    inverse: 'bg-inverse text-inverse-foreground',
  }
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('py-16 md:py-24', tones[tone], className)}>
      <Container>{children}</Container>
    </section>
  )
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-xs font-semibold uppercase tracking-widest text-primary', className)}>{children}</p>
}

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  align = 'left',
  as: Heading = 'h2',
  className,
  action,
}: {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  as?: 'h1' | 'h2'
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'items-center text-center md:flex-col md:items-center',
        className,
      )}
    >
      <div className={cn('flex max-w-2xl flex-col gap-3', align === 'center' && 'items-center')}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Heading id={id} className="text-3xl font-bold leading-tight md:text-4xl">
          {title}
        </Heading>
        {description && <p className="text-pretty leading-relaxed text-muted-foreground md:text-lg">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function LocaleLink({
  locale,
  href,
  className,
  children,
  ...rest
}: { locale: Locale; href: string; className?: string; children: React.ReactNode } & Omit<
  React.ComponentProps<typeof Link>,
  'href'
>) {
  return (
    <Link href={localizePath(locale, href)} className={className} {...rest}>
      {children}
    </Link>
  )
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-60'

export const buttonStyles = {
  primary: cn(buttonBase, 'h-11 bg-primary px-5 text-primary-foreground shadow-sm hover:bg-primary/90'),
  outline: cn(buttonBase, 'h-11 border border-primary/30 bg-background px-5 text-primary hover:border-primary hover:bg-secondary'),
  ghost: cn(buttonBase, 'h-11 px-4 text-foreground hover:bg-muted'),
  inverse: cn(buttonBase, 'h-11 bg-background px-5 text-primary hover:bg-secondary'),
  small: cn(buttonBase, 'h-9 bg-primary px-4 text-primary-foreground hover:bg-primary/90'),
}

export function ButtonLink({
  locale,
  href,
  variant = 'primary',
  icon,
  arrow,
  className,
  children,
}: {
  locale: Locale
  href: string
  variant?: keyof typeof buttonStyles
  icon?: IconName
  arrow?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <LocaleLink locale={locale} href={href} className={cn(buttonStyles[variant], className)}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
      {arrow && <ArrowRight className="size-4" aria-hidden="true" />}
    </LocaleLink>
  )
}

export function CheckList({ items, tooltips, className, tone = 'default' }: { items: string[]; tooltips?: Record<string, string>; className?: string; tone?: 'default' | 'inverse' }) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 leading-relaxed">
          <span
            className={cn(
              'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full',
              tone === 'inverse' ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground',
            )}
          >
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
          <span>
            {item}
            {tooltips?.[item] ? <FeatureTip text={tooltips[item]} label={item} /> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Info dot with a hover/tap tooltip that explains a feature in plain language.
 * Pure CSS: appears on hover, keyboard focus, and tap (tap focuses the button).
 */
function FeatureTip({ text, label }: { text: string; label: string }) {
  return (
    <span className="group/tip relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        aria-label={`What does "${label}" include?`}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 max-w-[75vw] rounded-xl border bg-card p-3 text-xs font-normal leading-relaxed text-card-foreground shadow-elevated opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground', className)}>
      {children}
    </span>
  )
}
