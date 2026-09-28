import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { siteConfig } from '@/config/site'
import { getLocaleConfig } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localeStaticParams, resolveLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import '../globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })

export const dynamicParams = false

export function generateStaticParams() {
  return localeStaticParams()
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await resolveLocale(params)
  return {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    ...buildMetadata({ locale, path: '/' }),
    icons: {
      icon: [
        { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
        { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const locale = await resolveLocale(params)
  const dict = getDictionary(locale)

  return (
    <html lang={getLocaleConfig(locale).htmlLang} className={`${jakarta.variable} bg-background`}>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader locale={locale} />
        <main id="main">{children}</main>
        <SiteFooter locale={locale} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
