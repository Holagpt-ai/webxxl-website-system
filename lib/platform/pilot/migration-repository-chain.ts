import fs from 'node:fs'
import path from 'node:path'

/** All Prisma migration folder names under `prisma/migrations` (sorted, read-only inventory). */
export function allRepositoryMigrationFolders(cwd = process.cwd()): string[] {
  const migrationsDir = path.join(cwd, 'prisma', 'migrations')
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}
