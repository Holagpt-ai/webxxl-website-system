#!/usr/bin/env tsx
/**
 * Disposable local Postgres — full `prisma migrate deploy` rehearsal (39 folders).
 * Requires devDependency `embedded-postgres`. Does not touch staging/production.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const DATA_DIR = path.join(process.cwd(), `.tmp-embedded-pg-rehearsal-${runId}`)
const PORT = 55432 + Math.floor(Math.random() * 100)

async function main() {
  const expected = allRepositoryMigrationFolders().length
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true })

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
  })

  await pg.initialise()
  await pg.start()

  const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url }

  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env, cwd: process.cwd() })
    const status = execSync('npx prisma migrate status', { encoding: 'utf8', env })
    if (status.includes('have not yet been applied')) {
      console.error('migrate status shows pending migrations after deploy')
      process.exitCode = 1
      return
    }
    console.log(`Migration chain rehearsal OK: ${expected} folders deployed on embedded Postgres @ ${url.replace(/:[^:@]+@/, ':***@')}`)
  } finally {
    await pg.stop()
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
