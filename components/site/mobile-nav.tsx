'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { HeaderItem } from './header-nav'

export function MobileNav({
  items,
  openLabel,
  title,
  primaryCta,
  secondaryCta,
  languageSwitcher,
}: {
  items: HeaderItem[]
  openLabel: string
  title: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  languageSwitcher: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pathname = usePathname()
  const isCurrent = (href: string) => pathname === href
  const isWithin = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => setOpen(false), [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex size-10 items-center justify-center rounded-lg border bg-background text-foreground lg:hidden"
        aria-label={openLabel}
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{openLabel}</SheetDescription>
        </SheetHeader>
        <nav aria-label={title} className="flex-1 p-2">
          <ul className="flex flex-col">
            {items.map((item) =>
              item.type === 'link' ? (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item.href) ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center rounded-lg px-3 font-medium hover:bg-muted',
                      isWithin(item.href) && 'bg-muted text-primary',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.href}>
                  <button
                    type="button"
                    aria-expanded={expanded === item.label}
                    aria-controls={`mobile-menu-${item.match.replace(/\W/g, '')}`}
                    onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                    className={cn(
                      'flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left font-medium hover:bg-muted',
                      isWithin(item.href) && 'text-primary',
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn('size-4 shrink-0 transition-transform', expanded === item.label && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded === item.label && (
                    <ul id={`mobile-menu-${item.match.replace(/\W/g, '')}`} className="mb-2 ml-4 flex flex-col border-l pl-2">
                      <li>
                        <Link
                          href={item.href}
                          aria-current={isCurrent(item.href) ? 'page' : undefined}
                          className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-primary hover:bg-muted"
                        >
                          {item.viewAllLabel}
                        </Link>
                      </li>
                      {item.entries.map((entry) => {
                        const EntryIcon = icons[entry.icon]
                        const current = isCurrent(entry.href)
                        return (
                          <li key={entry.href}>
                            <Link
                              href={entry.href}
                              aria-current={current ? 'page' : undefined}
                              className={cn(
                                'flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-sm leading-snug hover:bg-muted',
                                current && 'bg-muted font-semibold text-primary',
                              )}
                            >
                              <EntryIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                              <span className="min-w-0">{entry.label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 border-t p-4">
          {languageSwitcher}
          <Link href={secondaryCta.href} className="inline-flex h-11 items-center justify-center rounded-lg border font-semibold hover:bg-muted">
            {secondaryCta.label}
          </Link>
          <Link href={primaryCta.href} className="inline-flex h-11 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            {primaryCta.label}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
