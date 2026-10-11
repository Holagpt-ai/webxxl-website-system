export type AiContentDraftAction = 'replace' | 'rewrite' | 'add' | 'remove'

export type AiContentDraftV1 = {
  schemaVersion: 1
  summary: string
  proposedChanges: Array<{
    location: string
    action: AiContentDraftAction
    proposedText: string
    notes?: string
  }>
  assumptions: string[]
  clarifyingQuestions: string[]
}

export type AiProviderGenerateInput = {
  siteName: string
  siteDomain: string
  locale: 'en' | 'es'
  requestText: string
}

export type AiProviderResult =
  | { ok: true; draft: AiContentDraftV1 }
  | { ok: false; error: 'ai_not_configured' | 'ai_unavailable' | 'ai_invalid_output' }

export type ManagedSiteAiProvider = {
  generateContentDraft(input: AiProviderGenerateInput): Promise<AiProviderResult>
}
