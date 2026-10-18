-- AGENT-03 internal workforce (additive)

CREATE TYPE "WorkforceTaskStatus" AS ENUM ('DRAFT', 'QUEUED', 'AWAITING_APPROVAL', 'AUTHORIZED', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED');
CREATE TYPE "WorkforceExecutionPhase" AS ENUM ('TASK_PREPARED', 'TASK_AUTHORIZED', 'PROVIDER_ACCEPTED', 'WORK_IN_PROGRESS', 'ARTIFACT_PRODUCED', 'REVIEW_REQUIRED', 'COMPLETED');
CREATE TYPE "WorkforceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "WorkforcePauseScope" AS ENUM ('GLOBAL', 'AGENT', 'TASK', 'PROVIDER');

CREATE TABLE "InternalAgentDefinition" (
    "id" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "configVersion" TEXT NOT NULL,
    "riskTier" INTEGER NOT NULL,
    "providerAdapterKey" TEXT NOT NULL DEFAULT 'synthetic',
    "liveExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "allowedToolKeys" JSONB NOT NULL,
    "deniedActions" JSONB NOT NULL,
    "budgetLimitSubunits" INTEGER,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalAgentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalAgentDefinition_roleKey_key" ON "InternalAgentDefinition"("roleKey");

CREATE TABLE "InternalAgentConfiguration" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalAgentConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalAgentConfiguration_definitionId_version_key" ON "InternalAgentConfiguration"("definitionId", "version");

CREATE TABLE "WorkforceTask" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT,
    "status" "WorkforceTaskStatus" NOT NULL DEFAULT 'DRAFT',
    "executionPhase" "WorkforceExecutionPhase",
    "internalAgentKey" TEXT NOT NULL,
    "definitionId" TEXT,
    "requestedByUserId" TEXT,
    "customerAccountId" TEXT,
    "managedSiteId" TEXT,
    "projectId" TEXT,
    "capability" TEXT NOT NULL,
    "inputArtifactRef" TEXT,
    "inputHash" TEXT NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "dependsOnTaskId" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT 'synthetic',
    "externalProviderRunId" TEXT,
    "externalProviderRef" TEXT,
    "resultArtifactRef" TEXT,
    "errorCode" TEXT,
    "errorClass" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkforceTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkforceTask_idempotencyKey_key" ON "WorkforceTask"("idempotencyKey");
CREATE INDEX "WorkforceTask_status_updatedAt_idx" ON "WorkforceTask"("status", "updatedAt");
CREATE INDEX "WorkforceTask_internalAgentKey_status_idx" ON "WorkforceTask"("internalAgentKey", "status");
CREATE INDEX "WorkforceTask_customerAccountId_createdAt_idx" ON "WorkforceTask"("customerAccountId", "createdAt");
CREATE INDEX "WorkforceTask_correlationId_idx" ON "WorkforceTask"("correlationId");

CREATE TABLE "WorkforceExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "phase" "WorkforceExecutionPhase" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "externalProviderRunId" TEXT,
    "status" "WorkforceTaskStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "resultArtifactRef" TEXT,
    "errorCode" TEXT,

    CONSTRAINT "WorkforceExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkforceExecution_taskId_attemptNumber_key" ON "WorkforceExecution"("taskId", "attemptNumber");
CREATE INDEX "WorkforceExecution_providerKey_startedAt_idx" ON "WorkforceExecution"("providerKey", "startedAt");

CREATE TABLE "WorkforceToolCall" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "executionId" TEXT,
    "toolKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "approvalId" TEXT,
    "decision" "AgentToolDecision" NOT NULL,
    "denialReason" TEXT,
    "customerAccountId" TEXT,
    "managedSiteId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceToolCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkforceToolCall_requestId_toolKey_key" ON "WorkforceToolCall"("requestId", "toolKey");
CREATE INDEX "WorkforceToolCall_taskId_createdAt_idx" ON "WorkforceToolCall"("taskId", "createdAt");

CREATE TABLE "WorkforceApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "WorkforceApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "capability" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "approvedScope" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkforceApproval_taskId_status_idx" ON "WorkforceApproval"("taskId", "status");
CREATE INDEX "WorkforceApproval_approverUserId_createdAt_idx" ON "WorkforceApproval"("approverUserId", "createdAt");

CREATE TABLE "WorkforceBudgetUsage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "internalAgentKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amountSubunits" INTEGER NOT NULL DEFAULT 0,
    "costSubunits" INTEGER NOT NULL DEFAULT 0,
    "tokenUnits" INTEGER NOT NULL DEFAULT 0,
    "reservedSubunits" INTEGER NOT NULL DEFAULT 0,
    "settledSubunits" INTEGER NOT NULL DEFAULT 0,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkforceBudgetUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkforceBudgetUsage_idempotencyKey_key" ON "WorkforceBudgetUsage"("idempotencyKey");
CREATE INDEX "WorkforceBudgetUsage_internalAgentKey_periodKey_idx" ON "WorkforceBudgetUsage"("internalAgentKey", "periodKey");

CREATE TABLE "WorkforceAuditEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkforceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkforceAuditEvent_taskId_createdAt_idx" ON "WorkforceAuditEvent"("taskId", "createdAt");
CREATE INDEX "WorkforceAuditEvent_eventKind_createdAt_idx" ON "WorkforceAuditEvent"("eventKind", "createdAt");

CREATE TABLE "WorkforcePauseControl" (
    "id" TEXT NOT NULL,
    "scope" "WorkforcePauseScope" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "setByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "WorkforcePauseControl_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkforcePauseControl_scope_targetKey_active_idx" ON "WorkforcePauseControl"("scope", "targetKey", "active");

ALTER TABLE "InternalAgentConfiguration" ADD CONSTRAINT "InternalAgentConfiguration_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "InternalAgentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkforceTask" ADD CONSTRAINT "WorkforceTask_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "InternalAgentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkforceTask" ADD CONSTRAINT "WorkforceTask_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkforceTask" ADD CONSTRAINT "WorkforceTask_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkforceExecution" ADD CONSTRAINT "WorkforceExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkforceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkforceToolCall" ADD CONSTRAINT "WorkforceToolCall_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkforceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkforceApproval" ADD CONSTRAINT "WorkforceApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkforceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkforceApproval" ADD CONSTRAINT "WorkforceApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkforceBudgetUsage" ADD CONSTRAINT "WorkforceBudgetUsage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkforceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkforceAuditEvent" ADD CONSTRAINT "WorkforceAuditEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkforceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkforceAuditEvent" ADD CONSTRAINT "WorkforceAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkforcePauseControl" ADD CONSTRAINT "WorkforcePauseControl_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
