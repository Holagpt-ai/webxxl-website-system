'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Globe } from 'lucide-react'
import { locales, type Locale } from '@/lib/i18n/config'
import { switchLocaleHref } from '@/lib/i18n/localize'
import { setPreferredLocaleAction } from '@/lib/i18n/preference-actions'
import { cn } from '@/lib/utils'

function LanguageLinks({
  locale,
  label,
  className,
  persist = false,
  search,
}: {
  locale: Locale
  label: string
  className?: string
  persist?: boolean
  search: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1', className)}>
      <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
      {locales.map((l) => {
        const href = switchLocaleHref(pathname, search, l.code)
        return (
          <Link
            key={l.code}
            href={href}
            hrefLang={l.htmlLang}
            lang={l.htmlLang}
            aria-current={l.code === locale ? 'true' : undefined}
            aria-label={l.label}
            className={cn(
              'rounded-md px-1.5 py-1 text-xs font-semibold transition-colors',
              l.code === locale ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={(event) => {
              if (!persist || l.code === locale) return
              event.preventDefault()
              void (async () => {
                try {
                  await setPreferredLocaleAction(l.code)
                } catch {
                  // The URL choice still applies if the preference write fails.
                }
                router.push(href)
              })()
            }}
          >
            {l.shortLabel}
          </Link>
        )
      })}
    </nav>
  )
}

function LanguageSwitcherWithQuery(props: {
  locale: Locale
  label: string
  className?: string
  persist?: boolean
}) {
  const searchParams = useSearchParams()
  return <LanguageLinks {...props} search={searchParams.toString()} />
}

export function LanguageSwitcher(props: {
  locale: Locale
  label: string
  className?: string
  persist?: boolean
}) {
  return (
    <Suspense fallback={<LanguageLinks {...props} search="" />}>
      <LanguageSwitcherWithQuery {...props} />
    </Suspense>
  )
}
