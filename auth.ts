import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Email from 'next-auth/providers/email'
import { prisma } from '@/lib/db'
import { sendMagicLinkEmail } from '@/lib/integrations/email'
import {
  getActiveCustomerAccountIdFromCookie,
  pickActiveMembership,
} from '@/lib/portal/active-customer-account'
import { touchUserLastLogin } from '@/lib/portal/login-tracking'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      emailVerified?: Date | null
      name?: string | null
      role: UserRole
      customerAccountId?: string | null
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      // SMTP settings are unused — magic links are sent via Resend in sendVerificationRequest.
      server: { host: 'localhost', port: 25, auth: { user: 'unused', pass: 'unused' } },
      from: process.env.AUTH_FROM_EMAIL ?? process.env.LEADS_FROM_EMAIL ?? 'onboarding@resend.dev',
      sendVerificationRequest: async ({ identifier, url }) => {
        const result = await sendMagicLinkEmail(identifier, url)
        if (!result.ok) throw new Error('AUTH_EMAIL_UNAVAILABLE')
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login?checkEmail=1',
  },
  session: { strategy: 'database' },
  events: {
    async signIn({ user }) {
      if (!user.id) return
      await touchUserLastLogin(user.id)
    },
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        include: { memberships: { take: 1 } },
      })
      if (!dbUser) return false
      if (dbUser.role === 'CUSTOMER' && dbUser.memberships.length === 0) return false
      return true
    },
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, role: true },
      })
      const memberships = await prisma.customerMembership.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        include: { customerAccount: true },
      })
      let membership = memberships[0] ?? null
      if (memberships.length > 0) {
        const cookieAccountId = await getActiveCustomerAccountIdFromCookie()
        membership = pickActiveMembership(memberships, cookieAccountId).membership
      }
      session.user = {
        id: user.id,
        email: dbUser?.email ?? user.email!,
        emailVerified: user.emailVerified ?? null,
        name: dbUser?.name ?? user.name,
        role: (dbUser?.role ?? 'CUSTOMER') as UserRole,
        customerAccountId: membership?.customerAccountId ?? null,
      }
      return session
    },
  },
  trustHost: true,
})
