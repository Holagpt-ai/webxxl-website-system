import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { primaryNav } from '@/config/navigation'
import { ctas } from '@/config/ctas'
import { isEnabled } from '@/config/features'
import { getServices } from '@/content/services'
import { getIndustries } from '@/content/industries'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizePath, t } from '@/lib/i18n/localize'
import { routes } from '@/lib/routes'
import { HeaderNav, type HeaderItem } from './header-nav'
import { MobileNav } from './mobile-nav'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'

export function SiteHeader({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const lp = (p: string) => localizePath(locale, p)

  const items: HeaderItem[] = primaryNav
    .filter((item) => item.type === 'menu' || !item.flag || isEnabled(item.flag))
    .map((item) => {
      if (item.type === 'link') return { type: 'link', label: dict.nav[item.key], href: lp(item.href), match: item.href }
      if (item.menu === 'solutions') {
        return {
          type: 'menu',
          label: dict.nav[item.key],
          href: lp(item.href),
          match: item.href,
          intro: dict.nav.solutionsIntro,
          viewAllLabel: dict.nav.allSolutions,
          columns: 3,
          entries: getServices().map((s) => ({
            label: t(s.name, locale),
            description: t(s.shortDescription, locale),
            href: lp(routes.service(s.slug)),
            icon: s.icon,
          })),
        }
      }
      return {
        type: 'menu',
        label: dict.nav[item.key],
        href: lp(item.href),
        match: item.href,
        intro: dict.nav.industriesIntro,
        viewAllLabel: dict.nav.allIndustries,
        columns: 2,
        entries: getIndustries().map((i) => ({ label: t(i.name, locale), href: lp(routes.industry(i.slug)), icon: i.icon })),
      }
    })

  const bookCall = { label: t(ctas.bookCall.label, locale), href: lp(ctas.bookCall.href) }
  const login = { label: t(ctas.clientLogin.label, locale), href: lp(ctas.clientLogin.href) }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={lp('/')} aria-label={`WebXXL — ${dict.common.home}`} className="shrink-0">
          <Logo />
        </Link>
        <HeaderNav items={items} label={dict.nav.mainNav} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={dict.common.language} className="hidden md:flex" />
          {isEnabled('clientLogin') && (
            <Link href={login.href} className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-foreground/80 hover:bg-muted xl:inline-flex">
              {login.label}
            </Link>
          )}
          {isEnabled('strategyCall') && (
            <Link
              href={bookCall.href}
              className="hidden h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:inline-flex"
            >
              <Calendar className="size-4" aria-hidden="true" />
              {bookCall.label}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
          <MobileNav
            items={items}
            openLabel={dict.common.openMenu}
            title="WebXXL"
            primaryCta={bookCall}
            secondaryCta={login}
            languageSwitcher={<LanguageSwitcher locale={locale} label={dict.common.language} />}
          />
        </div>
      </div>
    </header>
  )
}
