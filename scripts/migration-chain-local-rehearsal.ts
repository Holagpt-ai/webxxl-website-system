#!/usr/bin/env tsx
/**
 * Disposable local Postgres — full `prisma migrate deploy` rehearsal (39 folders).
 * Optional dev install: `pnpm add -D embedded-postgres@18.6.0-beta.19` (not in CI/Vercel graph).
 * Does not touch staging/production.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

const require = createRequire(import.meta.url)

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string
  user: string
  password: string
  port: number
  persistent: boolean
}) => {
  initialise(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
}

function loadEmbeddedPostgres(): EmbeddedPostgresCtor {
  try {
    const mod = require('embedded-postgres') as { default: EmbeddedPostgresCtor }
    return mod.default
  } catch {
    console.error(
      'Missing optional devDependency "embedded-postgres". Install locally:\n  pnpm add -D embedded-postgres@18.6.0-beta.19\nThen re-run: pnpm migration:chain-rehearsal',
    )
    process.exit(1)
  }
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const DATA_DIR = path.join(process.cwd(), `.tmp-embedded-pg-rehearsal-${runId}`)
const PORT = 55432 + Math.floor(Math.random() * 100)

async function main() {
  const EmbeddedPostgres = loadEmbeddedPostgres()
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
    console.log(
      `Migration chain rehearsal OK: ${expected} folders deployed on embedded Postgres @ ${url.replace(/:[^:@]+@/, ':***@')}`,
    )
  } finally {
    await pg.stop()
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
