import { prisma } from '@/lib/db'
import { buildConversionObservationIdempotencyKey } from '@/lib/platform/analytics/ids'
import {
  BUILTIN_CONVERSION_EVENT_KEYS,
  resolveConversionKeyForEvent,
} from '@/lib/platform/analytics/capture/event-keys'

function utcPeriodDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function periodDateIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function computeUniqueConversionCount(count: number, uniqueRefs: Set<string>): number {
  if (uniqueRefs.size > 0) return uniqueRefs.size
  return count
}

export type DailyAggregationAcc = {
  count: number
  uniqueRefs: Set<string>
  definitionId: string | null
  conversionKey: string
}

export function buildDailyAggregationMap(
  events: Array<{
    eventKey: string
    customConversionKey: string | null
    occurredAt: Date
    sessionRef: string | null
    visitorRef: string | null
  }>,
  defs: Array<{ id: string; key: string; matchEventKey: string | null }>,
): Map<string, DailyAggregationAcc> {
  const defByKey = new Map(defs.map((d) => [d.key, d]))
  const defByMatch = new Map(
    defs.filter((d) => d.matchEventKey).map((d) => [d.matchEventKey as string, d]),
  )
  const byDayKey = new Map<string, DailyAggregationAcc>()

  for (const event of events) {
    let conversionKey = resolveConversionKeyForEvent({
      eventKey: event.eventKey,
      customConversionKey: event.customConversionKey,
    })
    let definitionId: string | null = null
    const matchedDef = defByMatch.get(event.eventKey) ?? (conversionKey ? defByKey.get(conversionKey) : undefined)
    if (matchedDef) {
      definitionId = matchedDef.id
      conversionKey = matchedDef.key
    }
    if (!conversionKey) continue
    const day = utcPeriodDate(event.occurredAt)
    const mapKey = `${periodDateIso(day)}:${conversionKey}`
    let acc = byDayKey.get(mapKey)
    if (!acc) {
      acc = { count: 0, uniqueRefs: new Set(), definitionId, conversionKey }
      byDayKey.set(mapKey, acc)
    }
    acc.count += 1
    const uniqueRef = event.sessionRef ?? event.visitorRef
    if (uniqueRef) acc.uniqueRefs.add(uniqueRef)
  }
  return byDayKey
}

export type DailyAggregationResult = {
  managedSiteId: string
  periodDate: string
  rowsWritten: number
  eventsProcessed: number
}

export async function aggregateFirstPartyConversionsForSite(input: {
  customerAccountId: string
  managedSiteId: string
  periodStartUtc: Date
  periodEndUtc: Date
}): Promise<DailyAggregationResult> {
  const periodDateStr = periodDateIso(input.periodStartUtc)
  const periodDate = utcPeriodDate(input.periodStartUtc)

  const events = await prisma.webxxlConversionEvent.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      consentGranted: true,
      occurredAt: { gte: input.periodStartUtc, lt: input.periodEndUtc },
    },
    select: {
      eventKey: true,
      customConversionKey: true,
      occurredAt: true,
      sessionRef: true,
      visitorRef: true,
    },
  })

  const defs = await prisma.analyticsConversionDefinition.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      isActive: true,
      OR: [{ managedSiteId: input.managedSiteId }, { managedSiteId: null }],
    },
    select: { id: true, key: true, matchEventKey: true },
  })

  const byDayKey = buildDailyAggregationMap(events, defs)

  const existing = await prisma.analyticsConversionObservation.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      sourceProvider: 'WEBXXL_EVENTS',
      periodDate: { gte: input.periodStartUtc, lt: input.periodEndUtc },
    },
    select: { conversionKey: true },
  })

  const keysToWrite = new Set<string>([...BUILTIN_CONVERSION_EVENT_KEYS, ...defs.map((d) => d.key)])
  for (const mapKey of byDayKey.keys()) keysToWrite.add(mapKey.split(':')[1]!)
  for (const row of existing) keysToWrite.add(row.conversionKey)

  let rowsWritten = 0
  const observedAt = new Date()

  for (const conversionKey of keysToWrite) {
    const acc = byDayKey.get(`${periodDateStr}:${conversionKey}`)
    const count = acc?.count ?? 0
    const uniqueCount = acc ? computeUniqueConversionCount(acc.count, acc.uniqueRefs) : 0
    const idempotencyKey = buildConversionObservationIdempotencyKey({
      managedSiteId: input.managedSiteId,
      conversionKey,
      periodDate: periodDateStr,
      sourceProvider: 'WEBXXL_EVENTS',
    })
    await prisma.analyticsConversionObservation.upsert({
      where: { idempotencyKey },
      create: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        definitionId: acc?.definitionId ?? null,
        conversionKey,
        count,
        uniqueCount,
        periodDate,
        dataState: count > 0 ? 'READY' : 'PARTIAL',
        sourceProvider: 'WEBXXL_EVENTS',
        observedAt,
        idempotencyKey,
      },
      update: {
        count,
        uniqueCount,
        definitionId: acc?.definitionId ?? null,
        observedAt,
        dataState: count > 0 ? 'READY' : 'PARTIAL',
      },
    })
    rowsWritten += 1
  }

  return {
    managedSiteId: input.managedSiteId,
    periodDate: periodDateStr,
    rowsWritten,
    eventsProcessed: events.length,
  }
}

export function utcDayBounds(date: Date): { start: Date; end: Date } {
  const start = utcPeriodDate(date)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}
