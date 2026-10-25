import { prisma } from '@/lib/db'
import { buildConversionObservationIdempotencyKey } from '@/lib/platform/analytics/ids'
import { resolveConversionKeyForEvent } from '@/lib/platform/analytics/capture/event-keys'

function utcPeriodDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function periodDateIso(d: Date): string {
  return d.toISOString().slice(0, 10)
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
  const defByKey = new Map(defs.map((d) => [d.key, d]))
  const defByMatch = new Map(
    defs.filter((d) => d.matchEventKey).map((d) => [d.matchEventKey as string, d]),
  )

  type Acc = { count: number; uniqueRefs: Set<string>; definitionId: string | null; conversionKey: string }
  const byDayKey = new Map<string, Acc>()

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

  let rowsWritten = 0
  const observedAt = new Date()
  for (const [mapKey, acc] of byDayKey) {
    const periodDateStr = mapKey.split(':')[0]!
    const periodDate = utcPeriodDate(new Date(`${periodDateStr}T00:00:00.000Z`))
    const idempotencyKey = buildConversionObservationIdempotencyKey({
      managedSiteId: input.managedSiteId,
      conversionKey: acc.conversionKey,
      periodDate: periodDateStr,
      sourceProvider: 'WEBXXL_EVENTS',
    })
    await prisma.analyticsConversionObservation.upsert({
      where: { idempotencyKey },
      create: {
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        definitionId: acc.definitionId,
        conversionKey: acc.conversionKey,
        count: acc.count,
        uniqueCount: acc.uniqueRefs.size || acc.count,
        periodDate,
        dataState: 'READY',
        sourceProvider: 'WEBXXL_EVENTS',
        observedAt,
        idempotencyKey,
      },
      update: {
        count: acc.count,
        uniqueCount: acc.uniqueRefs.size || acc.count,
        definitionId: acc.definitionId,
        observedAt,
        dataState: 'READY',
      },
    })
    rowsWritten += 1
  }

  return {
    managedSiteId: input.managedSiteId,
    periodDate: periodDateIso(input.periodStartUtc),
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
