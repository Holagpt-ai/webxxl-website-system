'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import { Download, ShieldOff, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill, type PillTone } from '@/components/commerce/ui'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction } from '@/lib/crm-ui/use-workspace'
import { DASH, fill, formatNumber, newIdempotencyKey, workspaceSend, type WorkspaceError } from '@/lib/crm-ui/workspace'
import {
  CRM_API,
  IMPORT_TARGETS,
  type ExportPage,
  type ImportCommitOutcome,
  type ImportDispositionKind,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportTarget,
} from '@/lib/crm-ui/types'
import { Field, FormActions, GapNotice, PlainTable, Section, SectionHeading, SelectField, StatTile, SuccessNote, WorkspaceState, td } from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

const PREVIEW_ROW_LIMIT = 1000
const ROWS_SHOWN = 200

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  return rows
}

const GUESS: Record<ImportTarget, RegExp> = {
  email: /e-?mail|correo/i,
  phone: /phone|mobile|tel[eé]fono|celular|m[oó]vil/i,
  givenName: /^(first|given)[ _-]?name$|^nombre$/i,
  familyName: /^(last|family|sur)[ _-]?name$|^apellidos?$/i,
  leadSource: /^(lead[ _-]?)?source$|^origen$/i,
}

const EMPTY_MAPPING: Record<ImportTarget, string> = { email: '', phone: '', givenName: '', familyName: '', leadSource: '' }

const DISPOSITION_TONE: Record<ImportDispositionKind, PillTone> = {
  ready: 'success',
  duplicate_existing: 'info',
  duplicate_in_file: 'info',
  rejected: 'danger',
  skipped: 'muted',
}

const DISPOSITION_ORDER: ImportDispositionKind[] = ['ready', 'duplicate_existing', 'duplicate_in_file', 'rejected', 'skipped']

export function CrmImportExport({ locale, copy, base }: Props) {
  const t = copy.importExport
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <GapNotice title={copy.kit.states.FORBIDDEN.title} body={t.ownerOnly} />
      <ImportCard copy={copy} locale={locale} base={base} />
      <ExportCard copy={copy} locale={locale} />
    </div>
  )
}

function regionState(error: WorkspaceError, copy: CrmWorkspaceCopy, offBody: string) {
  const body = error.kind === 'NOT_CONFIGURED' ? offBody : error.kind === 'FORBIDDEN' ? copy.importExport.ownerOnly : undefined
  return <WorkspaceState error={error} kit={copy.kit} workspace={copy.name} body={body} compact />
}

