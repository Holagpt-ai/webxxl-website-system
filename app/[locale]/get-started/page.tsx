import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import { getIndustries, getIndustry } from '@/content/industries'
import { getStartedPage } from '@/content/pages'
import { getServices } from '@/content/services'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { buildMetadata } from '@/lib/seo'
import { Container, Eyebrow } from '@/components/site/primitives'
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

  return (
    <section className="bg-grid border-b">
      <Container className="flex flex-col gap-8 py-12 md:py-16">
        <Breadcrumbs locale={locale} items={[{ label: t(getStartedPage.eyebrow, locale), href: '/get-started' }]} />
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow>{t(getStartedPage.eyebrow, locale)}</Eyebrow>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{dict.wizard.title}</h1>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">{dict.wizard.description}</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <ProjectWizard
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
            {siteConfig.email && (
              <p className="border-t pt-4 text-sm text-muted-foreground">
                <a href={`mailto:${siteConfig.email}`} className="font-semibold text-foreground hover:text-primary">
                  {siteConfig.email}
                </a>
              </p>
            )}
          </aside>
        </div>
      </Container>
    </section>
  )
}
