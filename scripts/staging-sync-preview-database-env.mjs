#!/usr/bin/env node
/**
 * Batch 8C.2 — sync DATABASE_URL + DIRECT_URL from gitignored .env.staging.local
 * to Vercel Preview only (never Production). Does not print secret values.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { platform } from 'node:os'

const STAGING_REF = 'vcgibefnhneaqhcguhnt'
const PROD_REF = 'txfxeehglqfszletuumn'
const ENV_FILE = resolve(process.cwd(), '.env.staging.local')
const PREVIEW = 'preview'

function parseEnvFile(filePath) {
  const out = {}
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

function assertStagingUrl(name, url) {
  if (!url || !url.includes(`postgres.${STAGING_REF}`)) {
    throw new Error(`${name} must use Session pooler user postgres.${STAGING_REF}`)
  }
  if (url.includes(PROD_REF)) {
    throw new Error(`${name} must not reference production ref ${PROD_REF}`)
  }
  if (!url.includes('pooler.supabase.com:5432')) {
    throw new Error(`${name} must use Session pooler :5432`)
  }
}

/** Windows Node spawn needs `npx.cmd`; bare `npx` raises ENOENT. */
function vercelNpxCommand() {
  return platform() === 'win32' ? 'npx.cmd' : 'npx'
}

function vercelEnvSet(name, value) {
  const isWin = platform() === 'win32'
  execFileSync(
    vercelNpxCommand(),
    ['vercel@65.15.0', 'env', 'add', name, PREVIEW, '--force', '--sensitive'],
    {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      cwd: process.cwd(),
      // .cmd launchers on Windows require a shell when piping stdin.
      shell: isWin,
    },
  )
}

function main() {
  if (!existsSync(ENV_FILE)) {
    console.error('.env.staging.local missing — update DATABASE_URL and DIRECT_URL after Supabase reset.')
    process.exit(1)
  }
  const env = parseEnvFile(ENV_FILE)
  const databaseUrl = env.DATABASE_URL
  const directUrl = env.DIRECT_URL

  assertStagingUrl('DATABASE_URL', databaseUrl)
  assertStagingUrl('DIRECT_URL', directUrl)
  if (databaseUrl !== directUrl) {
    throw new Error('DATABASE_URL and DIRECT_URL must match for this staging binding')
  }

  const identity = env.WEBXXL_STAGING_DATABASE_IDENTITY
  if (identity !== `supabase:${STAGING_REF}/postgres`) {
    throw new Error('WEBXXL_STAGING_DATABASE_IDENTITY must stay supabase:vcgibefnhneaqhcguhnt/postgres')
  }

  console.log('Updating Vercel Preview DATABASE_URL and DIRECT_URL (staging ref only, secrets not logged).')
  vercelEnvSet('DATABASE_URL', databaseUrl)
  vercelEnvSet('DIRECT_URL', directUrl)
  console.log('Vercel Preview database env sync complete.')
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
