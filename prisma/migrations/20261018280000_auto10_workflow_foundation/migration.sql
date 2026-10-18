-- AUTO-10: durable workflow execution foundation

CREATE TYPE "WorkflowJobStatus" AS ENUM (
  'PENDING', 'READY', 'CLAIMED', 'RUNNING', 'RETRY_WAIT', 'BLOCKED',
  'AWAITING_RECONCILIATION', 'COMPLETED', 'FAILED_TERMINAL', 'DEAD_LETTER', 'PAUSED', 'CANCELLED'
);

CREATE TYPE "WorkflowOutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED', 'RECONCILIATION_REQUIRED');

CREATE TYPE "WorkflowErrorClass" AS ENUM (
  'TRANSIENT', 'RATE_LIMITED', 'TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PERMANENT',
  'AUTHORIZATION_FAILED', 'POLICY_DENIED', 'CONFIGURATION_MISSING', 'UNKNOWN_EXTERNAL_OUTCOME'
);

ALTER TABLE "AutomationDeliveryJob"
  ADD COLUMN IF NOT EXISTS "claimOwner" TEXT,
  ADD COLUMN IF NOT EXISTS "claimToken" TEXT,
  ADD COLUMN IF NOT EXISTS "claimExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "claimFence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkflowJob" (
  "id" TEXT NOT NULL,
  "jobKind" TEXT NOT NULL,
  "customerAccountId" TEXT,
  "managedSiteId" TEXT,
  "billingGroupId" TEXT,
  "correlationId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceRevisionHash" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "WorkflowJobStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMPTZ,
  "leaseFence" INTEGER NOT NULL DEFAULT 0,
  "heartbeatAt" TIMESTAMPTZ,
  "lastErrorCode" TEXT,
  "lastErrorClass" "WorkflowErrorClass",
  "resultRef" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "completedAt" TIMESTAMPTZ,
  CONSTRAINT "WorkflowJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowJob_idempotencyKey_key" ON "WorkflowJob"("idempotencyKey");
CREATE INDEX "WorkflowJob_status_nextAttemptAt_priority_idx" ON "WorkflowJob"("status", "nextAttemptAt", "priority");
CREATE INDEX "WorkflowJob_customerAccountId_status_createdAt_idx" ON "WorkflowJob"("customerAccountId", "status", "createdAt");
CREATE INDEX "WorkflowJob_jobKind_status_idx" ON "WorkflowJob"("jobKind", "status");
CREATE INDEX "WorkflowJob_leaseExpiresAt_idx" ON "WorkflowJob"("leaseExpiresAt");

ALTER TABLE "WorkflowJob" ADD CONSTRAINT "WorkflowJob_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorkflowAttempt" (
  "id" TEXT NOT NULL,
  "workflowJobId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseFence" INTEGER NOT NULL DEFAULT 0,
  "status" "WorkflowJobStatus" NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ,
  "errorCode" TEXT,
  "errorClass" "WorkflowErrorClass",
  "resultRef" TEXT,
  CONSTRAINT "WorkflowAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowAttempt_workflowJobId_attemptNumber_key" ON "WorkflowAttempt"("workflowJobId", "attemptNumber");
CREATE INDEX "WorkflowAttempt_workflowJobId_startedAt_idx" ON "WorkflowAttempt"("workflowJobId", "startedAt");

ALTER TABLE "WorkflowAttempt" ADD CONSTRAINT "WorkflowAttempt_workflowJobId_fkey"
  FOREIGN KEY ("workflowJobId") REFERENCES "WorkflowJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "workflowJobId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "WorkflowJobStatus",
  "toStatus" "WorkflowJobStatus",
  "actorUserId" TEXT,
  "actorService" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEvent_workflowJobId_createdAt_idx" ON "WorkflowEvent"("workflowJobId", "createdAt");

ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflowJobId_fkey"
  FOREIGN KEY ("workflowJobId") REFERENCES "WorkflowJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowOutbox" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "customerAccountId" TEXT,
  "jobKind" TEXT NOT NULL,
  "payloadRef" JSONB NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "WorkflowOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "workflowJobId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMPTZ,
  CONSTRAINT "WorkflowOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowOutbox_eventKey_key" ON "WorkflowOutbox"("eventKey");
CREATE INDEX "WorkflowOutbox_status_createdAt_idx" ON "WorkflowOutbox"("status", "createdAt");

CREATE TABLE "WorkflowDeadLetter" (
  "id" TEXT NOT NULL,
  "workflowJobId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "errorClass" "WorkflowErrorClass",
  "quarantined" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowDeadLetter_workflowJobId_createdAt_idx" ON "WorkflowDeadLetter"("workflowJobId", "createdAt");

ALTER TABLE "WorkflowDeadLetter" ADD CONSTRAINT "WorkflowDeadLetter_workflowJobId_fkey"
  FOREIGN KEY ("workflowJobId") REFERENCES "WorkflowJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowRepairAudit" (
  "id" TEXT NOT NULL,
  "workflowJobId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRepairAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowRepairAudit_workflowJobId_createdAt_idx" ON "WorkflowRepairAudit"("workflowJobId", "createdAt");
