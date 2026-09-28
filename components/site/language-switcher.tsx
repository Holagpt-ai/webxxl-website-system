'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { locales, type Locale } from '@/lib/i18n/config'
import { localizePath, splitLocale } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname()
  const { path } = splitLocale(pathname)

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1', className)}>
      <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
      {locales.map((l) => (
        <Link
          key={l.code}
          href={localizePath(l.code, path)}
          hrefLang={l.htmlLang}
          lang={l.htmlLang}
          aria-current={l.code === locale ? 'true' : undefined}
          aria-label={l.label}
          className={cn(
            'rounded-md px-1.5 py-1 text-xs font-semibold transition-colors',
            l.code === locale ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l.shortLabel}
        </Link>
      ))}
    </nav>
  )
}
