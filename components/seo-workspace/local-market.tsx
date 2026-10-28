'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  EmptyNote,
  FormActions,
  LoadingRows,
  PlainTable,
  Section,
  SuccessNote,
  TextAreaField,
  TextField,
  WorkspaceState,
  td,
} from '@/components/crm/workspace-kit'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { DASH, fill, formatDate, formatNumber, splitList, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  SEO_API,
  type CompetitorMarket,
  type CompetitorProfile,
  type CreateMarketResult,
} from '@/lib/seo-workspace-ui/types'
import type { SeoViewProps } from '@/lib/seo-workspace-ui/server'
import { SiteBar, useSelectedSite } from './shared'

export function SeoLocalMarketView({ accountId, locale, copy, sites }: SeoViewProps) {
  const siteId = useSelectedSite(sites)
  const res = useWorkspace<{ markets: CompetitorMarket[]; competitors: CompetitorProfile[] }>(
    siteId ? SEO_API.competitors(siteId) : null,
    accountId,
  )
  const l = copy.local
  const kit = copy.kit

  return (
    <SiteBar sites={sites} siteId={siteId} kit={kit}>
      {res.isLoading ? (
        <LoadingRows label={kit.loading} rows={4} />
      ) : res.error ? (
        <WorkspaceState error={res.error} kit={kit} workspace={copy.name} onRetry={() => res.mutate()} />
      ) : res.data ? (
        <>
          <Section title={l.marketsTitle} description={l.marketsBody}>
            {!res.data.markets.length ? (
              <EmptyNote>{l.noMarkets}</EmptyNote>
            ) : (
              <PlainTable label={l.marketsTitle} headers={[l.name, l.category, l.radius, l.language, l.created]}>
                {res.data.markets.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.name}</td>
                    <td className={td}>{m.category}</td>
                    <td className={td}>{m.radiusKm === null ? DASH : formatNumber(m.radiusKm, locale, 1)}</td>
                    <td className={td}>{m.language}</td>
                    <td className={td}>{formatDate(m.createdAt, locale)}</td>
                  </tr>
                ))}
              </PlainTable>
            )}
          </Section>
          <Section title={l.competitorsTitle} description={l.competitorsBody}>
            {!res.data.competitors.length ? (
              <EmptyNote>{l.noCompetitors}</EmptyNote>
            ) : (
              <PlainTable label={l.competitorsTitle} headers={[l.competitor, l.score, l.source, l.evidence]}>
                {res.data.competitors.map((c) => (
                  <tr key={c.id}>
                    <td className={td}>{c.displayName}</td>
                    <td className={td}>{formatNumber(c.rankScore, locale, 2)}</td>
                    <td className={td}>{c.source}</td>
                    <td className={`${td} break-all`}>{c.evidenceRef ?? DASH}</td>
                  </tr>
                ))}
              </PlainTable>
            )}
          </Section>
        </>
      ) : null}
      {siteId && <CreateMarket key={siteId} siteId={siteId} copy={copy} onCreated={() => res.mutate()} />}
    </SiteBar>
  )
}

function CreateMarket({ siteId, copy, onCreated }: { siteId: string; copy: SeoViewProps['copy']; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [services, setServices] = useState('')
  const [radius, setRadius] = useState('')
  const [themes, setThemes] = useState('')
  const [candidates, setCandidates] = useState('')
  const [invalid, setInvalid] = useState(false)
  const create = useAction<CreateMarketResult>()
  const l = copy.local
  const kit = copy.kit

  return (
    <Section title={l.createTitle} description={l.createBody}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !category.trim()) {
            setInvalid(true)
            return
          }
          setInvalid(false)
          const radiusKm = Number(radius)
          const result = await create.run(() =>
            workspaceSend<CreateMarketResult>(SEO_API.markets(siteId), {
              name: name.trim(),
              category: category.trim(),
              services: splitList(services),
              radiusKm: radius.trim() && Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : undefined,
              keywordThemes: splitList(themes),
              candidateCompetitors: candidates
                .split('\n')
                .map((c) => c.trim())
                .filter(Boolean)
                .map((displayName) => ({ displayName })),
            }),
          )
          if (result.ok) onCreated()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={l.name} value={name} onChange={setName} required />
          <TextField label={l.category} value={category} onChange={setCategory} required />
          <TextField label={l.services} value={services} onChange={setServices} hint={kit.optional} />
          <TextField label={l.radius} type="number" value={radius} onChange={setRadius} hint={kit.optional} />
        </div>
        <TextField label={l.keywordThemes} value={themes} onChange={setThemes} hint={kit.optional} />
        <TextAreaField label={l.candidates} value={candidates} onChange={setCandidates} hint={kit.optional} rows={4} />
        {invalid && (
          <p role="alert" className="text-sm text-destructive">
            {l.required}
          </p>
        )}
        {create.data && <SuccessNote>{fill(l.created_, { count: create.data.competitors.length })}</SuccessNote>}
        {create.error && <WorkspaceState error={create.error} kit={kit} workspace={copy.name} compact />}
        <FormActions>
          <Button type="submit" disabled={create.pending}>
            {create.pending ? l.creating : l.create}
          </Button>
        </FormActions>
      </form>
    </Section>
  )
}
