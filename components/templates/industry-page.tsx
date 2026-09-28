import type { Metadata } from 'next'
import { ctas } from '@/config/ctas'
import { getCaseStudiesBySlugs, getCaseStudiesForIndustry } from '@/content/case-studies'
import { getRelatedIndustries, type Industry } from '@/content/industries'
import { getServicesBySlugs } from '@/content/services'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format, t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, CheckList, IconTile, Section, SectionHeader } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { BrowserMockup, CrmContactsMockup, CrmSummaryMockup, InfrastructureMockup } from '@/components/blocks/mockups'
import { CaseStudyCard, IndustryCard, ItemList, ProcessSteps, ServiceCard } from '@/components/blocks/cards'
import { FaqSection } from '@/components/blocks/faq-section'
import { CtaBand } from '@/components/blocks/cta-band'

export function industryMetadata(industry: Industry, locale: Locale): Metadata {
  const dict = getDictionary(locale)
  return buildMetadata({
    locale,
    path: routes.industry(industry.slug),
    title: industry.seo?.title ? t(industry.seo.title, locale) : format(dict.industry.heroTitle, { industry: t(industry.inlineName, locale) }).replace(/\.$/, ''),
    description: t(industry.seo?.description ?? industry.heroDescription, locale),
  })
}

export function IndustryPage({ industry, locale }: { industry: Industry; locale: Locale }) {
  const dict = getDictionary(locale)
  const d = dict.industry
  const name = t(industry.name, locale)
  const vars = { industry: t(industry.inlineName, locale) }
  const painPoints = industry.painPoints ?? d.painPoints.map((p) => ({ title: { en: p.title }, description: { en: p.description } }))
  const workflow = d.workflow.map((w) => ({ title: { en: w.title }, description: { en: w.description } }))
  const faq = industry.faq
    ? industry.faq.map((f) => ({ question: t(f.question, locale), answer: t(f.answer, locale) }))
    : d.faq.map((f) => ({ question: format(f.question, vars), answer: format(f.answer, vars) }))
  const services = getServicesBySlugs(industry.services).slice(0, 6)
  const studies = (industry.caseStudies ? getCaseStudiesBySlugs(industry.caseStudies) : getCaseStudiesForIndustry(industry.slug)).slice(0, 3)
  const related = getRelatedIndustries(industry, 4)

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: dict.nav.industries, href: '/industries' },
          { label: name, href: routes.industry(industry.slug) },
        ]}
        eyebrow={name}
        title={format(d.heroTitle, vars)}
        description={t(industry.heroDescription, locale)}
        actions={
          <>
            <ButtonLink locale={locale} href={`${ctas.bookCall.href}&industry=${industry.slug}`} icon="calendar" arrow>
              {t(ctas.bookCall.label, locale)}
            </ButtonLink>
            <ButtonLink locale={locale} href={ctas.viewCaseStudies.href} variant="outline">
              {t(ctas.viewCaseStudies.label, locale)}
            </ButtonLink>
          </>
        }
        trust={d.trust}
        visual={
          <div className="relative flex items-start gap-4">
            <IconTile name={industry.icon} size="lg" className="absolute -left-3 -top-5 z-10 hidden shadow-elevated md:inline-flex" />
            <BrowserMockup locale={locale} className="flex-1" />
          </div>
        }
      />

      <Section labelledBy="pain-title">
        <SectionHeader id="pain-title" eyebrow={dict.sections.problemsEyebrow} title={format(d.problemsTitle, vars)} className="mb-10" />
        <ItemList items={painPoints} locale={locale} marker="dot" />
      </Section>

      <Section tone="muted" labelledBy="capabilities-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionHeader id="capabilities-title" eyebrow={d.capabilitiesEyebrow} title={format(d.capabilitiesTitle, vars)} />
          <div className="rounded-2xl border bg-card p-6 shadow-card md:p-8">
            <CheckList items={t(industry.capabilities, locale)} />
          </div>
        </div>
      </Section>

      <Section labelledBy="services-title">
        <SectionHeader id="services-title" eyebrow={d.servicesEyebrow} title={format(d.servicesTitle, vars)} className="mb-10" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug} className="flex">
              <ServiceCard service={s} locale={locale} />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted" labelledBy="crm-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-6">
            <SectionHeader id="crm-title" eyebrow={d.crmEyebrow} title={d.crmTitle} description={d.crmDescription} />
            <CheckList items={d.crmBullets} />
            <ButtonLink locale={locale} href={ctas.seeCrm.href} icon="play" className="self-start">
              {t(ctas.seeCrm.label, locale)}
            </ButtonLink>
          </div>
          <CrmContactsMockup locale={locale} />
        </div>
      </Section>

      <Section labelledBy="workflow-title">
        <SectionHeader id="workflow-title" eyebrow={d.workflowEyebrow} title={d.workflowTitle} className="mb-10" />
        <ProcessSteps items={workflow} locale={locale} />
      </Section>

      <Section tone="muted" labelledBy="showcase-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative">
            <BrowserMockup locale={locale} />
            <CrmSummaryMockup locale={locale} className="absolute -bottom-10 -right-2 hidden w-64 xl:block" />
          </div>
          <SectionHeader id="showcase-title" eyebrow={d.showcaseEyebrow} title={format(d.showcaseTitle, vars)} description={d.showcaseDescription} />
        </div>
      </Section>

      <Section labelledBy="hosting-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-6">
            <SectionHeader id="hosting-title" eyebrow={d.hostingEyebrow} title={d.hostingTitle} description={d.hostingDescription} />
            <ButtonLink locale={locale} href="/hosting" variant="outline" arrow className="self-start">
              {dict.nav.hosting}
            </ButtonLink>
          </div>
          <InfrastructureMockup locale={locale} />
        </div>
      </Section>

      {studies.length > 0 && (
        <Section tone="muted" labelledBy="studies-title">
          <SectionHeader id="studies-title" eyebrow={dict.sections.caseStudiesEyebrow} title={dict.sections.caseStudiesTitle} className="mb-10" />
          <ul className="grid gap-6 md:grid-cols-3">
            {studies.map((study) => (
              <li key={study.slug} className="flex">
                <CaseStudyCard study={study} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <FaqSection eyebrow={dict.sections.faqEyebrow} title={dict.sections.faqTitle} items={faq} />

      {related.length > 0 && (
        <Section tone="muted" labelledBy="related-title">
          <SectionHeader id="related-title" eyebrow={dict.sections.relatedEyebrow} title={dict.sections.relatedIndustries} className="mb-10" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {related.map((i) => (
              <li key={i.slug} className="flex">
                <IndustryCard industry={i} locale={locale} variant="row" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CtaBand locale={locale} title={format(d.ctaTitle, vars)} />
    </>
  )
}
