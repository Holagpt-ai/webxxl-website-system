import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ISOLATED_SERVICE_DESCRIPTORS,
  assertStagingComposeProject,
  readIsolatedServiceEnv,
} from '@/lib/platform/integrations/isolated-services'
import { validateChatwootMappings } from '@/lib/platform/integrations/chatwoot-account-mapping'

const repoRoot = path.resolve(__dirname, '../..')
const servicesRoot = path.join(repoRoot, 'infra', 'services')

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

describe('INFRA-02 static infrastructure validation', () => {
  it('defines isolated compose project names', () => {
    expect(ISOLATED_SERVICE_DESCRIPTORS.map((d) => d.composeProject)).toEqual([
      'webxxl-stg-chatwoot',
      'webxxl-stg-postiz',
      'webxxl-stg-paperclip',
      'n/a-existing-deployment',
    ])
  })

  it('rejects shared Chatwoot account across customer accounts', () => {
    const result = validateChatwootMappings([
      {
        customerAccountId: 'acct-a',
        billingGroupId: 'group-1',
        chatwootAccountId: 'cw-1',
        chatwootInboxIds: ['inbox-a'],
        isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
      },
      {
        customerAccountId: 'acct-b',
        billingGroupId: 'group-1',
        chatwootAccountId: 'cw-1',
        chatwootInboxIds: ['inbox-b'],
        isolationPolicy: 'DEDICATED_CHATWOOT_ACCOUNT',
      },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SHARED_CHATWOOT_ACCOUNT')
  })

  it('has no Stocksist references in compose/scripts/examples', () => {
    const files = walkFiles(servicesRoot).filter((f) => {
      const base = path.basename(f)
      if (base.startsWith('validate-config')) return false
      return /\.(yml|yaml|ps1|sh|example)$/.test(f) || f.endsWith('env.example')
    })
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      expect(text.toLowerCase()).not.toContain('stocksist')
    }
  })

  it('pins chatwoot CE image tag in staging compose', () => {
    const compose = fs.readFileSync(path.join(servicesRoot, 'chatwoot', 'docker-compose.staging.yml'), 'utf8')
    expect(compose).toMatch(/chatwoot\/chatwoot:v4\.18\.0-ce/)
    expect(compose).toMatch(/name:\s*webxxl-stg-chatwoot/)
  })

  it('example env files contain no credential patterns', () => {
    const examples = walkFiles(servicesRoot).filter((f) => f.endsWith('.example') || f.endsWith('env.example'))
    const secretPattern = /(sk_live_|sk-ant-|postgresql:\/\/[^:]+:(?!.*PLACEHOLDER)[^@]+@)/i
    for (const file of examples) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(secretPattern)
    }
  })

  it('staging project guard rejects unknown docker project names', () => {
    expect(assertStagingComposeProject('chatwoot', 'webxxl-stg-chatwoot')).toBe(true)
    expect(assertStagingComposeProject('chatwoot', 'default')).toBe(false)
  })

  it('readIsolatedServiceEnv returns localhost defaults', () => {
    const env = readIsolatedServiceEnv()
    expect(env.chatwootBaseUrl).toContain('127.0.0.1')
    expect(env.postizProductionCandidateUrl).toContain('app.webbxxl.com')
  })
})
