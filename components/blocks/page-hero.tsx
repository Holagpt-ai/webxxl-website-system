import { Check } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Container, Pill } from '@/components/site/primitives'
import { Breadcrumbs, type Crumb } from './breadcrumbs'

export function PageHero({
  locale,
  crumbs,
  eyebrow,
  title,
  description,
  actions,
  trust,
  visual,
  className,
}: {
  locale: Locale
  crumbs: Crumb[]
  eyebrow?: string
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
  trust?: string[]
  visual?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-grid relative overflow-hidden border-b', className)}>
      <Container className={cn('grid gap-12 py-12 md:py-16', visual && 'lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20')}>
        <div className="flex max-w-2xl flex-col gap-6">
          <Breadcrumbs locale={locale} items={crumbs} />
          {eyebrow && <Pill className="self-start">{eyebrow}</Pill>}
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">{title}</h1>
          {description && <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">{description}</p>}
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          {trust && trust.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {trust.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        {visual && <div className="relative">{visual}</div>}
      </Container>
    </section>
  )
}
