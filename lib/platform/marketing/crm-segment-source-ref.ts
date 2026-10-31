export const CRM_SEGMENT_SOURCE_REF_PREFIX = 'crm:segment:'

export function buildCrmSegmentSourceRef(segmentId: string): string {
  return `${CRM_SEGMENT_SOURCE_REF_PREFIX}${segmentId}`
}

export function parseCrmSegmentSourceRef(ref: string): string | null {
  if (!ref.startsWith(CRM_SEGMENT_SOURCE_REF_PREFIX)) return null
  const segmentId = ref.slice(CRM_SEGMENT_SOURCE_REF_PREFIX.length).trim()
  return segmentId.length > 0 ? segmentId : null
}
