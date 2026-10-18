import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertOperationalEnvUntouched,
  createIsolatedChatwootComposeSandbox,
  snapshotOperationalEnvFile,
} from '@/lib/platform/integrations/chatwoot-compose-validate-sandbox'

describe('INFRA-02B operational env safety', () => {
  it('preserves decoy operator .env while sandbox runs', () => {
    const decoyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webxxl-operator-env-decoy-'))
    const decoyEnv = path.join(decoyDir, '.env')
    const marker = `OPERATOR_MARKER_${Date.now()}_do_not_erase`
    fs.writeFileSync(decoyEnv, marker, 'utf8')
    const before = snapshotOperationalEnvFile(decoyEnv)

    const repoRoot = path.resolve(__dirname, '../..')
    const sandbox = createIsolatedChatwootComposeSandbox(repoRoot)
    sandbox.cleanup()

    expect(() => assertOperationalEnvUntouched(before)).not.toThrow()
    expect(fs.readFileSync(decoyEnv, 'utf8')).toBe(marker)
    fs.rmSync(decoyDir, { recursive: true, force: true })
  })

  it('sandbox .env lives outside infra/services/chatwoot', () => {
    const repoRoot = path.resolve(__dirname, '../..')
    const operationalDir = path.join(repoRoot, 'infra', 'services', 'chatwoot')
    const sandbox = createIsolatedChatwootComposeSandbox(repoRoot)
    expect(sandbox.workDir.startsWith(os.tmpdir())).toBe(true)
    expect(sandbox.workDir.includes(operationalDir)).toBe(false)
    expect(fs.existsSync(path.join(sandbox.workDir, '.env'))).toBe(true)
    sandbox.cleanup()
    expect(fs.existsSync(sandbox.workDir)).toBe(false)
  })
})
