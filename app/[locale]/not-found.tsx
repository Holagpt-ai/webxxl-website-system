import { headers } from 'next/headers'
import { ctas } from '@/config/ctas'
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { t } from '@/lib/i18n/localize'
import { ButtonLink, Container } from '@/components/site/primitives'

async function detectLocale(): Promise<Locale> {
  const h = await headers()
  const candidate = h.get('x-locale') ?? h.get('accept-language')?.slice(0, 2)
  return isLocale(candidate) ? candidate : defaultLocale
}

export default async function NotFound() {
  const locale = await detectLocale()
  const dict = getDictionary(locale)
  return (
    <section className="bg-grid">
      <Container className="flex flex-col items-start gap-6 py-24 md:py-32">
        <p className="font-mono text-sm font-semibold text-primary">404</p>
        <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-tight md:text-5xl">{dict.states.notFoundTitle}</h1>
        <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">{dict.states.notFoundBody}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink locale={locale} href="/" arrow>
            {dict.common.home}
          </ButtonLink>
          <ButtonLink locale={locale} href="/solutions" variant="outline">
            {dict.nav.solutions}
          </ButtonLink>
          <ButtonLink locale={locale} href={ctas.contact.href} variant="ghost">
            {t(ctas.contact.label, locale)}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
