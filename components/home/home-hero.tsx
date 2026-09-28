import { Check } from 'lucide-react'
import { ctas } from '@/config/ctas'
import { homePage } from '@/content/pages'
import type { Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/localize'
import { ButtonLink, Container, Pill } from '@/components/site/primitives'
import { BrowserMockup, CrmSummaryMockup } from '@/components/blocks/mockups'

export function HomeHero({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="home-hero-title" className="bg-grid relative overflow-hidden border-b">
      <Container className="grid gap-14 py-14 md:py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-6">
          <Pill className="self-start">{t(homePage.pill, locale)}</Pill>
          <h1
            id="home-hero-title"
            className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            {t(homePage.titleLead, locale)} <span className="text-primary">{t(homePage.titleAccent, locale)}</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">{t(homePage.description, locale)}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink locale={locale} href={ctas.bookCall.href} icon="calendar" arrow>
              {t(ctas.bookCall.label, locale)}
            </ButtonLink>
            <ButtonLink locale={locale} href={ctas.seeHowItWorks.href} variant="outline" icon="play">
              {t(ctas.seeHowItWorks.label, locale)}
            </ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {t(homePage.trust, locale).map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative pb-10 lg:pb-16">
          <p
            aria-hidden="true"
            className="absolute -top-10 right-0 hidden max-w-44 rotate-[-4deg] text-right text-sm italic leading-snug text-primary lg:block"
          >
            {t(homePage.annotation, locale)}
          </p>
          <BrowserMockup locale={locale} className="w-full lg:w-[85%]" />
          <CrmSummaryMockup
            locale={locale}
            className="absolute -bottom-2 right-0 w-[52%] min-w-52 sm:-bottom-4 lg:-right-2 lg:top-10 lg:bottom-auto lg:w-[40%]"
          />
        </div>
      </Container>
    </section>
  )
}