function ImportCard({ copy, locale, base }: { copy: CrmWorkspaceCopy; locale: string; base: string }) {
  const t = copy.importExport
  const fileId = useId()
  const confirmId = useId()
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [parseFailed, setParseFailed] = useState(false)
  const [mapping, setMapping] = useState<Record<ImportTarget, string>>(EMPTY_MAPPING)
  const [commitKey, setCommitKey] = useState(newIdempotencyKey)
  const [reviewed, setReviewed] = useState(false)
  const [filter, setFilter] = useState<ImportDispositionKind | 'all'>('all')
  const preview = useAction<ImportPreview>()
  const commit = useAction<ImportCommitOutcome>()

  const sentMapping = useMemo(
    () => Object.fromEntries(Object.entries(mapping).filter(([, column]) => column)) as Partial<Record<ImportTarget, string>>,
    [mapping],
  )
  const mappedColumns = Object.values(sentMapping)
  const duplicateMapping = new Set(mappedColumns).size !== mappedColumns.length
  const hasIdentity = Boolean(mapping.email || mapping.phone)

  function resetPreview() {
    preview.reset()
    commit.reset()
    setReviewed(false)
    setFilter('all')
    setCommitKey(newIdempotencyKey())
  }

  async function onFile(file: File | undefined) {
    resetPreview()
    setParseFailed(false)
    if (!file) return
    try {
      const parsed = parseCsv(await file.text())
      const [header, ...body] = parsed
      if (!header?.length) throw new Error('empty')
      const cols = header.map((h) => h.trim())
      setColumns(cols)
      setTotalRows(body.length)
      setRows(body.slice(0, PREVIEW_ROW_LIMIT).map((cells) => Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']))))
      const guessed = { ...EMPTY_MAPPING }
      const taken = new Set<string>()
      for (const target of IMPORT_TARGETS) {
        const match = cols.find((c) => !taken.has(c) && GUESS[target].test(c))
        if (match) {
          guessed[target] = match
          taken.add(match)
        }
      }
      setMapping(guessed)
    } catch {
      setParseFailed(true)
      setColumns([])
      setRows([])
    }
  }

  const columnOptions = [{ value: '', label: t.mapNone }, ...columns.map((c) => ({ value: c, label: c }))]
  const targetLabels: Record<ImportTarget, string> = {
    email: t.mapEmail,
    phone: t.mapPhone,
    givenName: t.mapGivenName,
    familyName: t.mapFamilyName,
    leadSource: t.mapLeadSource,
  }

  const report = preview.data?.previewReport
  const summary = report?.summary
  const readyCount = summary?.ready ?? (report ? report.rowCount - report.duplicates.length : 0)
  const committed = Boolean(commit.data)

  return (
    <Section title={t.importTitle} description={t.importDescription}>
      <div className="flex flex-col gap-4">
        <Field id={fileId} label={t.fileLabel} hint={t.fileHint}>
          <Input id={fileId} type="file" accept=".csv,text/csv" aria-describedby={`${fileId}-hint`} onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
        {parseFailed && <WorkspaceState kind="VALIDATION" body={t.parseError} kit={copy.kit} workspace={copy.name} compact />}

        {columns.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {fill(t.parsed, { rows: formatNumber(totalRows, locale), columns: columns.length })}
              {totalRows > PREVIEW_ROW_LIMIT && ` ${fill(t.tooMany, { max: formatNumber(PREVIEW_ROW_LIMIT, locale) })}`}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_TARGETS.map((target) => (
                <SelectField
                  key={target}
                  label={targetLabels[target]}
                  value={mapping[target]}
                  onChange={(v) => {
                    setMapping((current) => ({ ...current, [target]: v }))
                    resetPreview()
                  }}
                  options={columnOptions}
                />
              ))}
            </div>
            {(!hasIdentity || duplicateMapping) && (
              <p className="text-sm text-muted-foreground" role="status">
                {duplicateMapping ? t.mapDuplicate : t.mapHint}
              </p>
            )}
            <FormActions>
              <Button
                variant="outline"
                disabled={preview.pending || !hasIdentity || duplicateMapping || rows.length === 0}
                onClick={() => {
                  commit.reset()
                  setReviewed(false)
                  setFilter('all')
                  preview.run(() => workspaceSend<ImportPreview>(CRM_API.importPreview, { rows, mapping: sentMapping }))
                }}
              >
                <Upload className="size-4" aria-hidden="true" />
                {preview.pending ? t.previewing : t.preview}
              </Button>
            </FormActions>
          </>
        )}

        {preview.error && regionState(preview.error, copy, t.importOff)}

        {report && (
          <div className="flex flex-col gap-5 border-t pt-4">
            <h3 className="font-semibold text-foreground">{t.previewTitle}</h3>

            {summary ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-live="polite">
                <StatTile label={t.summary.rows} value={formatNumber(summary.rowCount, locale)} />
                <StatTile label={t.summary.ready} value={formatNumber(summary.ready, locale)} hint={t.summaryHints.ready} />
                <StatTile
                  label={t.summary.duplicates}
                  value={formatNumber(summary.duplicateExisting + summary.duplicateInFile, locale)}
                  hint={t.summaryHints.duplicates}
                />
                <StatTile label={t.summary.rejected} value={formatNumber(summary.rejected, locale)} hint={t.summaryHints.rejected} />
                <StatTile label={t.summary.skipped} value={formatNumber(summary.skipped, locale)} hint={t.summaryHints.skipped} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3" aria-live="polite">
                <StatTile label={t.rowCount} value={formatNumber(report.rowCount, locale)} />
                <StatTile label={t.duplicates} value={formatNumber(report.duplicates.length, locale)} />
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm">
              <ShieldOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{t.consentTitle}.</span> {t.consentNote}
              </p>
            </div>

            {report.rows ? (
              <RowReview rows={report.rows} filter={filter} onFilter={setFilter} copy={copy} locale={locale} base={base} />
            ) : (
              <LegacyDuplicates report={report} copy={copy} />
            )}

            {!committed &&
              (readyCount > 0 ? (
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex items-start gap-3">
                    <input
                      id={confirmId}
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <label htmlFor={confirmId} className="text-sm leading-relaxed text-foreground">
                      {fill(t.reviewConfirm, { count: formatNumber(readyCount, locale) })}
                    </label>
                  </div>
                  <FormActions>
                    <Button
                      disabled={!reviewed || commit.pending}
                      onClick={() =>
                        commit.run(() =>
                          workspaceSend<ImportCommitOutcome>(CRM_API.importCommit, {
                            jobId: preview.data!.jobId,
                            rows,
                            commitIdempotencyKey: commitKey,
                          }),
                        )
                      }
                    >
                      {commit.pending ? t.committing : t.commit}
                    </Button>
                  </FormActions>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" role="status">
                  {t.nothingReady}
                </p>
              ))}

            {commit.error && regionState(commit.error, copy, t.importOff)}
            {commit.data && <CommitResult outcome={commit.data} copy={copy} locale={locale} />}
          </div>
        )}
      </div>
    </Section>
  )
}

function CommitResult({ outcome, copy, locale }: { outcome: ImportCommitOutcome; copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.importExport
  const committedCount = outcome.committed ?? outcome.importedCount
  const hasBreakdown = outcome.duplicates !== undefined || outcome.rejected !== undefined || outcome.skipped !== undefined
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <SuccessNote>{fill(t.committed, { count: formatNumber(committedCount, locale) })}</SuccessNote>
      {hasBreakdown && (
        <>
          <h4 className="text-sm font-semibold text-foreground">{t.resultTitle}</h4>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t.result.committed} value={formatNumber(committedCount, locale)} />
            <StatTile label={t.result.duplicates} value={formatNumber(outcome.duplicates ?? 0, locale)} />
            <StatTile label={t.result.rejected} value={formatNumber(outcome.rejected ?? 0, locale)} />
            <StatTile label={t.result.skipped} value={formatNumber(outcome.skipped ?? 0, locale)} />
          </div>
        </>
      )}
    </div>
  )
}

