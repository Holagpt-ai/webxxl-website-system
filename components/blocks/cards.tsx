import Image from 'next/image'
import { ArrowRight, Check, CircleAlert, Clock } from 'lucide-react'
import type { CaseStudy } from '@/content/case-studies'
import type { BlogPost } from '@/content/blog'
import { getCategory } from '@/content/blog'
import type { Industry } from '@/content/industries'
import { getIndustry } from '@/content/industries'
import type { Service } from '@/content/services'
import type { ContentItem, FeatureItem } from '@/content/types'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Icon, IconTile, LocaleLink } from '@/components/site/primitives'

const cardBase = 'group relative flex flex-col rounded-2xl border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated'

export function ServiceCard({ service, locale, compact = false }: { service: Service; locale: Locale; compact?: boolean }) {
  return (
    <LocaleLink
      locale={locale}
      href={routes.service(service.slug)}
      className={cn(cardBase, compact ? 'items-center gap-3 p-5 text-center' : 'gap-4 p-6')}
    >
      <IconTile name={service.icon} size={compact ? 'lg' : 'md'} className={compact ? 'rounded-full' : undefined} />
      <span className="flex flex-col gap-1.5">
        <span className="font-bold">{t(service.name, locale)}</span>
        <span className="text-sm leading-relaxed text-muted-foreground">{t(service.shortDescription, locale)}</span>
      </span>
      {!compact && (
        <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
          {getDictionary(locale).common.learnMore}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </LocaleLink>
  )
}

export function IndustryCard({ industry, locale, variant = 'tile' }: { industry: Industry; locale: Locale; variant?: 'tile' | 'row' }) {
  if (variant === 'row') {
    return (
      <LocaleLink locale={locale} href={routes.industry(industry.slug)} className={cn(cardBase, 'flex-row items-start gap-4 p-5')}>
        <IconTile name={industry.icon} />
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-bold">{t(industry.name, locale)}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{t(industry.tagline, locale)}</span>
        </span>
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
      </LocaleLink>
    )
  }
  return (
    <LocaleLink
      locale={locale}
      href={routes.industry(industry.slug)}
      className={cn(cardBase, 'items-center justify-between gap-3 px-3 py-5 text-center')}
    >
      <Icon name={industry.icon} className="size-7 text-primary" />
      <span className="text-balance text-sm font-semibold leading-snug">{t(industry.name, locale)}</span>
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowRight className="size-3" aria-hidden="true" />
      </span>
    </LocaleLink>
  )
}

export function CaseStudyCard({ study, locale }: { study: CaseStudy; locale: Locale }) {
  const dict = getDictionary(locale)
  const industry = getIndustry(study.industry)
  return (
    <LocaleLink locale={locale} href={routes.caseStudy(study.slug)} className={cn(cardBase, 'overflow-hidden')}>
      <span className="relative block aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={study.image}
          alt={t(study.imageAlt, locale)}
          fill
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {industry && (
            <span className="inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground">
              <Icon name={industry.icon} className="size-3 text-primary" />
              {t(industry.name, locale)}
            </span>
          )}
          {study.isExample && (
            <span className="rounded-full bg-inverse/85 px-2.5 py-1 text-xs font-semibold text-inverse-foreground">{dict.common.exampleBadge}</span>
          )}
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-3 p-5">
        <span className="flex flex-col gap-1">
          <span className="text-lg font-bold">{study.company}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{t(study.summary, locale)}</span>
        </span>
        <span className="mt-auto grid grid-cols-3 gap-2 border-t pt-4">
          {study.metrics.slice(0, 3).map((m) => (
            <span key={m.label.en} className="flex flex-col">
              <span className="text-lg font-extrabold text-primary">{m.value}</span>
              <span className="text-xs leading-snug text-muted-foreground">{t(m.label, locale)}</span>
            </span>
          ))}
        </span>
      </span>
    </LocaleLink>
  )
}

export function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))
}

export function PostCard({ post, locale }: { post: BlogPost; locale: Locale }) {
  const dict = getDictionary(locale)
  const category = getCategory(post.category)
  return (
    <LocaleLink locale={locale} href={routes.post(post.slug)} className={cn(cardBase, 'gap-4 p-6')}>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        {category ? t(category.name, locale) : null}
        {post.isSample && <span className="rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal text-muted-foreground">{dict.common.sampleContent}</span>}
      </span>
      <span className="text-balance text-xl font-bold leading-snug">{t(post.title, locale)}</span>
      <span className="text-pretty leading-relaxed text-muted-foreground">{t(post.excerpt, locale)}</span>
      <span className="mt-auto flex items-center gap-3 pt-2 text-sm text-muted-foreground">
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          {post.readingMinutes} {dict.common.minRead}
        </span>
      </span>
    </LocaleLink>
  )
}

export function FeatureGrid({ items, locale, columns = 3 }: { items: FeatureItem[]; locale: Locale; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns]
  return (
    <ul className={cn('grid gap-4', cols)}>
      {items.map((item) => (
        <li key={item.title.en} className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-card">
          <IconTile name={item.icon} />
          <h3 className="font-bold">{t(item.title, locale)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(item.description, locale)}</p>
        </li>
      ))}
    </ul>
  )
}

export function ItemList({ items, locale, marker = 'check' }: { items: ContentItem[]; locale: Locale; marker?: 'check' | 'dot' }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title.en} className="flex gap-4 rounded-2xl border bg-card p-5">
          <span
            className={cn(
              'mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full',
              marker === 'check' ? 'bg-primary text-primary-foreground' : 'bg-destructive/10 text-destructive',
            )}
          >
            {marker === 'check' ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <CircleAlert className="size-3.5" aria-hidden="true" />}
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-bold">{t(item.title, locale)}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{t(item.description, locale)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ProcessSteps({ items, locale }: { items: ContentItem[]; locale: Locale }) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <li key={item.title.en} className="relative flex flex-col gap-3 rounded-2xl border bg-card p-6">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
          <h3 className="font-bold">{t(item.title, locale)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(item.description, locale)}</p>
        </li>
      ))}
    </ol>
  )
}
