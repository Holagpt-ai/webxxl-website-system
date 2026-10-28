import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { Section, SectionHeading, StatusPill } from './workspace-kit'

/** No settings API exists; this screen states the gaps instead of rendering dead controls. */
export function CrmSettings({ copy }: { copy: CrmWorkspaceCopy }) {
  const t = copy.settings
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <Section title={t.title}>
        <ul className="flex flex-col divide-y">
          {t.items.map((item) => (
            <li key={item.key} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
              <StatusPill label={item.state === 'deferred' ? t.deferred : t.notAvailable} tone="muted" />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
