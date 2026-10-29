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

/** Thrown inside a Prisma transaction when artifact status cannot follow review submission. */
export class ApprovalSubmitArtifactUpdateError extends Error {
  readonly code = 'APPROVAL_SUBMIT_ARTIFACT_UPDATE' as const

  constructor(message = 'Artifact revision changed during review submission; submission rolled back') {
    super(message)
    this.name = 'ApprovalSubmitArtifactUpdateError'
  }
}

/** Thrown when an actionable pending review already exists for the artifact revision. */
export class ApprovalSubmitDuplicatePendingError extends Error {
  readonly code = 'APPROVAL_SUBMIT_DUPLICATE_PENDING' as const

  constructor(message = 'An active review is already pending for this artifact revision') {
    super(message)
    this.name = 'ApprovalSubmitDuplicatePendingError'
  }
}
