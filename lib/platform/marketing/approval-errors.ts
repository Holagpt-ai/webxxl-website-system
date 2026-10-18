/** Thrown inside a Prisma transaction to roll back a partial approval decision. */
export class ApprovalArtifactCasRollbackError extends Error {
  readonly code = 'APPROVAL_ARTIFACT_CAS_ROLLBACK' as const

  constructor(message = 'Artifact revision changed during approval; decision rolled back') {
    super(message)
    this.name = 'ApprovalArtifactCasRollbackError'
  }
}

export class ApprovalReviewConcurrentDecisionError extends Error {
  readonly code = 'APPROVAL_REVIEW_CONCURRENT' as const

  constructor(message = 'Review already decided concurrently') {
    super(message)
    this.name = 'ApprovalReviewConcurrentDecisionError'
  }
}
