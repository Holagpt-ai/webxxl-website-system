'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Icon, LocaleLink } from '@/components/site/primitives'
import { Logo } from '@/components/site/logo'
import { signOutAction } from '@/app/[locale]/login/actions'
import type { IconName } from '@/lib/icons'

type DashboardDict = {
  overview: string
  scheduler: string
  billing: string
  support: string
  signOut: string
  title: string
}

const links: { href: string; labelKey: keyof DashboardDict; icon: IconName }[] = [
  { href: '/dashboard', labelKey: 'overview', icon: 'dashboard' },
  { href: '/dashboard/scheduler', labelKey: 'scheduler', icon: 'megaphone' },
  { href: '/dashboard/billing', labelKey: 'billing', icon: 'card' },
  { href: '/dashboard/support', labelKey: 'support', icon: 'lifebuoy' },
]

function NavLinks({ locale, dict, onNavigate }: { locale: string; dict: DashboardDict; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1" aria-label={dict.title}>
      {links.map((link) => {
        const active =
          link.href === '/dashboard' ? pathname === link.href || pathname === `/en${link.href}` : pathname?.endsWith(link.href)
        return (
          <LocaleLink
            key={link.href}
            locale={locale as 'en' | 'es'}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Icon name={link.icon} className="size-4 shrink-0" aria-hidden="true" />
            {dict[link.labelKey]}
          </LocaleLink>
        )
      })}
    </nav>
  )
}

export function DashboardShell({
  locale,
  dict,
  userEmail,
  children,
}: {
  locale: string
  dict: DashboardDict
  userEmail: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-card p-6 md:flex">
        <LocaleLink locale={locale as 'en' | 'es'} href="/dashboard" aria-label={dict.title}>
          <Logo />
        </LocaleLink>
        <NavLinks locale={locale} dict={dict} />
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

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 md:hidden">
          <LocaleLink locale={locale as 'en' | 'es'} href="/dashboard" aria-label={dict.title}>
            <Logo />
          </LocaleLink>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
              aria-label={dict.signOut}
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </header>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-4 py-2 md:hidden" aria-label={dict.title}>
          <NavLinks locale={locale} dict={dict} />
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  )
}
