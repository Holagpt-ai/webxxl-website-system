import type { ManagedSiteAiProvider } from '@/lib/managed-sites/ai/types'
import { createOpenAiCompatibleProvider } from '@/lib/managed-sites/ai/openai-compatible-provider'

export function isManagedSiteAiConfigured(): boolean {
  const provider = process.env.MANAGED_SITE_AI_PROVIDER?.trim()
  const baseUrl = process.env.MANAGED_SITE_AI_BASE_URL?.trim()
  const apiKey = process.env.MANAGED_SITE_AI_API_KEY?.trim()
  const model = process.env.MANAGED_SITE_AI_MODEL?.trim()
  return provider === 'openai-compatible' && Boolean(baseUrl && apiKey && model)
}

export function getManagedSiteAiProvider(): ManagedSiteAiProvider | null {
  if (!isManagedSiteAiConfigured()) return null
  const provider = process.env.MANAGED_SITE_AI_PROVIDER?.trim()
  if (provider === 'openai-compatible') {
    return createOpenAiCompatibleProvider({
      baseUrl: process.env.MANAGED_SITE_AI_BASE_URL!.trim().replace(/\/$/, ''),
      apiKey: process.env.MANAGED_SITE_AI_API_KEY!.trim(),
      model: process.env.MANAGED_SITE_AI_MODEL!.trim(),
    })
  }
  return null
}
