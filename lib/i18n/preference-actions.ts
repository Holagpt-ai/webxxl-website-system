'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isLocale } from '@/lib/i18n/config'

/** Saves the signed-in user's language. Does not change CustomerAccount.locale. */
export async function setPreferredLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return
  const session = await auth()
  if (!session?.user?.id) return
  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferredLocale: locale },
  })
}
