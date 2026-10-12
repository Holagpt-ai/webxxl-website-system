import { prisma } from '@/lib/db'
import { defaultLocale, type Locale } from '@/lib/i18n/config'
import { parsePreferredLocale } from '@/lib/i18n/preference'

/** Recipient language from User.preferredLocale only. */
export async function preferredLocaleForUser(userId: string | null | undefined): Promise<Locale> {
  if (!userId) return defaultLocale
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  })
  return parsePreferredLocale(user?.preferredLocale)
}
