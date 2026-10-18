import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertOperationalEnvUntouched,
  createIsolatedChatwootComposeSandbox,
  operationalChatwootEnvPath,
  snapshotOperationalEnvFile,
} from '@/lib/platform/integrations/chatwoot-compose-validate-sandbox'
import {
  assertLocalhostOrNoPublish,
  assertNoFixedContainerNames,
  assertNoRunnableBaseService,
  type ComposeConfigJson,
} from '@/lib/platform/integrations/compose-effective-config'

const repoRoot = path.resolve(__dirname, '../..')
const servicesRoot = path.join(repoRoot, 'infra', 'services')

function dockerAvailable(): boolean {
  try {
    execSync('docker compose version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function composeConfigJson(
  args: string[],
  env: Record<string, string>,
  cwd: string,
): ComposeConfigJson {
  const quotedArgs = args.map((a) => (a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a))
  const result = execSync(`docker compose ${quotedArgs.join(' ')} config --format json`, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(result) as ComposeConfigJson
}

describe('INFRA-02A effective compose isolation', () => {
  it('chatwoot compose uses x-chatwoot-app anchor instead of runnable base service', () => {
    const yaml = fs.readFileSync(path.join(servicesRoot, 'chatwoot', 'docker-compose.staging.yml'), 'utf8')
    expect(yaml).toMatch(/x-chatwoot-app:/)
    expect(yaml).not.toMatch(/^  base:/m)
  })

  it('postiz overlay pins image and uses merge reset tags', () => {
    const yaml = fs.readFileSync(path.join(servicesRoot, 'postiz', 'docker-compose.staging.overlay.yml'), 'utf8')
    expect(yaml).toMatch(/ghcr\.io\/gitroomhq\/postiz-app:v2\.25\.1/)
    expect(yaml).toMatch(/ports: !reset \[\]/)
    expect(yaml).toMatch(/container_name: !reset null/)
  })

  it('paperclip override removes db host ports and overrides server port', () => {
    const yaml = fs.readFileSync(path.join(servicesRoot, 'paperclip', 'docker-compose.staging.override.yml'), 'utf8')
    expect(yaml).toContain('ports: !reset []')
    expect(yaml).toContain('PAPERCLIP_POSTGRES_PASSWORD:?Set PAPERCLIP_POSTGRES_PASSWORD on host')
    expect(yaml).toMatch(/127\.0\.0\.1:13100:3100/)
  })

  it('compose-effective-config helpers detect public bindings', () => {
    const bad: ComposeConfigJson = {
      services: {
        app: { ports: [{ published: '8080', host_ip: '' }] },
      },
    }
    expect(assertLocalhostOrNoPublish(bad, 'app')).toMatch(/non-localhost/)
    const good: ComposeConfigJson = {
      services: {
        app: { ports: [{ published: '14007', host_ip: '127.0.0.1' }] },
      },
    }
    expect(assertLocalhostOrNoPublish(good, 'app')).toBeNull()
  })

  it('chatwoot validation sandbox does not modify operational .env', () => {
    const operational = operationalChatwootEnvPath(repoRoot)
    const before = snapshotOperationalEnvFile(operational)
    const sandbox = createIsolatedChatwootComposeSandbox(repoRoot)
    expect(fs.existsSync(path.join(sandbox.workDir, '.env'))).toBe(true)
    expect(fs.existsSync(operational)).toBe(before.existed)
    sandbox.cleanup()
    expect(() => assertOperationalEnvUntouched(before)).not.toThrow()
  })

  const canDocker = dockerAvailable()

  it.runIf(canDocker)('merged paperclip config has no db host ports', () => {
    const cfg = composeConfigJson(
      [
        '-f',
        path.join(servicesRoot, 'paperclip/fixtures/upstream.docker-compose.yml'),
        '-f',
        path.join(servicesRoot, 'paperclip/docker-compose.staging.override.yml'),
      ],
      {
        BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PAPERCLIP_TOOL_ACTION_SIGNING_SECRET:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PAPERCLIP_POSTGRES_USER: 'paperclip',
        PAPERCLIP_POSTGRES_PASSWORD: 'local-config-test-only',
      },
      repoRoot,
    )
    expect(cfg.name).toBe('webxxl-stg-paperclip')
    expect(cfg.services?.db?.ports ?? []).toHaveLength(0)
    expect(assertLocalhostOrNoPublish(cfg, 'server')).toBeNull()
  })

  it.runIf(canDocker)('merged postiz config clears fixed container names and public ports', () => {
    const cfg = composeConfigJson(
      [
        '-f',
        path.join(servicesRoot, 'postiz/fixtures/upstream.docker-compose.yaml'),
        '-f',
        path.join(servicesRoot, 'postiz/docker-compose.staging.overlay.yml'),
      ],
      {
        POSTIZ_JWT_SECRET: 'local-config-test-only-jwt',
        POSTIZ_DATABASE_URL: 'postgresql://postiz:local-config-test-only@postiz-postgres:5432/postiz',
        POSTIZ_POSTGRES_PASSWORD: 'local-config-test-only',
        POSTIZ_POSTGRES_USER: 'postiz-user',
        POSTIZ_POSTGRES_DB: 'postiz-db-local',
        TEMPORAL_POSTGRES_PASSWORD: 'local-config-test-only',
      },
      repoRoot,
    )
    expect(cfg.name).toBe('webxxl-stg-postiz')
    expect(assertNoFixedContainerNames(cfg)).toBeNull()
    expect(assertLocalhostOrNoPublish(cfg, 'postiz')).toBeNull()
    expect(cfg.services?.temporal?.ports ?? []).toHaveLength(0)
    expect(cfg.services?.['temporal-ui']?.ports ?? []).toHaveLength(0)
  })

  it.runIf(canDocker)('chatwoot effective config uses temp sandbox and preserves operational .env', () => {
    const operational = operationalChatwootEnvPath(repoRoot)
    const before = snapshotOperationalEnvFile(operational)
    const sandbox = createIsolatedChatwootComposeSandbox(repoRoot)
    try {
      const cfg = composeConfigJson(['-f', sandbox.composeFile], {
        POSTGRES_PASSWORD: 'local-config-test-only',
        REDIS_PASSWORD: 'local-config-test-only',
      }, sandbox.workDir)
      expect(assertNoRunnableBaseService(cfg)).toBeNull()
      expect(assertLocalhostOrNoPublish(cfg, 'rails')).toBeNull()
      expect(cfg.services?.postgres?.ports ?? []).toHaveLength(0)
      expect(cfg.services?.redis?.ports ?? []).toHaveLength(0)
    } finally {
      sandbox.cleanup()
    }
    assertOperationalEnvUntouched(before)
  })

  it.runIf(!canDocker)('marks effective docker compose verification pending when docker unavailable', () => {
    expect(canDocker).toBe(false)
  })
})
