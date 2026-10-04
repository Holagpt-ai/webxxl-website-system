import type { Metadata } from 'next'
import Image from 'next/image'
import { ctas } from '@/config/ctas'
import { getCaseStudiesBySlugs, getCaseStudiesForIndustry } from '@/content/case-studies'
import { getRelatedIndustries, type Industry } from '@/content/industries'
import { getServicesBySlugs } from '@/content/services'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { format, t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, CheckList, Eyebrow, IconTile, Pill, Section, SectionHeader } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { BrowserMockup, CrmContactsMockup, CrmSummaryMockup, IndustrySiteMockup, InfrastructureMockup } from '@/components/blocks/mockups'
import { CaseStudyCard, FeatureGrid, IndustryCard, ItemList, ProcessSteps, ServiceCard } from '@/components/blocks/cards'
import { FaqSection } from '@/components/blocks/faq-section'
import { CtaBand } from '@/components/blocks/cta-band'

export function industryMetadata(industry: Industry, locale: Locale): Metadata {
  const dict = getDictionary(locale)
  return buildMetadata({
    locale,
    path: routes.industry(industry.slug),
    title: industry.seo?.title ? t(industry.seo.title, locale) : format(dict.industry.heroTitle, { industry: t(industry.inlineName, locale) }).replace(/\.$/, ''),
    description: t(industry.seo?.description ?? industry.hero?.description ?? industry.heroDescription, locale),
  })
}

