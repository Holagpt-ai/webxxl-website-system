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
                  <Link href={item.href} className="flex h-12 items-center rounded-lg px-3 font-medium hover:bg-muted">
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li key={item.href}>
                  <button
                    type="button"
                    aria-expanded={expanded === item.label}
                    onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                    className="flex h-12 w-full items-center justify-between rounded-lg px-3 font-medium hover:bg-muted"
                  >
                    {item.label}
                    <ChevronDown className={cn('size-4 transition-transform', expanded === item.label && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {expanded === item.label && (
                    <ul className="mb-2 flex flex-col border-l ml-4 pl-2">
                      <li>
                        <Link href={item.href} className="flex h-10 items-center rounded-md px-3 text-sm font-semibold text-primary hover:bg-muted">
                          {item.viewAllLabel}
                        </Link>
                      </li>
                      {item.entries.map((entry) => {
                        const EntryIcon = icons[entry.icon]
                        return (
                          <li key={entry.href}>
                            <Link href={entry.href} className="flex h-10 items-center gap-2.5 rounded-md px-3 text-sm hover:bg-muted">
                              <EntryIcon className="size-4 text-primary" aria-hidden="true" />
                              {entry.label}
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
