'use client'

import { useState, useTransition } from 'react'
import type { AbmedRemoteCampaign } from '@/lib/managed-sites/abmed/control-client'
import { submitManagedSiteCampaignDraftAction } from '@/lib/managed-sites/customer-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type CampaignDict = {
  abmedCampaignsTitle: string
  abmedCampaignsEmpty: string
  abmedCampaignsUnavailable: string
  abmedCampaignDraftTitle: string
  abmedCampaignDraftHint: string
  abmedCampaignCreateDraft: string
  abmedCampaignEditDraft: string
  abmedCampaignDraftSaved: string
  abmedCampaignVersionConflict: string
  abmedCampaignFieldName: string
  abmedCampaignFieldSlug: string
  abmedCampaignFieldHeadline: string
  abmedCampaignFieldBody: string
  abmedCampaignFieldCtaText: string
  abmedCampaignFieldCtaDestination: string
  abmedCampaignFieldStartAt: string
  abmedCampaignFieldEndAt: string
  abmedCampaignFieldDelayMs: string
  abmedCampaignFieldFrequencyDays: string
  abmedCampaignFieldDeviceTargeting: string
}

export function SiteCampaignPanel({
  siteId,
  capabilityKey,
  campaigns,
  connected,
  dict,
}: {
  siteId: string
  capabilityKey: 'popups.manage' | 'campaigns.manage'
  campaigns: AbmedRemoteCampaign[]
  connected: boolean
  dict: CampaignDict
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [editTarget, setEditTarget] = useState<AbmedRemoteCampaign | null>(null)

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-sm font-medium">{dict.abmedCampaignsTitle}</p>
        {!connected ? (
          <p className="mt-1 text-sm text-muted-foreground">{dict.abmedCampaignsUnavailable}</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{dict.abmedCampaignsEmpty}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="rounded-md border p-3">
                <p className="font-medium">{campaign.name}</p>
                <p className="text-muted-foreground">
                  {campaign.status} · {campaign.derivedState} · v{campaign.currentVersion}
                </p>
                <p className="mt-1">{campaign.headline}</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.startAt ?? '—'} → {campaign.endAt ?? '—'} · {campaign.updatedAt}
                </p>
                {campaign.status === 'draft' && (
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setEditTarget(campaign)}>
                    {dict.abmedCampaignEditDraft}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        className="space-y-3 rounded-md border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const fields = {
            name: String(data.get('name') ?? ''),
            slug: String(data.get('slug') ?? ''),
            type: 'lead_capture',
            placement: 'homepage_popup',
            headline: String(data.get('headline') ?? ''),
            body: String(data.get('body') ?? ''),
            ctaText: String(data.get('ctaText') ?? ''),
            ctaDestination: String(data.get('ctaDestination') ?? 'lead:offer'),
            startAt: String(data.get('startAt') ?? '') || null,
            endAt: String(data.get('endAt') ?? '') || null,
            delayMs: Number(data.get('delayMs') ?? 4000),
            frequencyDays: Number(data.get('frequencyDays') ?? 30),
            deviceTargeting: String(data.get('deviceTargeting') ?? 'all'),
          }
          const action = editTarget ? 'update_campaign_draft' : 'create_campaign_draft'
          const structuredPayload = editTarget
            ? {
                action,
                remoteCampaignId: editTarget.id,
                expectedVersion: editTarget.currentVersion,
                fields,
              }
            : { action, fields }
          startTransition(async () => {
            setMessage(null)
            const result = await submitManagedSiteCampaignDraftAction(siteId, capabilityKey, structuredPayload)
            if (!result.ok) {
              setMessage(result.error === 'version_conflict' ? dict.abmedCampaignVersionConflict : dict.abmedCampaignsUnavailable)
              return
            }
            setMessage(dict.abmedCampaignDraftSaved)
            setEditTarget(null)
          })
        }}
      >
        <p className="text-sm font-medium">{dict.abmedCampaignDraftTitle}</p>
        <p className="text-xs text-muted-foreground">{dict.abmedCampaignDraftHint}</p>
        <Input name="name" placeholder={dict.abmedCampaignFieldName} defaultValue={editTarget?.name ?? ''} required />
        <Input name="slug" placeholder={dict.abmedCampaignFieldSlug} defaultValue={editTarget?.slug ?? ''} required={!editTarget} />
        <Input name="headline" placeholder={dict.abmedCampaignFieldHeadline} defaultValue={editTarget?.headline ?? ''} required />
        <Textarea name="body" placeholder={dict.abmedCampaignFieldBody} defaultValue={editTarget?.body ?? ''} required rows={3} />
        <Input name="ctaText" placeholder={dict.abmedCampaignFieldCtaText} defaultValue={editTarget?.ctaText ?? ''} required />
        <Input
          name="ctaDestination"
          placeholder={dict.abmedCampaignFieldCtaDestination}
          defaultValue={editTarget?.ctaDestination ?? 'lead:offer'}
          required
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input name="startAt" type="datetime-local" defaultValue={editTarget?.startAt?.slice(0, 16) ?? ''} />
          <Input name="endAt" type="datetime-local" defaultValue={editTarget?.endAt?.slice(0, 16) ?? ''} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input name="delayMs" type="number" defaultValue={editTarget?.delayMs ?? 4000} placeholder={dict.abmedCampaignFieldDelayMs} />
          <Input
            name="frequencyDays"
            type="number"
            defaultValue={editTarget?.frequencyDays ?? 30}
            placeholder={dict.abmedCampaignFieldFrequencyDays}
          />
          <Input name="deviceTargeting" defaultValue={editTarget?.deviceTargeting ?? 'all'} placeholder={dict.abmedCampaignFieldDeviceTargeting} />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {editTarget ? dict.abmedCampaignEditDraft : dict.abmedCampaignCreateDraft}
        </Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </form>
    </div>
  )
}
