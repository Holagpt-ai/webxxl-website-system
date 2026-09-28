import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ctas } from '@/config/ctas'
import { isEnabled } from '@/config/features'
import { supportPage } from '@/content/pages'
import { supportCategories } from '@/content/support'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, IconTile, Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/support', title: t(supportPage.eyebrow, locale), description: t(supportPage.description, locale) })
}

export default async function SupportPage({ params }: Props) {
  if (!isEnabled('support')) notFound()
  const { locale } = await getPageContext(params)
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: t(supportPage.eyebrow, locale), href: '/support' }]}
        eyebrow={t(supportPage.eyebrow, locale)}
        title={t(supportPage.title, locale)}
        description={t(supportPage.description, locale)}
      />
      <Section labelledBy="support-topics">
        <h2 id="support-topics" className="sr-only">
          {t(supportPage.eyebrow, locale)}
        </h2>
        <nav aria-label={t(supportPage.eyebrow, locale)}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {supportCategories.map((cat) => (
              <li key={cat.slug}>
                <a href={`#${cat.slug}`} className="flex h-full items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary">
                  <IconTile name={cat.icon} />
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{t(cat.title, locale)}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">{t(cat.description, locale)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-16 flex flex-col gap-12">
          {supportCategories.map((cat) => (
            <section key={cat.slug} id={cat.slug} aria-labelledby={`${cat.slug}-title`} className="grid scroll-mt-24 gap-4 lg:grid-cols-[1fr_2fr]">
              <h3 id={`${cat.slug}-title`} className="text-xl font-bold">
                {t(cat.title, locale)}
              </h3>
              <Accordion className="rounded-xl border bg-card px-5">
                {cat.faq.map((item, i) => (
                  <AccordionItem key={i} value={`${cat.slug}-${i}`}>
                    <AccordionTrigger className="text-left font-semibold">{t(item.question, locale)}</AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">{t(item.answer, locale)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      </Section>
      <Section tone="muted" labelledBy="still-help-title">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 id="still-help-title" className="text-2xl font-bold">
              {t(supportPage.contactTitle, locale)}
            </h2>
            <p className="leading-relaxed text-muted-foreground">{t(supportPage.contactBody, locale)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink locale={locale} href={ctas.contact.href} arrow>
              {t(ctas.contact.label, locale)}
            </ButtonLink>
            <ButtonLink locale={locale} href={ctas.clientLogin.href} variant="outline">
              {t(ctas.clientLogin.label, locale)}
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
