'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { LocaleLink } from '@/components/site/primitives'
import { Logo } from '@/components/site/logo'
import { LanguageSwitcher } from '@/components/site/language-switcher'
import { signOutAction } from '@/app/[locale]/login/actions'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AdminLocaleProvider } from '@/components/admin/locale'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { Locale } from '@/lib/i18n/config'

const NAV: { href: string; key: keyof Dictionary['admin']['nav']; match: (p: string | null) => boolean }[] = [
  { href: '/admin', key: 'overview', match: (p) => p === '/admin' || !!p?.endsWith('/admin') },
  { href: '/admin/customers', key: 'customers', match: (p) => !!p?.includes('/admin/customers') },
  { href: '/admin/leads', key: 'leads', match: (p) => !!p?.includes('/admin/leads') },
  { href: '/admin/service-orders', key: 'serviceOrders', match: (p) => !!p?.includes('/admin/service-orders') },
  { href: '/admin/infrastructure', key: 'infrastructure', match: (p) => !!p?.includes('/admin/infrastructure') },
  { href: '/admin/automation', key: 'automation', match: (p) => !!p?.includes('/admin/automation') },
  { href: '/admin/projects', key: 'projects', match: (p) => !!p?.includes('/admin/projects') },
  { href: '/admin/sites', key: 'sites', match: (p) => !!p?.includes('/admin/sites') },
  { href: '/admin/approvals', key: 'approvals', match: (p) => !!p?.includes('/admin/approvals') },
  { href: '/admin/requests', key: 'requests', match: (p) => !!p?.includes('/admin/requests') },
  { href: '/admin/support', key: 'support', match: (p) => !!p?.includes('/admin/support') },
]

type Props = {
  locale: Locale
  dict: Dictionary['admin']
  languageLabel: string
  userEmail: string
  roleLabel: string
  children: React.ReactNode
}

function NavLinks({
  locale,
  dict,
  pathname,
  onNavigate,
}: {
  locale: Locale
  dict: Dictionary['admin']
  pathname: string | null
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label={dict.navLabel}>
      {NAV.map((item) => {
        const active = item.match(pathname)
        return (
          <LocaleLink
            key={item.href}
            locale={locale}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {dict.nav[item.key]}
          </LocaleLink>
        )
      })}
    </nav>
  )
}

export function AdminShell({ locale, dict, languageLabel, userEmail, roleLabel, children }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <AdminLocaleProvider locale={locale}>
      <div className="flex min-h-[calc(100dvh-0px)] bg-muted/40">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-card p-6 md:flex">
          <LocaleLink locale={locale} href="/admin" aria-label={dict.title}>
            <Logo />
          </LocaleLink>
          <p className="-mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dict.operations} · {roleLabel}
          </p>
          <NavLinks locale={locale} dict={dict} pathname={pathname} />
          <div className="mt-auto flex flex-col gap-3 border-t pt-4">
            <LanguageSwitcher locale={locale} label={languageLabel} persist />
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="size-4 shrink-0" aria-hidden="true" />
                {dict.signOut}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden">
            <LocaleLink locale={locale} href="/admin" aria-label={dict.title}>
              <Logo />
            </LocaleLink>
            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={locale} label={languageLabel} persist />
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger render={<Button variant="outline" size="icon" aria-label={dict.openNav} />}>
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-6">
                  <NavLinks locale={locale} dict={dict} pathname={pathname} onNavigate={() => setOpen(false)} />
                  <form action={signOutAction} className="mt-6 border-t pt-4">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
                    >
                      <LogOut className="size-4 shrink-0" aria-hidden="true" />
                      {dict.signOut}
                    </button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
        </div>
      </div>
    </AdminLocaleProvider>
  )
}
