import type { Metadata } from 'next'
import { getPlans } from '@/config/pricing'
import { siteConfig } from '@/config/site'
import { getIndustries, getIndustry } from '@/content/industries'
import { getStartedPage } from '@/content/pages'
import { getServices } from '@/content/services'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { format, t } from '@/lib/i18n/localize'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { buildMetadata } from '@/lib/seo'
import { Container, Eyebrow, LocaleLink } from '@/components/site/primitives'
import { Breadcrumbs } from '@/components/blocks/breadcrumbs'
import { ProjectWizard } from '@/components/forms/project-wizard'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ intent?: string; plan?: string; project?: string; industry?: string }>
}

export async function generateMetadata({ params }: { params: Props['params'] }): Promise<Metadata> {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  return buildMetadata({ locale, path: '/get-started', title: dict.wizard.title, description: dict.wizard.description })
}

const projectPresets: Record<string, number> = { 'new-website': 0, redesign: 1, 'landing-pages': 2, store: 3, crm: 4 }

export default async function GetStartedPage({ params, searchParams }: Props) {
  const { locale, dict } = await getPageContext(params)
  const query = await searchParams
  const presetIndex = query.project ? projectPresets[query.project] : undefined
  const industry = query.industry ? getIndustry(query.industry) : undefined
  const selectedPlan = query.plan ? getPlans().find((p) => p.slug === query.plan) : undefined
  const isQuote = query.intent === 'strategy-call'
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

  const presetHref = (project: string) => {
    const params = new URLSearchParams({ project })
    if (query.intent) params.set('intent', query.intent)
    if (query.plan) params.set('plan', query.plan)
    if (query.industry) params.set('industry', query.industry)
    return `/get-started?${params.toString()}`
  }

  return (
    <section className="bg-grid border-b">
      <Container className="flex flex-col gap-8 py-12 md:py-16">
        <Breadcrumbs locale={locale} items={[{ label: t(getStartedPage.eyebrow, locale), href: '/get-started' }]} />
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow>{t(getStartedPage.eyebrow, locale)}</Eyebrow>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{dict.wizard.title}</h1>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">{dict.wizard.description}</p>
        </div>
        {selectedPlan ? (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">{dict.pricing.selectedPlan}</span>
              <span className="text-lg font-bold">{t(selectedPlan.name, locale)}</span>
              {selectedPlan.priceModel === 'fixed' && selectedPlan.priceMonthly != null ? (
                <span className="text-sm text-muted-foreground">
                  {money(selectedPlan.priceMonthly, selectedPlan.currency)}
                  {dict.pricing.perMonth}
                  {selectedPlan.setupFee ? ` · ${format(dict.pricing.setupFee, { amount: money(selectedPlan.setupFee, selectedPlan.currency) })}` : ''}
                </span>
              ) : null}
            </div>
            <LocaleLink locale={locale} href="/pricing" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
              {dict.pricing.changePlan}
            </LocaleLink>
          </div>
        ) : isQuote ? (
          <div className="flex flex-col gap-1 rounded-2xl border-2 border-primary bg-card p-5">
            <span className="text-lg font-bold">{dict.wizard.quoteRequest}</span>
            <span className="text-pretty text-sm leading-relaxed text-muted-foreground">{dict.wizard.quoteRequestBody}</span>
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">{t(getStartedPage.quizTitle, locale)}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {getStartedPage.quiz.map((q) => (
              <LocaleLink
                key={q.project}
                locale={locale}
                href={presetHref(q.project)}
                aria-current={query.project === q.project ? 'true' : undefined}
                className={`group flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated ${query.project === q.project ? 'border-primary ring-1 ring-primary' : ''}`}
              >
                <span className="font-bold leading-snug group-hover:text-primary">{t(q.title, locale)}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{t(q.description, locale)}</span>
              </LocaleLink>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 gap-8 lg:grid-cols-[2fr_1fr]">
          <ProjectWizard
            key={query.project ?? 'none'}
            locale={locale}
            labels={{ wizard: dict.wizard, forms: dict.forms, common: dict.common }}
            industries={getIndustries().map((i) => t(i.name, locale))}
            services={getServices().map((s) => t(s.name, locale))}
            intent={query.intent}
            plan={query.plan}
            initialProjectType={presetIndex !== undefined ? dict.wizard.projectTypes[presetIndex] : undefined}
            initialIndustry={industry ? t(industry.name, locale) : undefined}
          />
          <aside className="flex flex-col gap-5 self-start rounded-2xl border bg-muted p-6">
            <h2 className="text-lg font-bold">{t(getStartedPage.sideTitle, locale)}</h2>
            <ol className="flex flex-col gap-4">
              {t(getStartedPage.sideSteps, locale).map((stepText, i) => (
                <li key={stepText} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                  {stepText}
                </li>
              ))}
            </ol>
            <p className="border-t pt-4 text-sm text-muted-foreground">
              <a href={`mailto:${siteConfig.email}`} className="font-semibold text-foreground hover:text-primary">
                {siteConfig.email}
              </a>
              <br />
              {t(siteConfig.responseTime, locale)}
            </p>
          </aside>
        </div>
      </Container>
    </section>
  )
}
