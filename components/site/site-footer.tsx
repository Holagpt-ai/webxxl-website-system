import Link from 'next/link'
import { companyLinks, resourceLinks, visible } from '@/config/navigation'
import { isEnabled } from '@/config/features'
import { siteConfig } from '@/config/site'
import { getServices } from '@/content/services'
import { getIndustries } from '@/content/industries'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizePath, t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { Logo } from './logo'
import { NewsletterForm } from './newsletter-form'
import { LanguageSwitcher } from './language-switcher'

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-inverse-foreground">{title}</h2>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-sm text-inverse-muted transition-colors hover:text-inverse-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const lp = (p: string) => localizePath(locale, p)

  const solutions = getServices()
    .slice(0, 8)
    .map((s) => ({ label: t(s.name, locale), href: lp(routes.service(s.slug)) }))
  solutions.push({ label: dict.nav.allSolutions, href: lp('/solutions') })

  const industries = getIndustries()
    .filter((i) => i.featured)
    .slice(0, 8)
    .map((i) => ({ label: t(i.name, locale), href: lp(routes.industry(i.slug)) }))
  industries.push({ label: dict.nav.allIndustries, href: lp('/industries') })

  const company = visible(companyLinks).map((l) => ({ label: dict.nav[l.key], href: lp(l.href) }))
  const resources = visible(resourceLinks).map((l) => ({ label: t(l.label, locale), href: lp(l.href) }))

  return (
    <footer className="bg-inverse text-inverse-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-12 lg:px-8">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Link href={lp('/')} aria-label="WebXXL">
            <Logo tone="inverse" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-inverse-muted">{dict.footer.tagline}</p>
          {siteConfig.email && (
            <a href={`mailto:${siteConfig.email}`} className="text-sm font-medium text-inverse-foreground hover:underline">
              {siteConfig.email}
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-6">
          <FooterColumn title={dict.footer.solutions} links={solutions} />
          <FooterColumn title={dict.footer.industries} links={industries} />
          <FooterColumn title={dict.footer.company} links={company} />
          <FooterColumn title={dict.footer.resources} links={resources} />
        </div>
        {isEnabled('newsletter') && (
          <div className="flex flex-col gap-3 lg:col-span-3">
            <h2 className="text-sm font-semibold">{dict.footer.newsletterTitle}</h2>
            <p className="text-sm leading-relaxed text-inverse-muted">{dict.footer.newsletterBody}</p>
            <NewsletterForm
              locale={locale}
              labels={{
                placeholder: dict.forms.newsletterPlaceholder,
                submit: dict.forms.newsletterSubmit,
                success: dict.forms.newsletterSuccess,
                unavailable: dict.forms.newsletterUnavailable,
                error: dict.forms.errorBody,
                emailLabel: dict.forms.email,
              }}
            />
          </div>
        )}
      </div>
      <div className="border-t border-inverse-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-inverse-muted sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            {'© '}
            {new Date().getFullYear()} {siteConfig.name}. {dict.footer.rights}
          </p>
          <div className="flex items-center gap-4 [&_a]:text-inverse-muted [&_a[aria-current]]:bg-inverse-foreground/10 [&_a[aria-current]]:text-inverse-foreground">
            <LanguageSwitcher locale={locale} label={dict.common.language} />
            <span>{dict.footer.bottomNote}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
