import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@/config/features'
import { getPlans } from '@/config/pricing'
import { pricingPage } from '@/content/pages'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { Section, SectionHeader } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { PricingCards } from '@/components/blocks/pricing-cards'
import { FeatureGrid } from '@/components/blocks/cards'
import { FaqSection } from '@/components/blocks/faq-section'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/pricing', title: t(pricingPage.eyebrow, locale), description: t(pricingPage.description, locale) })
}

export default async function PricingPage({ params }: Props) {
  if (!isEnabled('pricing')) notFound()
  const { locale, dict } = await getPageContext(params)
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.pricing, href: '/pricing' }]}
        eyebrow={t(pricingPage.eyebrow, locale)}
        title={t(pricingPage.title, locale)}
        description={t(pricingPage.description, locale)}
      />
      <Section labelledBy="plans-title">
        <h2 id="plans-title" className="sr-only">
          {dict.nav.pricing}
        </h2>
        <PricingCards plans={getPlans()} locale={locale} />
      </Section>
      <Section tone="muted" labelledBy="included-title">
        <SectionHeader id="included-title" title={t(pricingPage.includedTitle, locale)} />
        <div className="mt-10">
          <FeatureGrid items={pricingPage.included} locale={locale} columns={3} />
        </div>
      </Section>
      <FaqSection
        eyebrow={dict.sections.faqEyebrow}
        title={dict.sections.faqTitle}
        items={pricingPage.faq.map((f) => ({ question: t(f.question, locale), answer: t(f.answer, locale) }))}
      />
      <CtaBand locale={locale} />
    </>
  )
}
