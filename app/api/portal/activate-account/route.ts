import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { setActiveCustomerAccountCookie } from '@/lib/portal/active-customer-account'
import { magicLinkRedirectForLocale } from '@/lib/portal/auth-redirect'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')?.trim()
  const locale = searchParams.get('locale') === 'es' ? 'es' : 'en'

  if (!accountId) {
    return NextResponse.redirect(new URL(magicLinkRedirectForLocale(locale), request.url))
  }

  const membership = await prisma.customerMembership.findUnique({
    where: {
      userId_customerAccountId: { userId: session.user.id, customerAccountId: accountId },
    },
  })
  if (!membership) {
    return NextResponse.redirect(new URL(magicLinkRedirectForLocale(locale), request.url))
  }

  await setActiveCustomerAccountCookie(accountId)
  return NextResponse.redirect(new URL(magicLinkRedirectForLocale(locale), request.url))
}
