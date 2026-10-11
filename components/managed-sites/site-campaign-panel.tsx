'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { AbmedRemoteCampaign } from '@/lib/managed-sites/abmed/control-client'
import {
  buildCampaignStructuredPayload,
  campaignToFormFields,
  emptyCampaignFormFields,
  formatCampaignCustomerState,
  type CampaignFormFields,
  type DeviceTargetValue,
} from '@/lib/managed-sites/customer-presentation'
import { submitManagedSiteCampaignDraftAction } from '@/lib/managed-sites/customer-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type SiteCampaignPanelDict = {
  abmedCampaignsEmpty: string
  abmedCampaignsUnavailable: string
  abmedCampaignVersionConflict: string
  campaignNotEditable: string
  campaignCreateModeTitle: string
  campaignEditModeTitle: string
  campaignSubmitCreate: string
  campaignSubmitEdit: string
  campaignSubmitSuccess: string
  campaignShowAfterSeconds: string
  campaignShowAgainAfterDays: string
  campaignAudienceDevice: string
  campaignAdvancedSettings: string
  campaignIdentifierLabel: string
  campaignIdentifierHelp: string
  campaignButtonDestination: string
  campaignButtonText: string
  campaignMessage: string
  campaignStartDateTime: string
  campaignEndDateTime: string
  abmedCampaignFieldName: string
  abmedCampaignFieldHeadline: string
  abmedCampaignEditDraft: string
  campaignDetailsToggle: string
  campaignVersion: string
  campaignLastUpdated: string
  campaignSchedule: string
  cancelEdit: string
  deviceAll: string
  deviceDesktop: string
  deviceMobile: string
  campaignStateDraft: string
  campaignStatePendingApproval: string
  campaignStateScheduled: string
  campaignStateLive: string
  campaignStatePaused: string
  campaignStateEnded: string
  campaignStateArchived: string
  campaignStateApprovedNotLive: string
  campaignStateUnknown: string
}

