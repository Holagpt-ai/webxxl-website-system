import type { Metadata } from 'next'
import Image from 'next/image'
import { ctas } from '@/config/ctas'
import { aboutPage } from '@/content/pages'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, Section, SectionHeader } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { FeatureGrid } from '@/components/blocks/cards'
import { WebsiteStackMockup } from '@/components/blocks/mockups'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/about', title: t(aboutPage.eyebrow, locale), description: t(aboutPage.description, locale) })
}

export default async function AboutPage({ params }: Props) {
  const { locale, dict } = await getPageContext(params)
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.about, href: '/about' }]}
        eyebrow={t(aboutPage.eyebrow, locale)}
        title={t(aboutPage.title, locale)}
        description={t(aboutPage.description, locale)}
        actions={
          <ButtonLink locale={locale} href={ctas.bookCall.href} icon="calendar" arrow>
            {t(ctas.bookCall.label, locale)}
          </ButtonLink>
        }
        visual={
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
            <Image src="/images/about/workspace.png" alt={t(aboutPage.imageAlt, locale)} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        }
      />
      <Section labelledBy="mission-title">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <h2 id="mission-title" className="text-3xl font-bold">
            {t(aboutPage.missionTitle, locale)}
          </h2>
          <p className="text-pretty text-xl leading-relaxed">{t(aboutPage.mission, locale)}</p>
        </div>
      </Section>
      <Section tone="muted" labelledBy="values-title">
        <SectionHeader id="values-title" title={t(aboutPage.valuesTitle, locale)} />
        <div className="mt-10">
          <FeatureGrid items={aboutPage.values} locale={locale} columns={4} />
        </div>
      </Section>
      <Section labelledBy="platform-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-4">
            <h2 id="platform-title" className="text-3xl font-bold">
              {t(aboutPage.platformTitle, locale)}
            </h2>
            <p className="text-pretty text-lg leading-relaxed text-muted-foreground">{t(aboutPage.platformBody, locale)}</p>
          </div>
          <WebsiteStackMockup locale={locale} />
        </div>
      </Section>
      <CtaBand locale={locale} />
    </>
  )
}
