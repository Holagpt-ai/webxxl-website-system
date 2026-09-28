import { ctas } from '@/config/ctas'
import { getPlans } from '@/config/pricing'
import { getCaseStudies } from '@/content/case-studies'
import { getIndustries } from '@/content/industries'
import { homePage } from '@/content/pages'
import { getServicesBySlugs } from '@/content/services'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { t } from '@/lib/i18n/localize'
import { ButtonLink, CheckList, Container, IconTile, LocaleLink, Section, SectionHeader } from '@/components/site/primitives'
import { CampaignMockup, CrmContactsMockup } from '@/components/blocks/mockups'
import { CaseStudyCard, IndustryCard, ProcessSteps, ServiceCard } from '@/components/blocks/cards'
import { PricingCards } from '@/components/blocks/pricing-cards'

const HOME_SERVICES = ['website-design', 'crm', 'lead-capture', 'campaigns', 'hosting', 'domains', 'analytics', 'maintenance']

export function HomeServices({ locale }: { locale: Locale }) {
  const services = getServicesBySlugs(HOME_SERVICES)
  return (
    <section aria-label={getDictionary(locale).nav.solutions} className="border-b bg-background py-10">
      <Container>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {services.map((service) => (
            <li key={service.slug} className="flex">
              <ServiceCard service={service} locale={locale} compact />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

export function HomeIndustries({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const industries = getIndustries().filter((i) => i.featured).slice(0, 20)
  return (
    <Section labelledBy="home-industries-title">
      <SectionHeader
        id="home-industries-title"
        eyebrow={t(homePage.industriesEyebrow, locale)}
        title={t(homePage.industriesTitle, locale)}
        action={
          <LocaleLink locale={locale} href="/industries" className="text-sm font-semibold text-primary hover:underline">
            {t(homePage.industriesCount, locale)} · {dict.nav.allIndustries}
          </LocaleLink>
        }
      />
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
        {industries.map((industry) => (
          <li key={industry.slug} className="flex">
            <IndustryCard industry={industry} locale={locale} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function HomeCrm({ locale }: { locale: Locale }) {
  return (
    <Section tone="muted" labelledBy="home-crm-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <SectionHeader
            id="home-crm-title"
            eyebrow={t(homePage.crmEyebrow, locale)}
            title={t(homePage.crmTitle, locale)}
            description={t(homePage.crmDescription, locale)}
          />
          <CheckList items={t(homePage.crmBullets, locale)} />
          <ButtonLink locale={locale} href={ctas.seeCrm.href} icon="play" className="self-start">
            {t(ctas.seeCrm.label, locale)}
          </ButtonLink>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <CrmContactsMockup locale={locale} />
          <CampaignMockup locale={locale} className="hidden md:block" />
        </div>
      </div>
    </Section>
  )
}

export function HomeHosting({ locale }: { locale: Locale }) {
  return (
    <Section labelledBy="home-hosting-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:items-center">
        <SectionHeader
          id="home-hosting-title"
          eyebrow={t(homePage.hostingEyebrow, locale)}
          title={t(homePage.hostingTitle, locale)}
          description={t(homePage.hostingDescription, locale)}
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {homePage.hostingItems.map((item) => (
            <li key={item.icon} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <IconTile name={item.icon} size="sm" />
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold leading-snug">{t(item.title, locale)}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{t(item.description, locale)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

export function HomeProcess({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const steps = dict.process.map((step) => ({ title: { en: step.title }, description: { en: step.description } }))
  return (
    <Section id="how-it-works" tone="muted" labelledBy="home-process-title">
      <SectionHeader id="home-process-title" eyebrow={t(homePage.howEyebrow, locale)} title={t(homePage.howTitle, locale)} />
      <div className="mt-10">
        <ProcessSteps items={steps} locale={locale} />
      </div>
    </Section>
  )
}

export function HomeCaseStudies({ locale }: { locale: Locale }) {
  const studies = getCaseStudies().slice(0, 3)
  if (studies.length === 0) return null
  return (
    <Section labelledBy="home-cases-title">
      <SectionHeader
        id="home-cases-title"
        eyebrow={getDictionary(locale).sections.caseStudiesEyebrow}
        title={t(homePage.caseStudiesTitle, locale)}
        description={t(homePage.caseStudiesDescription, locale)}
        action={
          <ButtonLink locale={locale} href={ctas.viewCaseStudies.href} variant="outline" arrow>
            {t(ctas.viewCaseStudies.label, locale)}
          </ButtonLink>
        }
      />
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {studies.map((study) => (
          <li key={study.slug} className="flex">
            <CaseStudyCard study={study} locale={locale} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function HomePricing({ locale }: { locale: Locale }) {
  return (
    <Section tone="muted" labelledBy="home-pricing-title">
      <div className="grid gap-10 lg:grid-cols-[1fr_3fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <SectionHeader
            id="home-pricing-title"
            eyebrow={t(homePage.pricingEyebrow, locale)}
            title={t(homePage.pricingTitle, locale)}
            description={t(homePage.pricingDescription, locale)}
          />
          <ButtonLink locale={locale} href={ctas.viewPricing.href} variant="outline" arrow className="self-start">
            {t(ctas.viewPricing.label, locale)}
          </ButtonLink>
        </div>
        <PricingCards plans={getPlans({ homeOnly: true })} locale={locale} />
      </div>
    </Section>
  )
}
