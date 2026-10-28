'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction, useWorkspace } from '@/lib/crm-ui/use-workspace'
import { enumLabel, fill, formatDate, formatNumber, isGateError, splitList, workspaceSend } from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  type CrmSegment,
  type SegmentEvaluation,
  type SegmentFilterDefinition,
  type SegmentOperator,
  type SegmentRuleField,
} from '@/lib/crm-ui/types'
import {
  EmptyNote,
  FormActions,
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

function ruleIsComplete(rule: DraftRule) {
  return FIELD_KIND[rule.field] === 'boolean' || rule.value.trim() !== ''
}

export function CrmSegments({ accountId, locale, copy }: Props) {
  const list = useWorkspace<{ segments: CrmSegment[] }>(CRM_API.segments, accountId)
  const t = copy.segments
  const kit = copy.kit

  if (isGateError(list.error)) {
    return (
      <>
        <SectionHeading title={t.title} description={t.description} />
        <WorkspaceState error={list.error} kit={kit} workspace={copy.name} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <SegmentBuilder copy={copy} locale={locale} onSaved={() => list.mutate()} />
      <Section title={t.listTitle}>
        {list.isLoading ? (
          <LoadingRows label={kit.loading} />
        ) : list.error ? (
          <WorkspaceState error={list.error} kit={kit} workspace={copy.name} compact onRetry={() => list.mutate()} />
        ) : !list.data?.segments.length ? (
          <EmptyNote>{t.empty}</EmptyNote>
        ) : (
          <PlainTable label={t.listLabel} headers={[copy.fields.name, t.kind, copy.fields.updated]}>
            {list.data.segments.map((s) => (
              <tr key={s.id}>
                <td className={`${td} font-medium text-foreground`}>{s.name}</td>
                <td className={td}>{enumLabel(copy.enums.segmentKind, s.kind)}</td>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>{formatDate(s.updatedAt, locale)}</td>
              </tr>
            ))}
          </PlainTable>
        )}
      </Section>
    </div>
  )
}

function SegmentBuilder({ copy, locale, onSaved }: { copy: CrmWorkspaceCopy; locale: string; onSaved: () => void }) {
  const t = copy.segments
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [nextKey, setNextKey] = useState(2)
  const [rules, setRules] = useState<DraftRule[]>([{ key: 1, field: 'leadSource', operator: 'eq', value: '' }])
  const [name, setName] = useState('')
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

  return (
    <Section title={t.builderTitle} description={t.builderDescription}>
      <div className="flex flex-col gap-4">
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
            disabled={!complete || evaluation.pending}
            onClick={() => evaluation.run(() => workspaceSend<SegmentEvaluation>(`${CRM_API.segments}/evaluate`, { filterDefinition: toDefinition(logic, rules) }))}
          >
            {evaluation.pending ? t.evaluating : t.evaluate}
          </Button>
        </FormActions>

        {evaluation.error && <WorkspaceState error={evaluation.error} kit={copy.kit} workspace={copy.name} compact />}

        {evaluation.data && (
          <div className="flex flex-col gap-4 border-t pt-4" aria-live="polite">
            <h3 className="font-semibold text-foreground">{t.summaryTitle}</h3>
            <p className="text-sm text-foreground">{fill(t.matched, { count: formatNumber(evaluation.data.contactIds.length, locale) })}</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label={t.summary.total} value={formatNumber(evaluation.data.summary.totalContacts, locale)} />
              <StatTile label={t.summary.eligible} value={formatNumber(evaluation.data.summary.eligibleContacts, locale)} />
              <StatTile label={t.summary.suppressed} value={formatNumber(evaluation.data.summary.suppressedContacts, locale)} />
              <StatTile label={t.summary.unknownConsent} value={formatNumber(evaluation.data.summary.unknownConsentContacts, locale)} />
            </div>

            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault()
                const result = await save.run(() =>
                  workspaceSend<{ id: string }>(CRM_API.segments, { name: name.trim(), filterDefinition: toDefinition(logic, rules) }),
                )
                if (result.ok) onSaved()
              }}
            >
              <div className="flex-1">
                <TextField label={t.saveName} value={name} onChange={setName} required hint={t.saveHint} />
              </div>
              <Button type="submit" disabled={save.pending || !name.trim()}>
                {save.pending ? copy.kit.saving : t.save}
              </Button>
            </form>
            {save.error && <WorkspaceState error={save.error} kit={copy.kit} workspace={copy.name} compact />}
            {save.data && <SuccessNote>{t.saved}</SuccessNote>}
          </div>
        )}
      </div>
    </Section>
  )
}
