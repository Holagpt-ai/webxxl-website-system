import type { Metadata } from 'next'
import { ctas } from '@/config/ctas'
import { getIndustries, industryGroups } from '@/content/industries'
import { industriesPage } from '@/content/pages'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { IndustryCard } from '@/components/blocks/cards'
import { CtaBand } from '@/components/blocks/cta-band'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/industries', title: t(industriesPage.eyebrow, locale), description: t(industriesPage.description, locale) })
}

export default async function IndustriesPage({ params }: Props) {
  const { locale, dict } = await getPageContext(params)
  const industries = getIndustries()
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.industries, href: '/industries' }]}
        eyebrow={t(industriesPage.eyebrow, locale)}
        title={t(industriesPage.title, locale)}
        description={t(industriesPage.description, locale)}
      />
      {industryGroups.map((group) => {
        const items = industries.filter((i) => i.group === group.id)
        if (items.length === 0) return null
        const id = `industry-group-${group.id}`
        return (
          <Section key={group.id} labelledBy={id} className="py-10 md:py-14">
            <h2 id={id} className="text-2xl font-bold">
              {t(group.label, locale)}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((industry) => (
                <li key={industry.slug} className="flex">
                  <IndustryCard industry={industry} locale={locale} variant="row" />
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
      <Section tone="muted" labelledBy="not-listed-title">
        <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 id="not-listed-title" className="text-2xl font-bold">
              {t(industriesPage.notListedTitle, locale)}
            </h2>
            <p className="leading-relaxed text-muted-foreground">{t(industriesPage.notListedBody, locale)}</p>
          </div>
          <ButtonLink locale={locale} href={ctas.contact.href} arrow>
            {t(ctas.contact.label, locale)}
          </ButtonLink>
        </div>
      </Section>
      <CtaBand locale={locale} />
    </>
  )
}
