'use client'

import { useId, useMemo, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CrmWorkspaceCopy } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { useAction } from '@/lib/crm-ui/use-workspace'
import { fill, formatNumber, newIdempotencyKey, workspaceSend, type WorkspaceError } from '@/lib/crm-ui/workspace'
import { CRM_API, type ExportPage, type ImportPreview } from '@/lib/crm-ui/types'
import { Field, FormActions, GapNotice, Section, SectionHeading, SelectField, StatTile, SuccessNote, WorkspaceState } from './workspace-kit'

type Props = { accountId: string; locale: string; copy: CrmWorkspaceCopy; base: string }

const PREVIEW_ROW_LIMIT = 1000

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

function guessColumn(columns: string[], patterns: RegExp) {
  return columns.find((c) => patterns.test(c)) ?? ''
}

export function CrmImportExport({ locale, copy }: Props) {
  const t = copy.importExport
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={t.title} description={t.description} />
      <GapNotice title={copy.kit.states.FORBIDDEN.title} body={t.ownerOnly} />
      <ImportCard copy={copy} locale={locale} />
      <ExportCard copy={copy} locale={locale} />
    </div>
  )
}

function regionState(error: WorkspaceError, copy: CrmWorkspaceCopy, offBody: string) {
  const body = error.kind === 'NOT_CONFIGURED' ? offBody : error.kind === 'FORBIDDEN' ? copy.importExport.ownerOnly : undefined
  return <WorkspaceState error={error} kit={copy.kit} workspace={copy.name} body={body} compact />
}

function ImportCard({ copy, locale }: { copy: CrmWorkspaceCopy; locale: string }) {
  const t = copy.importExport
  const fileId = useId()
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [parseFailed, setParseFailed] = useState(false)
  const [emailColumn, setEmailColumn] = useState('')
  const [nameColumn, setNameColumn] = useState('')
  const [commitKey, setCommitKey] = useState(newIdempotencyKey)
  const preview = useAction<ImportPreview>()
  const commit = useAction<{ importedCount: number }>()

  const mapping = useMemo(() => {
    const m: Record<string, string> = {}
    if (emailColumn) m.email = emailColumn
    if (nameColumn) m.givenName = nameColumn
    return m
  }, [emailColumn, nameColumn])

  async function onFile(file: File | undefined) {
    preview.reset()
    commit.reset()
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
      setEmailColumn(guessColumn(cols, /e-?mail|correo/i))
      setNameColumn(guessColumn(cols, /^(first|given)[ _-]?name$|^nombre$/i))
      setCommitKey(newIdempotencyKey())
    } catch {
      setParseFailed(true)
      setColumns([])
      setRows([])
    }
  }

  const columnOptions = [{ value: '', label: t.mapNone }, ...columns.map((c) => ({ value: c, label: c }))]

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label={t.mapEmail} value={emailColumn} onChange={(v) => { setEmailColumn(v); preview.reset() }} options={columnOptions} />
              <SelectField label={t.mapGivenName} value={nameColumn} onChange={(v) => { setNameColumn(v); preview.reset() }} options={columnOptions} />
            </div>
            <FormActions>
              <Button
                variant="outline"
                disabled={preview.pending || !emailColumn || rows.length === 0}
                onClick={() => {
                  commit.reset()
                  preview.run(() => workspaceSend<ImportPreview>(CRM_API.importPreview, { rows, mapping }))
                }}
              >
                <Upload className="size-4" aria-hidden="true" />
                {preview.pending ? t.previewing : t.preview}
              </Button>
            </FormActions>
          </>
        )}

        {preview.error && regionState(preview.error, copy, t.importOff)}

        {preview.data && (
          <div className="flex flex-col gap-4 border-t pt-4" aria-live="polite">
            <h3 className="font-semibold text-foreground">{t.previewTitle}</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={t.rowCount} value={formatNumber(preview.data.previewReport.rowCount, locale)} />
              <StatTile label={t.duplicates} value={formatNumber(preview.data.previewReport.duplicates.length, locale)} />
            </div>
            <p className="text-sm font-medium text-foreground">{t.consentNote}</p>
            {preview.data.previewReport.duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.duplicatesEmpty}</p>
            ) : (
              <ul className="max-h-48 overflow-auto rounded-lg border text-sm">
                {preview.data.previewReport.duplicates.map((d) => (
                  <li key={`${d.rowNumber}-${d.email}`} className="flex justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                    <span className="text-muted-foreground">{fill(t.row, { number: d.rowNumber })}</span>
                    <span className="break-all text-foreground">{d.email}</span>
                  </li>
                ))}
              </ul>
            )}
            <FormActions>
              <Button
                disabled={commit.pending || Boolean(commit.data)}
                onClick={() =>
                  commit.run(() =>
                    workspaceSend<{ importedCount: number }>(CRM_API.importCommit, {
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
            {commit.error && regionState(commit.error, copy, t.importOff)}
            {commit.data && <SuccessNote>{fill(t.committed, { count: formatNumber(commit.data.importedCount, locale) })}</SuccessNote>}
          </div>
        )}
      </div>
    </Section>
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
