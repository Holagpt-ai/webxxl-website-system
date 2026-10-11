import { prisma } from '@/lib/db'

export function slugifyBusinessName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'customer'
}

export async function allocateUniqueCustomerSlug(businessName: string): Promise<string> {
  const base = slugifyBusinessName(businessName)
  let candidate = base
  let suffix = 0
  while (await prisma.customerAccount.findUnique({ where: { slug: candidate } })) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}
