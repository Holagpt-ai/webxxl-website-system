/**
 * Idempotent registration for the two known ABMED websites.
 *
 * Dry run:
 * corepack pnpm exec tsx scripts/register-abmed-managed-sites.ts --customer-account-id <id> --dry-run
 *
 * Apply after the managed-sites migration is deployed:
 * corepack pnpm exec tsx scripts/register-abmed-managed-sites.ts --customer-account-id <id>
 *
 * The customer account must already exist. This script does not create one and does not store credentials.
 */
import { prisma } from '@/lib/db'
import { registerAbmedManagedSites } from '@/lib/managed-sites/register-abmed'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const customerAccountId = arg('--customer-account-id')
  const customerSlug = arg('--customer-slug')
  if (!customerAccountId && !customerSlug) {
    console.error('Pass --customer-account-id <id> or --customer-slug <slug>.')
    process.exitCode = 1
    return
  }
  const account = customerAccountId
    ? await prisma.customerAccount.findUnique({ where: { id: customerAccountId }, select: { id: true, businessName: true } })
    : await prisma.customerAccount.findUnique({ where: { slug: customerSlug }, select: { id: true, businessName: true } })
  if (!account) {
    console.error('Customer account was not found. No sites were created.')
    process.exitCode = 1
    return
  }
  const result = await registerAbmedManagedSites({ customerAccountId: account.id, dryRun })
  console.log(JSON.stringify({ customer: account.businessName, dryRun, result }, null, 2))
  if (!result.ok) process.exitCode = 1
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Registration failed')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
