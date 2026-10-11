import type { EffectiveCapability } from '@/lib/managed-sites/capabilities'
import { SiteCapabilityRequestForm } from '@/components/managed-sites/request-form'
import { SiteAiContentDraft, type SiteAiContentDraftDict } from '@/components/managed-sites/site-ai-content-draft'
import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'

type WebsiteChangesDict = {
  websiteChangesTitle: string
  websiteChangesReadOnlyHint: string
  websiteChangesHumanHint: string
  websiteChangesAiHint: string
  requestChange: string
  siteRequestPlaceholder: string
  changeSaved: string
  changeUnavailable: string
  changeEscalated: string
  aiDraftSaved: string
  projectRequired: string
}

export function SiteWebsiteChangesSection({
  capabilities,
  locale,
  siteId,
  connected,
  dict,
  messages,
  aiConfigured,
  aiContentDraft,
}: {
  capabilities: EffectiveCapability[]
  locale: string
  siteId: string
  connected: boolean
  dict: WebsiteChangesDict & SiteAiContentDraftDict
  messages: {
    saved: string
    unavailable: string
    escalated: string
    draft: string
    projectRequired: string
    failed: string
  }
  aiConfigured: boolean
  aiContentDraft: { changeId: string; requestText: string; draft: AiContentDraftV1 } | null
}) {
  if (capabilities.length === 0) return null
  const language = locale === 'es' ? 'es' : 'en'
  const portalLocale = locale === 'es' ? 'es' : 'en'

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{dict.websiteChangesTitle}</h2>
      <ul className="flex flex-col gap-6">
        {capabilities.map((item) => (
          <li key={item.key} className="border-b pb-6 last:border-b-0 last:pb-0">
            <p className="font-medium">{item.label[language]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description[language]}</p>
            {item.executionMode === 'READ_ONLY' && (
              <p className="mt-2 text-sm text-muted-foreground">{dict.websiteChangesReadOnlyHint}</p>
            )}
            {item.executionMode === 'HUMAN_REQUIRED' && (
              <p className="mt-2 text-sm text-muted-foreground">{dict.websiteChangesHumanHint}</p>
            )}
            {item.key === 'content.edit' && item.executionMode === 'AI_ASSISTED' ? (
              <SiteAiContentDraft
                siteId={siteId}
                locale={portalLocale}
                aiConfigured={aiConfigured}
                initialDraft={aiContentDraft}
                dict={dict}
              />
            ) : (
              (item.executionMode === 'SELF_SERVICE' || item.executionMode === 'HUMAN_REQUIRED') && (
                <SiteCapabilityRequestForm
                  siteId={siteId}
                  capabilityKey={item.key}
                  submitLabel={dict.requestChange}
                  placeholder={dict.siteRequestPlaceholder}
                  messages={messages}
                  disabled={!connected && item.executionMode === 'SELF_SERVICE'}
                  disabledMessage={dict.changeUnavailable}
                />
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
