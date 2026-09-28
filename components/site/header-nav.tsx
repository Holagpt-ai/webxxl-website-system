'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { icons, type IconName } from '@/lib/icons'
import { splitLocale } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'

export type MenuEntry = { label: string; description?: string; href: string; icon: IconName }
export type HeaderItem =
  | { type: 'link'; label: string; href: string; match: string }
  | { type: 'menu'; label: string; href: string; match: string; intro: string; viewAllLabel: string; entries: MenuEntry[]; columns: 2 | 3 }

export function HeaderNav({ items, label }: { items: HeaderItem[]; label: string }) {
  const pathname = usePathname()
  const { path } = splitLocale(pathname)
  const [open, setOpen] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => setOpen(null), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const isActive = (match: string) => (match === '/' ? path === '/' : path === match || path.startsWith(`${match}/`))

  return (
    <nav ref={navRef} aria-label={label} className="relative hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(item.match)
          const linkClass = cn(
            'inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors',
            active ? 'text-primary' : 'text-foreground/80 hover:bg-muted hover:text-foreground',
          )
          if (item.type === 'link') {
            return (
              <li key={item.href}>
                <Link href={item.href} className={linkClass} aria-current={active ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            )
          }
          const expanded = open === item.label
          const panelId = `menu-${item.match.replace(/\W/g, '')}`
          return (
            <li key={item.href} onMouseLeave={() => setOpen(null)} className="static">
              <button
                type="button"
                className={linkClass}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : item.label)}
                onMouseEnter={() => setOpen(item.label)}
              >
                {item.label}
                <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
              </button>
              <div
                id={panelId}
                hidden={!expanded}
                className="absolute left-1/2 top-full z-50 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 pt-3"
              >
                <div className="rounded-2xl border bg-popover p-6 text-popover-foreground shadow-elevated">
                  <div className="mb-4 flex items-center justify-between gap-4 border-b pb-4">
                    <p className="text-sm text-muted-foreground">{item.intro}</p>
                    <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      {item.viewAllLabel}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  <ul className={cn('grid gap-1', item.columns === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
                    {item.entries.map((entry) => {
                      const EntryIcon = icons[entry.icon]
                      return (
                        <li key={entry.href}>
                          <Link href={entry.href} className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted">
                            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                              <EntryIcon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold group-hover:text-primary">{entry.label}</span>
                              {entry.description && <span className="text-xs leading-snug text-muted-foreground">{entry.description}</span>}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
