import { buildAiContentDraftSystemPrompt, buildAiContentDraftUserPrompt } from '@/lib/managed-sites/ai/prompt'
import { parseAiContentDraftV1 } from '@/lib/managed-sites/ai/schema'
import type { AiProviderGenerateInput, AiProviderResult, ManagedSiteAiProvider } from '@/lib/managed-sites/ai/types'

const TIMEOUT_MS = 15_000

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim())
    }
    throw new Error('invalid_json')
  }
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
        let parsed: unknown
        try {
          parsed = extractJsonObject(content)
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