/** Resolves the hero visual from industry data. Falls back to the generic example site. */
function IndustryHeroVisual({ industry, locale, demoLabel }: { industry: Industry; locale: Locale; demoLabel: string }) {
  const visual = industry.heroVisual
  if (visual?.type === 'industryMockup') {
    return <IndustrySiteMockup locale={locale} demoLabel={demoLabel} {...visual} />
  }
  if (visual?.type === 'image') {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border shadow-elevated">
        <Image src={visual.src} alt={t(visual.alt, locale)} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" priority />
      </div>
    )
  }
  return (
    <div className="relative">
      <IconTile name={industry.icon} size="lg" className="absolute -left-3 -top-5 z-10 hidden shadow-elevated md:inline-flex" />
      <BrowserMockup locale={locale} />
    </div>
  )
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
  const startHref = `/get-started?industry=${industry.slug}`
  const primaryLabel = industry.ctas?.primary ? t(industry.ctas.primary, locale) : format(d.startProject, vars)

  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[
          { label: dict.nav.industries, href: '/industries' },
          { label: name, href: routes.industry(industry.slug) },
        ]}
        eyebrow={name}
        title={industry.hero?.title ? t(industry.hero.title, locale) : format(d.heroTitle, vars)}
        description={t(industry.hero?.description ?? industry.heroDescription, locale)}
        actions={
          <>
            <ButtonLink locale={locale} href={startHref} icon="rocket" arrow>
              {primaryLabel}
            </ButtonLink>
            <ButtonLink locale={locale} href={`${ctas.bookCall.href}&industry=${industry.slug}`} variant="outline" icon="calendar">
              {t(ctas.bookCall.label, locale)}
            </ButtonLink>
          </>
        }
        trust={industry.trustPoints ? t(industry.trustPoints, locale).slice(0, 3) : d.trust}
        visual={<IndustryHeroVisual industry={industry} locale={locale} demoLabel={d.demoConcept} />}
      />

      {industry.conversionGoals && (
        <Section labelledBy="goals-title" className="pb-0 md:pb-0">
          <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-card md:p-8">
            <SectionHeader id="goals-title" eyebrow={d.goalsEyebrow} title={format(d.goalsTitle, vars)} />
            <ul className="flex flex-wrap gap-2">
              {t(industry.conversionGoals, locale).map((goal) => (
                <li key={goal}>
                  <Pill>{goal}</Pill>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section labelledBy="pain-title">
        <SectionHeader id="pain-title" eyebrow={dict.sections.problemsEyebrow} title={format(d.problemsTitle, vars)} className="mb-10" />
        <ItemList items={painPoints} locale={locale} marker="dot" />
      </Section>

      {industry.websiteFeatures ? (
        <Section tone="muted" labelledBy="features-title">
          <SectionHeader id="features-title" eyebrow={d.featuresEyebrow} title={format(d.featuresTitle, vars)} className="mb-10" />
          <FeatureGrid items={industry.websiteFeatures} locale={locale} columns={industry.websiteFeatures.length % 3 === 0 ? 3 : 2} />
        </Section>
      ) : (
        <Section tone="muted" labelledBy="capabilities-title">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHeader id="capabilities-title" eyebrow={d.capabilitiesEyebrow} title={format(d.capabilitiesTitle, vars)} />
            <div className="rounded-2xl border bg-card p-6 shadow-card md:p-8">
              <CheckList items={t(industry.capabilities, locale)} />
            </div>
          </div>
        </Section>
      )}

      {industry.leadCapture && (
        <Section labelledBy="lead-title">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHeader
              id="lead-title"
              eyebrow={d.leadEyebrow}
              title={t(industry.leadCapture.title, locale)}
              description={industry.leadCapture.description ? t(industry.leadCapture.description, locale) : undefined}
            />
            <div className="rounded-2xl border bg-card p-6 shadow-card md:p-8">
              <CheckList items={t(industry.leadCapture.items, locale)} />
            </div>
          </div>
        </Section>
      )}

      <Section tone={industry.leadCapture ? 'muted' : 'default'} labelledBy="services-title">
        <SectionHeader id="services-title" eyebrow={d.servicesEyebrow} title={format(d.servicesTitle, vars)} className="mb-10" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug} className="flex">
              <ServiceCard service={s} locale={locale} />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone={industry.leadCapture ? 'default' : 'muted'} labelledBy="crm-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-6">
            <SectionHeader id="crm-title" eyebrow={d.crmEyebrow} title={d.crmTitle} description={d.crmDescription} />
            <CheckList items={industry.crmFeatures ? t(industry.crmFeatures, locale) : d.crmBullets} />
            <ButtonLink locale={locale} href={ctas.seeCrm.href} icon="play" className="self-start">
              {t(ctas.seeCrm.label, locale)}
            </ButtonLink>
          </div>
          <CrmContactsMockup locale={locale} />
        </div>
      </Section>

      {industry.campaigns && (
        <Section tone="muted" labelledBy="campaigns-title">
          <SectionHeader
            id="campaigns-title"
            eyebrow={d.campaignsEyebrow}
            title={t(industry.campaigns.title, locale)}
            description={industry.campaigns.description ? t(industry.campaigns.description, locale) : undefined}
            className="mb-10"
          />
          <ProcessSteps items={industry.campaigns.items} locale={locale} />
        </Section>
      )}

      {industry.localSeo && (
        <Section labelledBy="seo-title">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <SectionHeader
              id="seo-title"
              eyebrow={d.localSeoEyebrow}
              title={t(industry.localSeo.title, locale)}
              description={industry.localSeo.description ? t(industry.localSeo.description, locale) : undefined}
            />
            <div className="rounded-2xl border bg-card p-6 shadow-card md:p-8">
              <CheckList items={t(industry.localSeo.items, locale)} />
            </div>
          </div>
        </Section>
      )}

      {(industry.trustPoints || industry.integrations || industry.promotion) && (
        <Section tone="muted" labelledBy="trust-title">
          <SectionHeader id="trust-title" eyebrow={d.trustEyebrow} title={d.trustTitle} className="mb-10" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {industry.trustPoints && (
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-card">
                <IconTile name="shield" />
                <CheckList items={t(industry.trustPoints, locale)} />
              </div>
            )}
            {industry.integrations && (
              <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-card">
                <IconTile name="puzzle" />
                <h3 className="font-semibold text-foreground">{d.integrationsTitle}</h3>
                <ul className="flex flex-wrap gap-2">
                  {t(industry.integrations, locale).map((tool) => (
                    <li key={tool}>
                      <Pill>{tool}</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {industry.promotion && (
              <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-secondary p-6">
                <Eyebrow>{d.promotionEyebrow}</Eyebrow>
                <h3 className="text-pretty font-semibold text-foreground">{t(industry.promotion.title, locale)}</h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{t(industry.promotion.description, locale)}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section labelledBy="workflow-title">
        <SectionHeader id="workflow-title" eyebrow={d.workflowEyebrow} title={d.workflowTitle} className="mb-10" />
        <ProcessSteps items={workflow} locale={locale} />
      </Section>

      {!industry.heroVisual && (
        <Section tone="muted" labelledBy="showcase-title">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <BrowserMockup locale={locale} />
              <CrmSummaryMockup locale={locale} className="absolute -bottom-10 -right-2 hidden w-64 xl:block" />
            </div>
            <SectionHeader id="showcase-title" eyebrow={d.showcaseEyebrow} title={format(d.showcaseTitle, vars)} description={d.showcaseDescription} />
          </div>
        </Section>
      )}

      <Section tone="muted" labelledBy="hosting-title">
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
        <Section labelledBy="studies-title">
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

      <CtaBand
        locale={locale}
        title={industry.ctas?.bandTitle ? t(industry.ctas.bandTitle, locale) : format(d.ctaTitle, vars)}
        description={industry.ctas?.bandDescription ? t(industry.ctas.bandDescription, locale) : undefined}
      />
    </>
  )
}
