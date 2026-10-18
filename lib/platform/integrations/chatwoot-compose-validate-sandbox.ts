import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SYNTHETIC_CHATWOOT_ENV_CONTENT = `SECRET_KEY_BASE=local-config-test-only-secret-key-base-minimum-sixty-four-characters-long!!
FRONTEND_URL=http://127.0.0.1:13000
`

export type OperationalEnvSnapshot = {
  path: string
  existed: boolean
  content: string | null
  mtimeMs: number | null
}

export function operationalChatwootEnvPath(repoRoot: string): string {
  return path.join(repoRoot, 'infra', 'services', 'chatwoot', '.env')
}

export function snapshotOperationalEnvFile(envPath: string): OperationalEnvSnapshot {
  if (!fs.existsSync(envPath)) {
    return { path: envPath, existed: false, content: null, mtimeMs: null }
  }
  const stat = fs.statSync(envPath)
  return {
    path: envPath,
    existed: true,
    content: fs.readFileSync(envPath, 'utf8'),
    mtimeMs: stat.mtimeMs,
  }
}

export function assertOperationalEnvUntouched(before: OperationalEnvSnapshot): void {
  const after = snapshotOperationalEnvFile(before.path)
  if (before.existed !== after.existed) {
    throw new Error(
      `Operational env ${before.path} existence changed (${before.existed} → ${after.existed})`,
    )
  }
  if (!before.existed) return
  if (before.content !== after.content) {
    throw new Error(`Operational env ${before.path} content was modified during validation`)
  }
  if (before.mtimeMs !== after.mtimeMs) {
    throw new Error(`Operational env ${before.path} mtime changed during validation`)
  }
}

export type ChatwootComposeValidateSandbox = {
  workDir: string
  composeFile: string
  cleanup: () => void
}

/** Isolated temp dir with compose copy + synthetic .env — never writes under infra/services/chatwoot/. */
export function createIsolatedChatwootComposeSandbox(repoRoot: string): ChatwootComposeValidateSandbox {
  const sourceCompose = path.join(repoRoot, 'infra', 'services', 'chatwoot', 'docker-compose.staging.yml')
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webxxl-chatwoot-compose-validate-'))
  const composeFile = path.join(workDir, 'docker-compose.staging.yml')
  fs.copyFileSync(sourceCompose, composeFile)
  fs.writeFileSync(path.join(workDir, '.env'), SYNTHETIC_CHATWOOT_ENV_CONTENT, 'utf8')
  return {
    workDir,
    composeFile,
    cleanup: () => {
      fs.rmSync(workDir, { recursive: true, force: true })
    },
  }
}
