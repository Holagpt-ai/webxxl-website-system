/** Safe retrieval envelope for future LLM RAG (no vectors in AI-CUSTOMER-13). */
export type CustomerAiKnowledgeRetrievalChunk = {
  knowledgePublicId: string
  revisionNumber: number
  kind: string
  languageTag: string
  title: string
  excerpt: string
  classification: string
  publishedAt: string | null
}

export type CustomerAiKnowledgeRetrievalResult = {
  accountId: string
  employeeId: string | null
  locale: string
  chunks: CustomerAiKnowledgeRetrievalChunk[]
  executionEnabled: false
}

export function buildRetrievalResult(input: Omit<CustomerAiKnowledgeRetrievalResult, 'executionEnabled'>): CustomerAiKnowledgeRetrievalResult {
  return { ...input, executionEnabled: false }
}
