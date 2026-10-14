import { describe, expect, it } from 'vitest'
import { ABMED_CLINICAL_RESEARCH_PREVIEW } from '@/lib/website-preview/catalog'
import { getWebxxlReleaseConfigStatus } from '@/lib/release-config'

describe('batch28 WebXXL release config', () => {
  it('tracks latest ABMED catalog deployment for registration', () => {
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.versionLabel).toBe('b05e0a6')
    expect(ABMED_CLINICAL_RESEARCH_PREVIEW.deploymentId).toMatch(/^dpl_/)
  })

  it('reports non-secret configuration presence', () => {
    const status = getWebxxlReleaseConfigStatus()
    expect(Object.values(status).every((v) => typeof v === 'boolean')).toBe(true)
  })
})
