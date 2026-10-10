'use client'

import { usePathname } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { LocaleLink } from '@/components/site/primitives'
import { Logo } from '@/components/site/logo'
import { signOutAction } from '@/app/[locale]/login/actions'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/admin', label: 'Overview', match: (p: string | null) => p === '/admin' || p?.endsWith('/admin') },
  { href: '/admin/customers', label: 'Customers', match: (p: string | null) => !!p?.includes('/admin/customers') },
  { href: '/admin/projects', label: 'Projects', match: (p: string | null) => !!p?.includes('/admin/projects') },
  { href: '/admin/sites', label: 'Sites', match: (p: string | null) => !!p?.includes('/admin/sites') },
  { href: '/admin/approvals', label: 'Approvals', match: (p: string | null) => !!p?.includes('/admin/approvals') },
  { href: '/admin/requests', label: 'Change requests', match: (p: string | null) => !!p?.includes('/admin/requests') },
  { href: '/admin/support', label: 'Support', match: (p: string | null) => !!p?.includes('/admin/support') },
] as const

type Props = {
  locale: string
  userEmail: string
  roleLabel: string
  children: React.ReactNode
}

function NavLinks({
  locale,
  pathname,
  onNavigate,
}: {
  locale: string
  pathname: string | null
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.match(pathname)
        return (
          <LocaleLink
            key={item.href}
            locale={locale as 'en' | 'es'}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {item.label}
          </LocaleLink>
        )
      })}
    </nav>
  )
}

export function AdminShell({ locale, userEmail, roleLabel, children }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-[calc(100dvh-0px)] bg-muted/40">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-card p-6 md:flex">
        <LocaleLink locale={locale as 'en' | 'es'} href="/admin" aria-label="WebXXL Admin">
          <Logo />
        </LocaleLink>
        <p className="-mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operations · {roleLabel}</p>
        <NavLinks locale={locale} pathname={pathname} />
        <div className="mt-auto flex flex-col gap-3 border-t pt-4">
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 md:hidden">
          <LocaleLink locale={locale as 'en' | 'es'} href="/admin">
            <Logo />
          </LocaleLink>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open menu" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6">
              <NavLinks locale={locale} pathname={pathname} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  )
}
