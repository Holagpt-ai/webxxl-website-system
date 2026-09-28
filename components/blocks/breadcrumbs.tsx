import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { siteConfig } from '@/config/site'
import type { Locale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizePath } from '@/lib/i18n/localize'
import { cn } from '@/lib/utils'

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

export type Crumb = { label: string; href: string }

export function Breadcrumbs({ locale, items, className }: { locale: Locale; items: Crumb[]; className?: string }) {
  const dict = getDictionary(locale)
  const all = [{ label: dict.common.home, href: '/' }, ...items]

  return (
    <>
      <nav aria-label={dict.common.breadcrumb} className={cn('text-sm', className)}>
        <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          {all.map((item, i) => {
            const last = i === all.length - 1
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="font-medium text-foreground">
                    {item.label}
                  </span>
                ) : (
                  <>
                    <Link href={localizePath(locale, item.href)} className="hover:text-primary">
                      {item.label}
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: all.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.label,
            item: `${siteConfig.url}${localizePath(locale, item.href)}`,
          })),
        }}
      />
    </>
  )
}
