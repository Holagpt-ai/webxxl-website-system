import { buildAiContentDraftSystemPrompt, buildAiContentDraftUserPrompt } from '@/lib/managed-sites/ai/prompt'
import { parseAiContentDraftV1 } from '@/lib/managed-sites/ai/schema'
import type { AiProviderGenerateInput, AiProviderResult, ManagedSiteAiProvider } from '@/lib/managed-sites/ai/types'

const TIMEOUT_MS = 15_000

export const MAX_RESPONSE_CHARS = 20_000
export const MANAGED_SITE_AI_MAX_TOKENS = 2500

/** Provider output must be raw JSON only — no markdown fences or surrounding prose. */
export function parseStrictProviderJsonContent(text: string): unknown {
  return JSON.parse(text.trim())
}

export function createOpenAiCompatibleProvider(config: {
  baseUrl: string
  apiKey: string
  model: string
}): ManagedSiteAiProvider {
  return {
    async generateContentDraft(input: AiProviderGenerateInput): Promise<AiProviderResult> {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            n: 1,
            max_tokens: MANAGED_SITE_AI_MAX_TOKENS,
            messages: [
              { role: 'system', content: buildAiContentDraftSystemPrompt(input.locale) },
              {
                role: 'user',
                content: buildAiContentDraftUserPrompt({
                  siteName: input.siteName,
                  siteDomain: input.siteDomain,
                  requestText: input.requestText,
                }),
              },
            ],
          }),
          signal: controller.signal,
        })
        if (!response.ok) return { ok: false, error: 'ai_unavailable' }
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = payload.choices?.[0]?.message?.content
        if (!content) return { ok: false, error: 'ai_invalid_output' }
        if (content.length > MAX_RESPONSE_CHARS) return { ok: false, error: 'ai_invalid_output' }
        let parsed: unknown
        try {
          parsed = parseStrictProviderJsonContent(content)
        } catch {
          return { ok: false, error: 'ai_invalid_output' }
        }
        const draft = parseAiContentDraftV1(parsed)
        if (!draft) return { ok: false, error: 'ai_invalid_output' }
        return { ok: true, draft }
      } catch {
        return { ok: false, error: 'ai_unavailable' }
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
