import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, localeCodes } from '@/lib/i18n/config'

/**
 * Locale routing:
 *  - /es/...           → served by app/[locale] with locale "es"
 *  - /en/...           → redirected to the unprefixed URL (English is the default)
 *  - everything else   → internally rewritten to /en/...
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const [, first] = pathname.split('/')

  if (first === defaultLocale) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.slice(defaultLocale.length + 1) || '/'
    return NextResponse.redirect(url, 308)
  }

  if ((localeCodes as string[]).includes(first)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
  url.search = search
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\..*).*)'],
}