export function SiteCampaignPanel({
  siteId,
  capabilityKey,
  campaigns,
  connected,
  canWrite,
  dict,
}: {
  siteId: string
  capabilityKey: 'popups.manage' | 'campaigns.manage'
  campaigns: AbmedRemoteCampaign[]
  connected: boolean
  canWrite: boolean
  dict: SiteCampaignPanelDict
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [editTarget, setEditTarget] = useState<AbmedRemoteCampaign | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<CampaignFormFields>(() => emptyCampaignFormFields())

  const stateLabels = useMemo(
    () => ({
      campaignStateDraft: dict.campaignStateDraft,
      campaignStatePendingApproval: dict.campaignStatePendingApproval,
      campaignStateScheduled: dict.campaignStateScheduled,
      campaignStateLive: dict.campaignStateLive,
      campaignStatePaused: dict.campaignStatePaused,
      campaignStateEnded: dict.campaignStateEnded,
      campaignStateArchived: dict.campaignStateArchived,
      campaignStateApprovedNotLive: dict.campaignStateApprovedNotLive,
      campaignStateUnknown: dict.campaignStateUnknown,
    }),
    [dict],
  )

  useEffect(() => {
    setForm(editTarget ? campaignToFormFields(editTarget) : emptyCampaignFormFields())
  }, [editTarget])

  function beginEdit(campaign: AbmedRemoteCampaign) {
    setMessage(null)
    setEditTarget(campaign)
  }

  function cancelEdit() {
    setMessage(null)
    setEditTarget(null)
  }

  const showForm = connected && canWrite

  return (
    <div className="space-y-6">
      {!connected ? (
        <p className="text-sm text-muted-foreground" role="status">
          {dict.abmedCampaignsUnavailable}
        </p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.abmedCampaignsEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns.map((campaign) => {
            const friendlyState = formatCampaignCustomerState(campaign, stateLabels)
            const expanded = expandedId === campaign.id
            return (
              <li key={campaign.id} className="rounded-lg border bg-background p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">{campaign.headline}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{friendlyState}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dict.campaignSchedule}: {campaign.startAt ?? '—'} → {campaign.endAt ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dict.campaignLastUpdated}: {campaign.updatedAt}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : campaign.id)}
                    >
                      {dict.campaignDetailsToggle}
                    </Button>
                    {canWrite && campaign.status === 'draft' && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => beginEdit(campaign)}>
                        {dict.abmedCampaignEditDraft}
                      </Button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    <p>
                      {dict.campaignVersion}: {campaign.currentVersion}
                    </p>
                    <p>
                      {dict.campaignAudienceDevice}: {campaign.deviceTargeting}
                    </p>
                    <p>
                      {dict.campaignShowAfterSeconds}: {Math.round(campaign.delayMs / 1000)}s · {dict.campaignShowAgainAfterDays}:{' '}
                      {campaign.frequencyDays}
                    </p>
                    <p className="mt-1">{campaign.body}</p>
                  </div>
                )}
                {canWrite && campaign.status !== 'draft' && (
                  <p className="mt-2 text-xs text-muted-foreground">{dict.campaignNotEditable}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {showForm && (
        <form
          className="space-y-4 rounded-lg border bg-muted/20 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            const structuredPayload = buildCampaignStructuredPayload(form, editTarget)
            startTransition(async () => {
              setMessage(null)
              const result = await submitManagedSiteCampaignDraftAction(siteId, capabilityKey, structuredPayload)
              if (!result.ok) {
                setMessage(result.error === 'version_conflict' ? dict.abmedCampaignVersionConflict : dict.abmedCampaignsUnavailable)
                return
              }
              setEditTarget(null)
              setMessage(dict.campaignSubmitSuccess)
            })
          }}
        >
          <div>
            <p className="text-sm font-semibold">{editTarget ? dict.campaignEditModeTitle : dict.campaignCreateModeTitle}</p>
          </div>

          <div className="grid gap-4">
            <Field label={dict.abmedCampaignFieldName} id="campaign-name" required>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                className="w-full min-w-0"
              />
            </Field>
            <Field label={dict.abmedCampaignFieldHeadline} id="campaign-headline" required>
              <Input
                id="campaign-headline"
                value={form.headline}
                onChange={(e) => setForm((prev) => ({ ...prev, headline: e.target.value }))}
                required
                className="w-full min-w-0"
              />
            </Field>
            <Field label={dict.campaignMessage} id="campaign-body" required>
              <Textarea
                id="campaign-body"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
                rows={3}
                className="w-full min-w-0"
              />
            </Field>
            <Field label={dict.campaignButtonText} id="campaign-cta" required>
              <Input
                id="campaign-cta"
                value={form.ctaText}
                onChange={(e) => setForm((prev) => ({ ...prev, ctaText: e.target.value }))}
                required
                className="w-full min-w-0"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.campaignStartDateTime} id="campaign-start">
                <Input
                  id="campaign-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                  className="w-full min-w-0"
                />
              </Field>
              <Field label={dict.campaignEndDateTime} id="campaign-end">
                <Input
                  id="campaign-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
                  className="w-full min-w-0"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.campaignShowAfterSeconds} id="campaign-delay">
                <Input
                  id="campaign-delay"
                  type="number"
                  min={0}
                  step={1}
                  value={form.delaySeconds}
                  onChange={(e) => setForm((prev) => ({ ...prev, delaySeconds: e.target.value }))}
                  className="w-full min-w-0"
                />
              </Field>
              <Field label={dict.campaignShowAgainAfterDays} id="campaign-frequency">
                <Input
                  id="campaign-frequency"
                  type="number"
                  min={0}
                  step={1}
                  value={form.frequencyDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequencyDays: e.target.value }))}
                  className="w-full min-w-0"
                />
              </Field>
            </div>
            <Field label={dict.campaignAudienceDevice} id="campaign-device">
              <select
                id="campaign-device"
                className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                value={form.deviceTargeting}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, deviceTargeting: e.target.value as DeviceTargetValue }))
                }
              >
                <option value="all">{dict.deviceAll}</option>
                <option value="desktop">{dict.deviceDesktop}</option>
                <option value="mobile">{dict.deviceMobile}</option>
              </select>
            </Field>
          </div>

          <details className="rounded-md border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">{dict.campaignAdvancedSettings}</summary>
            <div className="mt-3 grid gap-4">
              <Field label={dict.campaignIdentifierLabel} id="campaign-slug" required={!editTarget}>
                <Input
                  id="campaign-slug"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  required={!editTarget}
                  className="w-full min-w-0"
                />
                <p className="mt-1 text-xs text-muted-foreground">{dict.campaignIdentifierHelp}</p>
              </Field>
              <Field label={dict.campaignButtonDestination} id="campaign-destination">
                <Input
                  id="campaign-destination"
                  value={form.ctaDestination}
                  onChange={(e) => setForm((prev) => ({ ...prev, ctaDestination: e.target.value }))}
                  className="w-full min-w-0"
                />
              </Field>
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {editTarget ? dict.campaignSubmitEdit : dict.campaignSubmitCreate}
            </Button>
            {editTarget && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={cancelEdit}>
                {dict.cancelEdit}
              </Button>
            )}
          </div>
          {message && (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

function Field({
  label,
  id,
  children,
  required,
}: {
  label: string
  id: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      {children}
    </div>
  )
}
