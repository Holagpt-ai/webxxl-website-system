'use client'

import { useState } from 'react'
import { Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, formatNumber, isGateError, splitList, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  type CrmSegment,
  type SegmentEvaluation,
  type SegmentFilterDefinition,
  type SegmentOperator,
  type SegmentPopulationSummary,
  type SegmentRuleField,
} from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
  GapNotice,
  LoadingRows,
  PlainTable,
  Section,
  SectionHeading,
  SelectField,
  StatTile,
  SuccessNote,
  TextField,
  WorkspaceState,
  td,
} from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

type FieldKind = 'text' | 'date' | 'boolean' | 'coverage'

const FIELD_KIND: Record<SegmentRuleField, FieldKind> = {
  tag: 'text',
  leadSource: 'text',
  createdAfter: 'date',
  createdBefore: 'date',
  lastActivityBefore: 'date',
  hasOpenDeal: 'boolean',
  followUpCoverage: 'coverage',
  consentEligible: 'boolean',
  notSuppressed: 'boolean',
}

const OPERATORS_BY_KIND: Record<FieldKind, SegmentOperator[]> = {
  text: ['eq', 'neq', 'in'],
  date: ['gte', 'lte', 'eq'],
  boolean: ['eq'],
  coverage: ['eq', 'neq', 'in'],
}

type DraftRule = { key: number; field: SegmentRuleField; operator: SegmentOperator; value: string }
type Draft = { logic: 'AND' | 'OR'; rules: DraftRule[] }

function defaultValue(kind: FieldKind) {
  if (kind === 'boolean') return 'true'
  if (kind === 'coverage') return 'OVERDUE'
  return ''
}

function toDefinition(logic: 'AND' | 'OR', rules: DraftRule[]): SegmentFilterDefinition {
  return {
    logic,
    rules: rules.map((rule) => {
      const kind = FIELD_KIND[rule.field]
      let value: unknown = rule.value.trim()
      if (kind === 'boolean') value = rule.value === 'true'
      else if (kind === 'date') value = rule.value ? new Date(`${rule.value}T00:00:00`).toISOString() : ''
      else if (rule.operator === 'in') value = splitList(rule.value)
      return { field: rule.field, operator: rule.operator, value }
    }),
  }
}

function localDate(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Inverse of `toDefinition`. Returns null for anything this editor cannot represent faithfully (e.g. nested groups). */
function fromDefinition(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null
  const def = raw as { logic?: unknown; rules?: unknown }
  if (def.logic !== 'AND' && def.logic !== 'OR') return null
  if (!Array.isArray(def.rules) || def.rules.length === 0) return null
  const rules: DraftRule[] = []
  for (const [index, item] of def.rules.entries()) {
    if (!item || typeof item !== 'object') return null
    const { field, operator, value } = item as { field?: unknown; operator?: unknown; value?: unknown }
    if (typeof field !== 'string' || !(field in FIELD_KIND)) return null
    const kind = FIELD_KIND[field as SegmentRuleField]
    if (typeof operator !== 'string' || !OPERATORS_BY_KIND[kind].includes(operator as SegmentOperator)) return null
    let text: string
    if (kind === 'boolean') {
      if (typeof value !== 'boolean') return null
      text = String(value)
    } else if (kind === 'date') {
      const parsed = typeof value === 'string' ? localDate(value) : null
      if (!parsed) return null
      text = parsed
    } else if (operator === 'in') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return null
      text = value.join(', ')
    } else {
      if (typeof value !== 'string') return null
      text = value
    }
    rules.push({ key: index + 1, field: field as SegmentRuleField, operator: operator as SegmentOperator, value: text })
  }
  return { logic: def.logic, rules }
}

function ruleIsComplete(rule: DraftRule) {
  return FIELD_KIND[rule.field] === 'boolean' || rule.value.trim() !== ''
}

const NEW_DRAFT: Draft = { logic: 'AND', rules: [{ key: 1, field: 'leadSource', operator: 'eq', value: '' }] }

