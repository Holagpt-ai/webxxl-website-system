'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'
import { TableFrame, td, th } from './workspace-kit'
import {
  COHORT_KEYS,
  FUNNEL_MAX_GROUP_ROWS,
  sortRows,
  type FunnelGroupRow,
  type SortKey,
  type SortState,
} from '@/lib/crm-ui/lead-funnel'
import { fill, formatNumber } from '@/lib/crm-ui/workspace'
import type { CrmLeadFunnelCopy } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'
import { cn } from '@/lib/utils'

export function FunnelBreakdown({
  id,
  title,
  description,
  keyColumn,
  rows,
  filteredNote,
  emptyNote,
  footnote,
  label,
  isUnknown,
  locale,
  fc,
}: {
  id: string
  title: string
  description: string
  keyColumn: string
  rows: FunnelGroupRow[]
  /** Set when the report is filtered on this dimension, so the empty list is intentional. */
  filteredNote: string | null
  emptyNote: string
  footnote?: string
  label: (key: string) => string
  isUnknown?: (key: string) => boolean
  locale: string
  fc: CrmLeadFunnelCopy
}) {
  const [sort, setSort] = useState<SortState>({ key: 'leadsReceived', dir: 'desc' })
  const sorted = useMemo(() => sortRows(rows, sort, label), [rows, sort, label])
  const b = fc.breakdown

  function toggle(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'key' ? 'asc' : 'desc' }))
  }

  function header(key: SortKey, text: string, numeric: boolean) {
    const active = sort.key === key
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(th, numeric && 'text-right')}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-label={fill(b.sortBy, { column: text })}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            numeric && 'flex-row-reverse',
            active && 'text-foreground',
          )}
        >
          {text}
          <Icon className="size-3" aria-hidden="true" />
        </button>
      </th>
    )
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {filteredNote ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <Filter className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {filteredNote}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{emptyNote}</p>
      ) : (
        <>
          <TableFrame label={title}>
            <thead>
              <tr>
                {header('key', keyColumn, false)}
                {COHORT_KEYS.map((key) => header(key, b.columns[key], true))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className={cn(td, 'max-w-64 font-medium text-foreground')}>
                    <span className="block truncate">{label(row.key)}</span>
                    {isUnknown?.(row.key) && (
                      <span className="block truncate font-mono text-xs font-normal text-muted-foreground">{b.unknownSite}</span>
                    )}
                  </th>
                  {COHORT_KEYS.map((key) => (
                    <td key={key} className={cn(td, 'text-right tabular-nums', key === 'leadsReceived' && 'font-semibold')}>
                      {formatNumber(row.counts[key], locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableFrame>
          {(rows.length >= FUNNEL_MAX_GROUP_ROWS || footnote) && (
            <div className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
              {rows.length >= FUNNEL_MAX_GROUP_ROWS && <p>{fill(b.limited, { count: FUNNEL_MAX_GROUP_ROWS })}</p>}
              {footnote && <p>{footnote}</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
