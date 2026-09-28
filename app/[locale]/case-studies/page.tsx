import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@/config/features'
import { getCaseStudies } from '@/content/case-studies'
import { caseStudiesPage } from '@/content/pages'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { CaseStudyCard } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/case-studies', title: t(caseStudiesPage.eyebrow, locale), description: t(caseStudiesPage.description, locale) })
}

export default async function CaseStudiesPage({ params }: Props) {
  if (!isEnabled('caseStudies')) notFound()
  const { locale, dict } = await getPageContext(params)
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.caseStudies, href: '/case-studies' }]}
        eyebrow={t(caseStudiesPage.eyebrow, locale)}
        title={t(caseStudiesPage.title, locale)}
        description={t(caseStudiesPage.description, locale)}
      />
      <Section labelledBy="case-list-title">
        <h2 id="case-list-title" className="sr-only">
          {dict.nav.caseStudies}
        </h2>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {getCaseStudies().map((study) => (
            <li key={study.slug} className="flex">
              <CaseStudyCard study={study} locale={locale} />
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand locale={locale} />
    </>
  )
}
