'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Icon, LocaleLink } from '@/components/site/primitives'
import { Logo } from '@/components/site/logo'
import { signOutAction } from '@/app/[locale]/login/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { PortalModule } from '@/lib/portal/modules'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

type Props = {
  locale: string
  dict: Dictionary['dashboard']
  businessName: string
  userEmail: string
  navModules: PortalModule[]
  children: React.ReactNode
}

function navLabel(dict: Dictionary['dashboard'], key: string): string {
  const nav = dict.nav as Record<string, string>
  return nav[key] ?? key
}

function NavLinks({
  locale,
  dict,
  navModules,
  pathname,
  onNavigate,
}: {
  locale: string
  dict: Dictionary['dashboard']
  navModules: PortalModule[]
  pathname: string | null
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label={dict.title}>
      {navModules.map((link) => {
        if (!link.route) return null
        const href = link.route
        const active =
          href === '/dashboard'
            ? pathname === href || pathname === `/en${href}` || pathname?.endsWith('/dashboard')
            : pathname?.includes(href)
        return (
          <LocaleLink
            key={`${link.key}-${link.route}`}
            locale={locale as 'en' | 'es'}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Icon name={link.icon} className="size-4 shrink-0" aria-hidden="true" />
            {navLabel(dict, link.navLabel)}
          </LocaleLink>
        )
      })}
    </nav>
  )
}

export function DashboardShell({ locale, dict, businessName, userEmail, navModules, children }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-[calc(100dvh-0px)] bg-muted/40">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-card p-6 md:flex">
        <LocaleLink locale={locale as 'en' | 'es'} href="/dashboard" aria-label={dict.title}>
          <Logo />
        </LocaleLink>
        <p className="-mt-2 truncate text-sm font-semibold text-foreground">{businessName}</p>
        <NavLinks locale={locale} dict={dict} navModules={navModules} pathname={pathname} />
        <div className="mt-auto flex flex-col gap-3 border-t pt-4">
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
          <LocaleLink locale={locale as 'en' | 'es'} href="/dashboard" aria-label={dict.title}>
            <Logo />
          </LocaleLink>
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" aria-label={dict.openNav} />}>
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-6">
                <p className="mb-4 truncate text-sm font-semibold">{businessName}</p>
                <NavLinks
                  locale={locale}
                  dict={dict}
                  navModules={navModules}
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label={dict.signOut}>
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  )
}
