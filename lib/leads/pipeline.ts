import type { LeadStage } from '@prisma/client'

/** Ordered pipeline stages — extend here for future CRM alignment. */
export const LEAD_PIPELINE_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
] as const satisfies readonly LeadStage[]

export type LeadPipelineStage = (typeof LEAD_PIPELINE_STAGES)[number]

export const LEAD_STAGE_LABELS: Record<LeadPipelineStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  PROPOSAL_SENT: 'Proposal sent',
  WON: 'Won',
  LOST: 'Lost',
}

export function isLeadPipelineStage(value: string): value is LeadPipelineStage {
  return (LEAD_PIPELINE_STAGES as readonly string[]).includes(value)
}
