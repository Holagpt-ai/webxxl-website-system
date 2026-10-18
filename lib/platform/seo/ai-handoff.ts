import type { SeoResult } from '@/lib/platform/seo/types'

/** SEO proposals cannot authorize production edits or bypass approval workflows. */
export function denySeoAutoPublish(input: {
  opportunityState: string
  hasApprovedManagedSiteChange: boolean
  agentToolGrantApproved: boolean
}): SeoResult<{ allowed: false }> {
  if (input.opportunityState === 'PUBLISHED' || input.opportunityState === 'VERIFIED_OUTCOME') {
    if (!input.hasApprovedManagedSiteChange) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'SEO opportunity cannot mark published without approved ManagedSiteChange',
      }
    }
  }
  if (input.agentToolGrantApproved && !input.hasApprovedManagedSiteChange) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Agent tool grant does not authorize production SEO publish',
    }
  }
  return { ok: true, value: { allowed: false } }
}

export function denyAiSelfAuthorizedSiteEdit(): SeoResult<true> {
  return { ok: false, code: 'FORBIDDEN', message: 'AI cannot self-authorize managed site edits' }
}
