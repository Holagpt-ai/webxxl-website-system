'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyNote, LoadingRows, Section } from '@/components/commerce/ui'
import {
  Facts,
  FormActions,
  SelectField,
  SuccessNote,
  TextAreaField,
  TextField,
  WorkspaceState,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, asStringArray, fill, formatDate, splitList, workspaceSend } from '@/lib/crm-ui/workspace'
import { MKT_API, type BrandContextVersion } from '@/lib/marketing-studio-ui/types'
import type { MarketingViewProps } from '@/lib/marketing-studio-ui/server'
import { flagBody } from './shared'

export function BrandContextSection({ accountId, locale, copy, sites }: MarketingViewProps) {
  const b = copy.brand
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const versions = useWorkspace<{ versions: BrandContextVersion[] }>(siteId ? MKT_API.brandContext(siteId) : null, accountId)

  if (!sites.length) return null
  const latest = versions.data?.versions[0]

  return (
    <Section title={b.title} description={b.description}>
      <div className="flex flex-col gap-5">
        <div className="max-w-sm">
          <SelectField
            label={b.site}
            value={siteId}
            onChange={setSiteId}
            options={sites.map((s) => ({ value: s.id, label: s.domain ?? s.name }))}
          />
        </div>
        {versions.isLoading ? (
          <LoadingRows label={copy.kit.loading} rows={2} />
        ) : versions.error ? (
          <WorkspaceState error={versions.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => versions.mutate()} />
        ) : !latest ? (
          <EmptyNote>{b.empty}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              {fill(b.version, { number: latest.versionNumber })} · {formatDate(latest.createdAt, locale)}
            </p>
            <Facts
              items={[
                [b.businessName, latest.businessName],
                [b.audience, latest.audience ?? DASH],
                [b.tone, latest.brandTone ?? DASH],
                [b.services, asStringArray(latest.approvedServices).join(', ') || DASH],
                [b.claims, asStringArray(latest.approvedClaims).join(', ') || DASH],
              ]}
            />
          </div>
        )}
        {siteId && (
          <BrandContextForm
            key={`${siteId}-${latest?.id ?? 'none'}`}
            siteId={siteId}
            latest={latest}
            copy={copy}
            locale={locale}
            onSaved={() => versions.mutate()}
          />
        )}
      </div>
    </Section>
  )
}

function BrandContextForm({
  siteId,
  latest,
  copy,
  locale,
  onSaved,
}: {
  siteId: string
  latest: BrandContextVersion | undefined
  copy: MarketingViewProps['copy']
  locale: string
  onSaved: () => void
}) {
  const b = copy.brand
  const [businessName, setBusinessName] = useState(latest?.businessName ?? '')
  const [audience, setAudience] = useState(latest?.audience ?? '')
  const [tone, setTone] = useState(latest?.brandTone ?? '')
  const [services, setServices] = useState(asStringArray(latest?.approvedServices).join(', '))
  const [claims, setClaims] = useState(asStringArray(latest?.approvedClaims).join(', '))
  const action = useAction<{ version: BrandContextVersion }>()

  return (
    <form
      className="flex flex-col gap-4 border-t pt-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const result = await action.run(() =>
          workspaceSend<{ version: BrandContextVersion }>(MKT_API.brandContext(siteId), {
            businessName: businessName.trim(),
            audience: audience.trim() || undefined,
            brandTone: tone.trim() || undefined,
            approvedServices: splitList(services),
            approvedClaims: splitList(claims),
            locale: locale === 'es' ? 'es' : 'en',
          }),
        )
        if (result.ok) onSaved()
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label={b.businessName} value={businessName} onChange={setBusinessName} required />
        <TextField label={b.audience} value={audience} onChange={setAudience} />
        <TextField label={b.tone} value={tone} onChange={setTone} />
        <TextField label={b.services} hint={b.servicesHint} value={services} onChange={setServices} />
      </div>
      <TextAreaField label={b.claims} hint={b.claimsHint} value={claims} onChange={setClaims} rows={3} />
      {action.data?.version && <SuccessNote>{fill(b.saved, { number: action.data.version.versionNumber })}</SuccessNote>}
      {action.error && (
        <WorkspaceState
          error={action.error}
          kit={copy.kit}
          workspace={copy.name}
          body={flagBody(action.error, copy.flags.draftPreparation)}
          compact
        />
      )}
      <FormActions>
        <Button type="submit" disabled={action.pending || !businessName.trim()}>
          {action.pending ? copy.kit.saving : b.save}
        </Button>
      </FormActions>
    </form>
  )
}
