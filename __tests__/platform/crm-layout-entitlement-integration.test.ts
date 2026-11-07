import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('CRM layout entitlement integration (Issue #105)', () => {
  it('hides workspace chrome and child routes unless entitlement is eligible', () => {
    const layout = read('app/[locale]/dashboard/crm/layout.tsx')
    const locked = read('components/crm/crm-locked-state.tsx')

    expect(layout).toContain('resolveCrmPageEntitlement')
    expect(layout).toContain('!entitlement.renderWorkspace || entitlement.state !== \'eligible\'')
    expect(layout).toContain('crmPageLockedCopy')
    expect(layout).toContain('<CrmLockedState')

    const gatedBlock = layout.split('if (!entitlement.renderWorkspace')[1]?.split('const base = crmBase')[0] ?? ''
    expect(gatedBlock).not.toContain('{children}')
    expect(gatedBlock).not.toContain('WorkspaceSubnav')
    expect(gatedBlock).not.toContain('WorkspaceIntro')

    const eligibleBlock = layout.split('const base = crmBase')[1] ?? ''
    expect(eligibleBlock).toContain('entitlement.showIncludedFreeBadge')
    expect(eligibleBlock).toContain('<WorkspaceSubnav')
    expect(eligibleBlock).toContain('{children}')

    expect(locked).toContain('data-crm-gate')
    expect(locked).not.toContain('use client')
    expect(locked).not.toMatch(/fetch\(/)
  })
})