function LegacyDuplicates({ report, copy }: { report: ImportPreview['previewReport']; copy: CrmWorkspaceCopy }) {
  const t = copy.importExport
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t.legacyPreview}</p>
      {report.duplicates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.duplicatesEmpty}</p>
      ) : (
        <ul className="max-h-48 overflow-auto rounded-lg border text-sm">
          {report.duplicates.map((d) => (
            <li key={`${d.rowNumber}-${d.email}`} className="flex justify-between gap-3 border-b px-3 py-2 last:border-b-0">
              <span className="text-muted-foreground">{fill(t.row, { number: d.rowNumber })}</span>
              <span className="break-all text-foreground">{d.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function rowContact(row: ImportPreviewRow) {
  const n = row.normalized
  const name = [n.givenName, n.familyName].filter(Boolean).join(' ')
  const channel = n.email ?? n.emailNormalized ?? n.phoneNormalized
  return { name, channel }
}

function rowReason(row: ImportPreviewRow, copy: CrmWorkspaceCopy, base: string): React.ReactNode {
  const t = copy.importExport
  const d = row.disposition
  switch (d.kind) {
    case 'ready':
      return t.reasons.ready
    case 'duplicate_existing':
      return (
        <span className="flex flex-col gap-1">
          <span>{t.reasons.existing}</span>
          <Link href={`${base}/contacts/${encodeURIComponent(d.contactId)}`} className="w-fit font-medium text-primary underline-offset-4 hover:underline">
            {t.reasons.viewExisting}
          </Link>
        </span>
      )
    case 'duplicate_in_file':
      return fill(t.reasons.inFile, { row: d.firstRowNumber })
    case 'rejected':
      return d.errors.map((e) => t.rejectReasons[e] ?? e).join(' ')
    case 'skipped':
      return d.reason === 'Empty row' ? t.reasons.empty : t.reasons.skipped
  }
}

function RowReview({
  rows,
  filter,
  onFilter,
  copy,
  locale,
  base,
}: {
  rows: ImportPreviewRow[]
  filter: ImportDispositionKind | 'all'
  onFilter: (value: ImportDispositionKind | 'all') => void
  copy: CrmWorkspaceCopy
  locale: string
  base: string
}) {
  const t = copy.importExport
  const counts = useMemo(() => {
    const c = Object.fromEntries(DISPOSITION_ORDER.map((k) => [k, 0])) as Record<ImportDispositionKind, number>
    for (const row of rows) c[row.disposition.kind]++
    return c
  }, [rows])
  const visible = filter === 'all' ? rows : rows.filter((r) => r.disposition.kind === filter)
  const shown = visible.slice(0, ROWS_SHOWN)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h4 className="text-sm font-semibold text-foreground">{t.rowsTitle}</h4>
        <div className="sm:w-64">
          <SelectField
            label={t.filterLabel}
            value={filter}
            onChange={(v) => onFilter(v as ImportDispositionKind | 'all')}
            options={[
              { value: 'all', label: `${t.filterAll} (${formatNumber(rows.length, locale)})` },
              ...DISPOSITION_ORDER.filter((k) => counts[k] > 0).map((k) => ({
                value: k,
                label: `${t.disposition[k]} (${formatNumber(counts[k], locale)})`,
              })),
            ]}
          />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.rowsFilterEmpty}</p>
      ) : (
        <PlainTable label={t.rowsLabel} headers={[t.columns.row, t.columns.contact, t.columns.outcome, t.columns.reason]}>
          {shown.map((row) => {
            const { name, channel } = rowContact(row)
            return (
              <tr key={row.rowNumber}>
                <td className={`${td} tabular-nums text-muted-foreground`}>{row.rowNumber}</td>
                <td className={td}>
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">{name || channel || DASH}</span>
                    {name && channel && <span className="break-all text-xs text-muted-foreground">{channel}</span>}
                  </span>
                </td>
                <td className={td}>
                  <StatusPill label={t.disposition[row.disposition.kind]} tone={DISPOSITION_TONE[row.disposition.kind]} />
                </td>
                <td className={`${td} min-w-48 text-sm leading-relaxed text-muted-foreground`}>{rowReason(row, copy, base)}</td>
              </tr>
            )
          })}
        </PlainTable>
      )}
      {visible.length > ROWS_SHOWN && (
        <p className="text-xs text-muted-foreground">
          {fill(t.rowsShowing, { shown: formatNumber(ROWS_SHOWN, locale), total: formatNumber(visible.length, locale) })}
        </p>
      )}
    </div>
  )
}

const EXPORT_PAGE = 500

function ExportCard({ copy, locale }: { copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.importExport
  const [chunks, setChunks] = useState<string[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [started, setStarted] = useState(false)
  const page = useAction<ExportPage>()

  const lines = chunks.length ? chunks.join('\n').split('\n').filter(Boolean) : []
  const dataRows = Math.max(0, lines.length - 1)

  async function load(nextCursor?: string) {
    const result = await page.run(() => workspaceSend<ExportPage>(CRM_API.exports, { take: EXPORT_PAGE, cursor: nextCursor }))
    if (!result.ok) return
    setStarted(true)
    // Every page repeats the header row; keep it only once.
    const csv = nextCursor ? result.data.csv.split('\n').slice(1).join('\n') : result.data.csv
    setChunks((current) => (nextCursor ? [...current, csv] : [csv]))
    setCursor(result.data.nextCursor)
  }

  function download() {
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section title={t.exportTitle} description={t.exportDescription}>
      <div className="flex flex-col gap-4">
        <FormActions>
          <Button variant="outline" disabled={page.pending} onClick={() => load()}>
            {page.pending && !cursor ? t.exporting : t.exportButton}
          </Button>
          {cursor && (
            <Button variant="outline" disabled={page.pending} onClick={() => load(cursor)}>
              {page.pending ? t.exporting : t.exportMore}
            </Button>
          )}
          {dataRows > 0 && (
            <Button onClick={download}>
              <Download className="size-4" aria-hidden="true" />
              {t.download}
            </Button>
          )}
        </FormActions>
        {page.error && regionState(page.error, copy, t.exportOff)}
        {started && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {dataRows > 0 ? fill(t.exportRows, { rows: formatNumber(dataRows, locale) }) : t.exportEmpty}
          </p>
        )}
      </div>
    </Section>
  )
}
