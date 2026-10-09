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
    const res = NextResponse.redirect(url, 308)
    res.headers.set('x-pathname', url.pathname)
    return res
  }

  if ((localeCodes as string[]).includes(first)) {
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    return res
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
  url.search = search
  const res = NextResponse.rewrite(url)
  res.headers.set('x-pathname', pathname)
  return res
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\..*).*)'],
}
