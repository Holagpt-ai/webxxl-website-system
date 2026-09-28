import type { Metadata } from 'next'
import { ctas } from '@/config/ctas'
import { getCaseStudiesForService } from '@/content/case-studies'
import { getIndustriesBySlugs } from '@/content/industries'
import { getServicesBySlugs, type Service } from '@/content/services'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format, t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { siteConfig } from '@/config/site'
import { ButtonLink, Section, SectionHeader } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { JsonLd } from '@/components/blocks/breadcrumbs'
import { ServiceVisualMockup } from '@/components/blocks/mockups'
import { CaseStudyCard, FeatureGrid, IndustryCard, ItemList, ProcessSteps, ServiceCard } from '@/components/blocks/cards'
import { FaqSection } from '@/components/blocks/faq-section'
import { CtaBand } from '@/components/blocks/cta-band'

export function serviceMetadata(service: Service, locale: Locale): Metadata {
  return buildMetadata({
    locale,
    path: routes.service(service.slug),
    title: t(service.seo?.title ?? service.name, locale),
    description: t(service.seo?.description ?? service.heroDescription, locale),
  })
}

export function ServicePage({ service, locale, parent }: { service: Service; locale: Locale; parent?: { label: string; href: string } }) {
  const dict = getDictionary(locale)
  const name = t(service.name, locale)
  const industries = getIndustriesBySlugs(service.industries).slice(0, 8)
  const related = getServicesBySlugs(service.relatedServices).slice(0, 3)
  const studies = getCaseStudiesForService(service.slug).slice(0, 3)
  const process = service.process ?? dict.process.map((p) => ({ title: { en: p.title }, description: { en: p.description } }))
  const crumbs = [{ label: dict.common.home, href: '/' }, ...(parent ? [parent] : []), { label: name, href: routes.service(service.slug) }]

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name,
          description: t(service.heroDescription, locale),
          provider: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
          areaServed: 'US',
        }}
      />
      <PageHero
        locale={locale}
        crumbs={crumbs}
        eyebrow={t(service.eyebrow, locale)}
        title={t(service.heroTitle, locale)}
        description={t(service.heroDescription, locale)}
        actions={
          <>
            <ButtonLink locale={locale} href={ctas.bookCall.href} icon="calendar" arrow>
              {t(ctas.bookCall.label, locale)}
            </ButtonLink>
            <ButtonLink locale={locale} href={ctas.viewPricing.href} variant="outline">
              {t(ctas.viewPricing.label, locale)}
            </ButtonLink>
          </>
        }
        trust={dict.industry.trust.slice(1)}
        visual={<ServiceVisualMockup visual={service.visual} locale={locale} />}
      />

      {service.benefits.length > 0 && (
        <Section labelledBy="benefits-title">
          <SectionHeader id="benefits-title" eyebrow={dict.sections.benefitsEyebrow} title={format(dict.sections.benefitsTitle, { service: name })} className="mb-10" />
          <ItemList items={service.benefits} locale={locale} />
        </Section>
      )}

      {service.problems.length > 0 && (
        <Section tone="muted" labelledBy="problems-title">
          <SectionHeader id="problems-title" eyebrow={dict.sections.problemsEyebrow} title={dict.sections.problemsTitle} className="mb-10" />
          <ItemList items={service.problems} locale={locale} marker="dot" />
        </Section>
      )}

      <Section labelledBy="features-title">
        <SectionHeader id="features-title" eyebrow={dict.sections.featuresEyebrow} title={dict.sections.featuresTitle} className="mb-10" />
        <FeatureGrid items={service.features} locale={locale} />
      </Section>

      <Section tone="muted" labelledBy="process-title">
        <SectionHeader id="process-title" eyebrow={dict.sections.processEyebrow} title={dict.industry.workflowTitle} className="mb-10" />
        <ProcessSteps items={process} locale={locale} />
      </Section>

      {industries.length > 0 && (
        <Section labelledBy="industries-title">
          <SectionHeader
            id="industries-title"
            eyebrow={dict.sections.industryExamplesEyebrow}
            title={dict.sections.industryExamplesTitle}
            className="mb-10"
            action={
              <ButtonLink locale={locale} href="/industries" variant="ghost" arrow>
                {dict.nav.allIndustries}
              </ButtonLink>
            }
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {industries.map((industry) => (
              <li key={industry.slug} className="flex">
                <IndustryCard industry={industry} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}

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

      <FaqSection
        eyebrow={dict.sections.faqEyebrow}
        title={dict.sections.faqTitle}
        items={service.faq.map((f) => ({ question: t(f.question, locale), answer: t(f.answer, locale) }))}
      />

      {related.length > 0 && (
        <Section tone="muted" labelledBy="related-title">
          <SectionHeader id="related-title" eyebrow={dict.sections.relatedEyebrow} title={dict.sections.relatedServices} className="mb-10" />
          <ul className="grid gap-4 md:grid-cols-3">
            {related.map((s) => (
              <li key={s.slug} className="flex">
                <ServiceCard service={s} locale={locale} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CtaBand locale={locale} />
    </>
  )
}
