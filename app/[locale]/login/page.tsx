import type { Metadata } from 'next'
import { ctas } from '@/config/ctas'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPageContext, resolveLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/localize'
import { buildMetadata } from '@/lib/seo'
import { CheckList, Container, LocaleLink } from '@/components/site/primitives'
import { Logo } from '@/components/site/logo'
import { LoginForm } from '@/components/forms/login-form'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)
  return { ...buildMetadata({ locale, path: '/login', title: dict.login.title, description: dict.login.description }), robots: { index: false } }
}

export default async function LoginPage({ params }: Props) {
  const { locale, dict } = await getPageContext(params)
  return (
    <section className="bg-grid">
      <Container className="grid gap-10 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-6">
          <h1 className="text-balance text-4xl font-extrabold tracking-tight md:text-5xl">{dict.login.title}</h1>
          <p className="max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">{dict.login.description}</p>
          <CheckList items={dict.login.portalFeatures} />
        </div>
        <div className="flex w-full max-w-md flex-col gap-6 justify-self-center rounded-2xl border bg-card p-8 shadow-sm lg:justify-self-end">
          <Logo />
          <LoginForm
            callbackUrl={locale === 'es' ? '/es/dashboard' : '/dashboard'}
            labels={{
              email: dict.forms.email,
              submit: dict.login.submit,
              unavailable: dict.login.unavailable,
              requiredError: dict.forms.requiredError,
              magicLinkHint: dict.login.magicLinkHint,
              checkEmail: dict.login.checkEmail,
              emailRequired: dict.login.emailRequired,
            }}
          />
          <p className="border-t pt-5 text-center text-sm text-muted-foreground">
            {dict.login.noAccount}{' '}
            <LocaleLink locale={locale} href={ctas.getStarted.href} className="font-semibold text-primary hover:underline">
              {t(ctas.getStarted.label, locale)}
            </LocaleLink>
          </p>
        </div>
      </Container>
    </section>
  )
}
