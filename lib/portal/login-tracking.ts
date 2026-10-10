import { prisma } from '@/lib/db'

/** Best-effort login timestamp; returns false when persistence fails. */
export async function touchUserLastLogin(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    return true
  } catch {
    return false
  }
}