export function CrmSegments({ accountId, locale, copy }: Props) {
  const list = useWorkspace<{ segments: CrmSegment[] }>(CRM_API.segments, accountId)
  const t = copy.segments
  const kit = copy.kit
  const [evaluating, setEvaluating] = useState<CrmSegment | null>(null)
  const [editing, setEditing] = useState<CrmSegment | null>(null)
  const [deleting, setDeleting] = useState<CrmSegment | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

  const editingDraft = editing ? fromDefinition(editing.filterDefinition) : null

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <SegmentBuilder key="create" copy={copy} locale={locale} onSaved={() => list.mutate()} />

      <Section title={t.listTitle}>
        <div className="flex flex-col gap-4">
          <GapNotice title={kit.states.FORBIDDEN.title} body={t.adminHint} />
          {notice && <SuccessNote>{notice}</SuccessNote>}
          {list.isLoading ? (
            <LoadingRows label={kit.loading} />
          ) : list.error ? (
            <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
          ) : !list.data?.segments.length ? (
            <EmptyNote>{t.empty}</EmptyNote>
          ) : (
            <PlainTable label={t.listLabel} headers={[copy.fields.name, t.kind, copy.fields.updated, t.actions]}>
              {list.data.segments.map((s) => {
                const dynamic = s.kind === 'DYNAMIC'
                const editable = dynamic && fromDefinition(s.filterDefinition) !== null
                return (
                  <tr key={s.id}>
                    <td className={`${td} font-medium text-foreground`}>{s.name}</td>
                    <td className={td}>{enumLabel(copy.enums.segmentKind, s.kind)}</td>
                    <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(s.updatedAt, locale)}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {dynamic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${t.evaluateSaved}: ${s.name}`}
                            onClick={() => {
                              setNotice(null)
                              setEditing(null)
                              setEvaluating(s)
                            }}
                          >
                            <Play className="size-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{t.evaluateSaved}</span>
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${t.edit}: ${s.name}`}
                            onClick={() => {
                              setNotice(null)
                              setEvaluating(null)
                              setEditing(s)
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{t.edit}</span>
                          </Button>
                        )}
                        {dynamic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${t.delete}: ${s.name}`}
                            onClick={() => {
                              setNotice(null)
                              setDeleting(s)
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{t.delete}</span>
                          </Button>
                        )}
                      </div>
                      {!dynamic && <p className="mt-1 text-xs text-muted-foreground">{t.staticNote}</p>}
                      {dynamic && !editable && <p className="mt-1 text-xs text-muted-foreground">{t.unsupportedRules}</p>}
                    </td>
                  </tr>
                )
              })}
            </PlainTable>
          )}
        </div>
      </Section>

      {evaluating && (
        <SavedEvaluation key={evaluating.id} segment={evaluating} accountId={accountId} copy={copy} locale={locale} onClose={() => setEvaluating(null)} />
      )}

      {editing && editingDraft && (
        <SegmentBuilder
          key={`edit-${editing.id}`}
          copy={copy}
          locale={locale}
          segment={editing}
          initial={editingDraft}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setNotice(t.updated)
            setEditing(null)
            list.mutate()
          }}
        />
      )}

      <DeleteSegment
        segment={deleting}
        copy={copy}
        onClose={() => setDeleting(null)}
        onDeleted={(name) => {
          setNotice(fill(t.deleted, { name }))
          if (evaluating?.id === deleting?.id) setEvaluating(null)
          if (editing?.id === deleting?.id) setEditing(null)
          setDeleting(null)
          list.mutate()
        }}
      />
    </div>
  )
}

function SavedEvaluation({
  segment,
  accountId,
  copy,
  locale,
  onClose,
}: {
  segment: CrmSegment
  accountId: string
  copy: CrmWorkspaceCopy
  locale: string
  onClose: () => void
}) {
  const t = copy.segments
  const result = useWorkspace<SegmentEvaluation>(CRM_API.segment(segment.id), accountId)
  return (
    <Section
      title={fill(t.evaluationTitle, { name: segment.name })}
      action={
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t.closeEvaluation}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      }
    >
      {result.isLoading ? (
        <LoadingRows label={copy.kit.loading} />
      ) : result.error ? (
        <WorkspaceState error={result.error} kit={copy.kit} workspace={copy.name} compact onRetry={() => result.mutate()} />
      ) : result.data ? (
        <EvaluationResult evaluation={result.data} copy={copy} locale={locale} />
      ) : null}
    </Section>
  )
}

function SummaryTiles({ summary, copy, locale }: { summary: SegmentPopulationSummary; copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.segments
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label={t.summary.total} value={formatNumber(summary.totalContacts, locale)} />
      <StatTile label={t.summary.eligible} value={formatNumber(summary.eligibleContacts, locale)} hint={t.summaryHints.eligible} />
      <StatTile label={t.summary.suppressed} value={formatNumber(summary.suppressedContacts, locale)} hint={t.summaryHints.suppressed} />
      <StatTile
        label={t.summary.unknownConsent}
        value={formatNumber(summary.unknownConsentContacts, locale)}
        hint={t.summaryHints.unknownConsent}
      />
    </div>
  )
}

function EvaluationResult({ evaluation, copy, locale }: { evaluation: SegmentEvaluation; copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.segments
  const matched = evaluation.matchedContacts ?? evaluation.contactIds.length
  const accountTotal = evaluation.accountContactCount ?? evaluation.accountSummary?.totalContacts
  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <p className="text-sm font-medium text-foreground">
        {accountTotal !== undefined
          ? fill(t.matchedOf, { matched: formatNumber(matched, locale), total: formatNumber(accountTotal, locale) })
          : fill(t.matched, { count: formatNumber(matched, locale) })}
      </p>
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-foreground">{t.matchedTitle}</h4>
        <SummaryTiles summary={evaluation.summary} copy={copy} locale={locale} />
      </div>
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-foreground">{t.accountTitle}</h4>
        {evaluation.accountSummary ? (
          <SummaryTiles summary={evaluation.accountSummary} copy={copy} locale={locale} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.accountMissing}</p>
        )}
      </div>
    </div>
  )
}

function DeleteSegment({
  segment,
  copy,
  onClose,
  onDeleted,
}: {
  segment: CrmSegment | null
  copy: CrmWorkspaceCopy
  onClose: () => void
  onDeleted: (name: string) => void
}) {
  const t = copy.segments
  const remove = useAction<{ ok: true }>()
  return (
    <Dialog
      open={Boolean(segment)}
      onOpenChange={(open) => {
        if (open || remove.pending) return
        remove.reset()
        onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fill(t.deleteTitle, { name: segment?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t.deleteBody}</DialogDescription>
        </DialogHeader>
        {remove.error && <WorkspaceState error={remove.error} kit={copy.kit} workspace={copy.name} compact />}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={remove.pending}
            onClick={() => {
              remove.reset()
              onClose()
            }}
          >
            {copy.kit.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.pending || !segment}
            onClick={async () => {
              if (!segment) return
              const result = await remove.run(() => workspaceSend<{ ok: true }>(CRM_API.segment(segment.id), undefined, 'DELETE'))
              if (result.ok) {
                remove.reset()
                onDeleted(segment.name)
              }
            }}
          >
            {remove.pending ? t.deleting : t.deleteConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SegmentBuilder({
  copy,
  locale,
  onSaved,
  segment,
  initial = NEW_DRAFT,
  onCancel,
}: {
  copy: CrmWorkspaceCopy
  locale: string
  onSaved: () => void
  segment?: CrmSegment
  initial?: Draft
  onCancel?: () => void
}) {
  const t = copy.segments
  const editMode = Boolean(segment)
  const [logic, setLogic] = useState<'AND' | 'OR'>(initial.logic)
  const [nextKey, setNextKey] = useState(initial.rules.length + 1)
  const [rules, setRules] = useState<DraftRule[]>(initial.rules)
  const [name, setName] = useState(segment?.name ?? '')
  const evaluation = useAction<SegmentEvaluation>()
  const save = useAction<{ id: string }>()

  const complete = rules.length > 0 && rules.every(ruleIsComplete)
  const fieldOptions = (Object.keys(FIELD_KIND) as SegmentRuleField[]).map((field) => ({ value: field, label: t.fields[field] }))

  function update(key: number, patch: Partial<DraftRule>) {
    evaluation.reset()
    save.reset()
    setRules((current) =>
      current.map((rule) => {
        if (rule.key !== key) return rule
        const next = { ...rule, ...patch }
        if (patch.field && patch.field !== rule.field) {
          const kind = FIELD_KIND[patch.field]
          next.operator = OPERATORS_BY_KIND[kind][0]
          next.value = defaultValue(kind)
        }
        return next
      }),
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name: name.trim(), filterDefinition: toDefinition(logic, rules) }
    const result = await save.run(() =>
      segment
        ? workspaceSend<{ id: string }>(CRM_API.segment(segment.id), payload, 'PATCH')
        : workspaceSend<{ id: string }>(CRM_API.segments, payload),
    )
    if (result.ok) onSaved()
  }

  const nameForm = (
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={submit}>
      <div className="flex-1">
        <TextField label={t.saveName} value={name} onChange={setName} required hint={editMode ? t.adminHint : t.saveHint} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.pending || !name.trim() || !complete}>
          {save.pending ? copy.kit.saving : editMode ? t.saveChanges : t.save}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={save.pending}>
            {t.cancelEdit}
          </Button>
        )}
      </div>
    </form>
  )

  return (
    <Section
      title={segment ? fill(t.editTitle, { name: segment.name }) : t.builderTitle}
      description={editMode ? t.editDescription : t.builderDescription}
    >
      <div className="flex flex-col gap-4">
        {editMode && nameForm}

        <div className="max-w-xs">
          <SelectField
            label={t.logic}
            value={logic}
            onChange={(v) => {
              setLogic(v as 'AND' | 'OR')
              evaluation.reset()
            }}
            options={[
              { value: 'AND', label: t.logicAnd },
              { value: 'OR', label: t.logicOr },
            ]}
          />
        </div>

        <ol className="flex flex-col gap-3">
          {rules.map((rule, index) => {
            const kind = FIELD_KIND[rule.field]
            return (
              <li key={rule.key} className="flex flex-col gap-3 rounded-lg border bg-muted p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{fill(t.rule, { index: index + 1 })}</p>
                  {rules.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={fill(t.removeRule, { index: index + 1 })}
                      onClick={() => setRules((current) => current.filter((r) => r.key !== rule.key))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SelectField label={t.field} value={rule.field} onChange={(v) => update(rule.key, { field: v as SegmentRuleField })} options={fieldOptions} />
                  <SelectField
                    label={t.operator}
                    value={rule.operator}
                    onChange={(v) => update(rule.key, { operator: v as SegmentOperator })}
                    options={OPERATORS_BY_KIND[kind].map((op) => ({ value: op, label: t.operators[op] }))}
                  />
                  {kind === 'boolean' ? (
                    <SelectField
                      label={t.value}
                      value={rule.value}
                      onChange={(v) => update(rule.key, { value: v })}
                      options={[
                        { value: 'true', label: t.yes },
                        { value: 'false', label: t.no },
                      ]}
                      hint={t.valueHints.boolean}
                    />
                  ) : kind === 'coverage' && rule.operator !== 'in' ? (
                    <SelectField
                      label={t.value}
                      value={rule.value}
                      onChange={(v) => update(rule.key, { value: v })}
                      options={Object.entries(copy.enums.coverage).map(([value, label]) => ({ value, label }))}
                    />
                  ) : kind === 'date' ? (
                    <TextField label={t.value} type="date" value={rule.value} onChange={(v) => update(rule.key, { value: v })} hint={t.valueHints.date} />
                  ) : (
                    <TextField label={t.value} value={rule.value} onChange={(v) => update(rule.key, { value: v })} hint={t.valueHints.text} />
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <FormActions>
          <Button
            variant="outline"
            onClick={() => {
              setRules((current) => [...current, { key: nextKey, field: 'tag', operator: 'eq', value: '' }])
              setNextKey((k) => k + 1)
              evaluation.reset()
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.addRule}
          </Button>
          <Button
            variant={editMode ? 'outline' : 'default'}
            disabled={!complete || evaluation.pending}
            onClick={() =>
              evaluation.run(() =>
                workspaceSend<SegmentEvaluation>(CRM_API.segments, {
                  evaluateOnly: true,
                  filterDefinition: toDefinition(logic, rules),
                }),
              )
            }
          >
            {evaluation.pending ? t.evaluating : t.evaluate}
          </Button>
        </FormActions>

        {evaluation.error && <WorkspaceState error={evaluation.error} kit={copy.kit} workspace={copy.name} compact />}

        {evaluation.data && (
          <div className="flex flex-col gap-4 border-t pt-4">
            <h3 className="font-semibold text-foreground">{t.summaryTitle}</h3>
            <EvaluationResult evaluation={evaluation.data} copy={copy} locale={locale} />
            {!editMode && nameForm}
          </div>
        )}

        {save.error && <WorkspaceState error={save.error} kit={copy.kit} workspace={copy.name} compact />}
        {!editMode && save.data && <SuccessNote>{t.saved}</SuccessNote>}
      </div>
    </Section>
  )
}
