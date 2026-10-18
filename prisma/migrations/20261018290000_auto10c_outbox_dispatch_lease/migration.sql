-- AUTO-10C: durable outbox dispatch lease fields (additive)

ALTER TABLE "WorkflowOutbox"
  ADD COLUMN IF NOT EXISTS "dispatchLeaseToken" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchLeaseOwner" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "WorkflowOutbox_status_dispatchLeaseExpiresAt_idx"
  ON "WorkflowOutbox"("status", "dispatchLeaseExpiresAt");
