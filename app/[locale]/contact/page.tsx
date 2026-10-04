import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import { ctas } from '@/config/ctas'
import { siteConfig } from '@/config/site'
import { contactPage } from '@/content/pages'
import { getServices } from '@/content/services'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { ButtonLink, Section } from '@/components/site/primitives'
import { PageHero } from '@/components/blocks/page-hero'
import { ContactForm } from '@/components/forms/contact-form'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return buildMetadata({ locale, path: '/contact', title: t(contactPage.eyebrow, locale), description: t(contactPage.description, locale) })
}

export default async function ContactPage({ params }: Props) {
  const { locale, dict } = await getPageContext(params)
  return (
    <>
      <PageHero
        locale={locale}
        crumbs={[{ label: dict.nav.contact, href: '/contact' }]}
        eyebrow={t(contactPage.eyebrow, locale)}
        title={t(contactPage.title, locale)}
        description={t(contactPage.description, locale)}
      />
      <Section labelledBy="contact-form-title">
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 md:p-8">
            <h2 id="contact-form-title" className="text-2xl font-bold">
              {t(contactPage.formTitle, locale)}
            </h2>
            <ContactForm
              locale={locale}
              labels={dict.forms}
              optionalLabel={dict.common.optional}
              services={getServices().map((s) => t(s.name, locale))}
            />
          </div>
          <aside className="flex flex-col gap-6">
            {siteConfig.email && (
              <div className="flex flex-col gap-5 rounded-2xl border bg-muted p-6">
                <h2 className="text-lg font-bold">{t(contactPage.directTitle, locale)}</h2>
                <dl className="flex flex-col gap-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                    <div>
                      <dt className="text-muted-foreground">{t(contactPage.emailLabel, locale)}</dt>
                      <dd>
                        <a href={`mailto:${siteConfig.email}`} className="font-semibold hover:text-primary">
                          {siteConfig.email}
                        </a>
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>
            )}
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-primary p-6 text-primary-foreground">
              <h2 className="text-lg font-bold">{t(contactPage.startTitle, locale)}</h2>
              <p className="text-sm leading-relaxed opacity-90">{t(contactPage.startBody, locale)}</p>
              <ButtonLink locale={locale} href={ctas.getStarted.href} variant="inverse" arrow>
                {t(ctas.getStarted.label, locale)}
              </ButtonLink>
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}
