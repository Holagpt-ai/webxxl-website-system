import type { Metadata } from 'next'
import { ctas } from '@/config/ctas'
import { solutionsPage } from '@/content/pages'
import { getServices } from '@/content/services'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { ProcessSteps, ServiceCard } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'
import { SectionHeader } from '@/components/site/primitives'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/solutions', title: t(solutionsPage.eyebrow, locale), description: t(solutionsPage.description, locale) })
}

export default async function SolutionsPage({ params }: Props) {
  const { locale, dict } = await getPageContext(params)
  const steps = dict.process.map((s) => ({ title: { en: s.title }, description: { en: s.description } }))
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.solutions, href: '/solutions' }]}
        eyebrow={t(solutionsPage.eyebrow, locale)}
        title={t(solutionsPage.title, locale)}
        description={t(solutionsPage.description, locale)}
        actions={
          <ButtonLink locale={locale} href={ctas.bookCall.href} icon="calendar" arrow>
            {t(ctas.bookCall.label, locale)}
          </ButtonLink>
        }
      />
      <Section labelledBy="solutions-list-title">
        <h2 id="solutions-list-title" className="sr-only">
          {dict.nav.allSolutions}
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {getServices().map((service) => (
            <li key={service.slug} className="flex">
              <ServiceCard service={service} locale={locale} />
            </li>
          ))}
        </ul>
      </Section>
      <Section tone="muted" labelledBy="solutions-process-title">
        <SectionHeader id="solutions-process-title" eyebrow={dict.sections.processEyebrow} title={dict.wizard.title} />
        <div className="mt-10">
          <ProcessSteps items={steps} locale={locale} />
        </div>
      </Section>
      <CtaBand locale={locale} />
    </>
  )
}
