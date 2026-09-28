import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Info } from 'lucide-react'
import { getCaseStudies, getCaseStudy } from '@/content/case-studies'
import { getIndustry } from '@/content/industries'
import { getServicesBySlugs } from '@/content/services'
import { localeCodes } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { Container, IconTile, LocaleLink, Pill, Section } from '@/components/site/primitives'
import { Breadcrumbs } from '@/components/blocks/breadcrumbs'
import { CaseStudyCard } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return localeCodes.flatMap((locale) => getCaseStudies().map((s) => ({ locale, slug: s.slug })))
}

async function load(params: Props['params']) {
  const locale = await resolveLocale(params)
  const { slug } = await params
  const study = getCaseStudy(slug)
  if (!study) notFound()
  return { locale, study }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, study } = await load(params)
  return buildMetadata({
    locale,
    path: routes.caseStudy(study.slug),
    title: study.company,
    description: t(study.summary, locale),
    image: study.image,
  })
}

export default async function CaseStudyPage({ params }: Props) {
  const { locale, study } = await load(params)
  const dict = getDictionary(locale)
  const industry = getIndustry(study.industry)
  const services = getServicesBySlugs(study.services)
  const others = getCaseStudies().filter((s) => s.slug !== study.slug).slice(0, 3)
  const story = [
    { label: dict.caseStudy.challenge, body: t(study.challenge, locale) },
    { label: dict.caseStudy.approach, body: t(study.approach, locale) },
    { label: dict.caseStudy.solution, body: t(study.solution, locale) },
  ]

  return (
    <>
      <section className="bg-grid border-b">
        <Container className="flex flex-col gap-6 py-12 md:py-16">
          <Breadcrumbs
            locale={locale}
            items={[
              { label: dict.nav.caseStudies, href: '/case-studies' },
              { label: study.company, href: routes.caseStudy(study.slug) },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {industry && <Pill>{t(industry.name, locale)}</Pill>}
            {study.isExample && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-foreground">
                {dict.common.exampleBadge}
              </span>
            )}
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{study.company}</h1>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{t(study.summary, locale)}</p>
        </Container>
      </section>

      <Container className="py-10">
        <div className="relative aspect-[16/7] overflow-hidden rounded-2xl border bg-muted">
          <Image src={study.image} alt={t(study.imageAlt, locale)} fill priority sizes="(min-width: 1280px) 1216px, 100vw" className="object-cover" />
        </div>
      </Container>

      {study.isExample && (
        <Container>
          <p className="flex items-start gap-3 rounded-xl border bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {dict.caseStudy.exampleNotice}
          </p>
        </Container>
      )}

      <Section labelledBy="case-story-title">
        <h2 id="case-story-title" className="sr-only">
          {study.company}
        </h2>
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-10">
            {story.map((part) => (
              <div key={part.label} className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">{part.label}</h3>
                <p className="text-pretty text-lg leading-relaxed">{part.body}</p>
              </div>
            ))}
          </div>
          <aside className="flex flex-col gap-6 self-start rounded-2xl border bg-card p-6">
            <dl className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">{dict.caseStudy.projectType}</dt>
                <dd className="font-semibold">{t(study.projectType, locale)}</dd>
              </div>
              {industry && (
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">{dict.caseStudy.industry}</dt>
                  <dd>
                    <LocaleLink locale={locale} href={routes.industry(industry.slug)} className="font-semibold text-primary hover:underline">
                      {t(industry.name, locale)}
                    </LocaleLink>
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm text-muted-foreground">{dict.caseStudy.servicesUsed}</h3>
              <ul className="flex flex-col gap-2">
                {services.map((service) => (
                  <li key={service.slug}>
                    <LocaleLink locale={locale} href={routes.service(service.slug)} className="flex items-center gap-3 text-sm font-semibold hover:text-primary">
                      <IconTile name={service.icon} size="sm" />
                      {t(service.name, locale)}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Section>

      <Section tone="muted" labelledBy="case-results-title">
        <h2 id="case-results-title" className="text-3xl font-bold">
          {dict.caseStudy.results}
        </h2>
        {study.metrics.length > 0 ? (
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {study.metrics.map((metric) => (
              <div key={metric.value + t(metric.label, locale)} className="flex flex-col gap-1 rounded-xl border bg-card p-6">
                <dd className="text-4xl font-extrabold text-primary">{metric.value}</dd>
                <dt className="text-sm text-muted-foreground">{t(metric.label, locale)}</dt>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-muted-foreground">{dict.caseStudy.resultsPending}</p>
        )}
        {study.isExample && <p className="mt-4 text-xs text-muted-foreground">{dict.common.exampleBadge}</p>}
      </Section>

      {others.length > 0 && (
        <Section labelledBy="more-cases-title">
          <h2 id="more-cases-title" className="text-2xl font-bold">
            {dict.sections.relatedEyebrow}
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {others.map((s) => (
              <li key={s.slug} className="flex">
                <CaseStudyCard study={s} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <CtaBand locale={locale} />
    </>
  )
}
