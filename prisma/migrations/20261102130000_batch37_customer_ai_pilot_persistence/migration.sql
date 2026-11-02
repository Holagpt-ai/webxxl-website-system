-- Batch 37: durable customer AI pilot task + approval persistence (Git only; not applied production)

CREATE TYPE "CustomerAiPilotWorkflowKind" AS ENUM ('crm_lead_intelligence', 'marketing_seo_assistant', 'receptionist_preparation');
CREATE TYPE "CustomerAiPilotOutcome" AS ENUM ('PREPARED', 'PENDING_APPROVAL', 'BLOCKED', 'UNVERIFIED');
CREATE TYPE "CustomerAiPilotWorkflowSyncState" AS ENUM ('NOT_QUEUED', 'QUEUED', 'VALIDATED', 'FAILED');

CREATE TABLE "CustomerAiPilotTask" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "employeeId" TEXT NOT NULL,
    "workflowKind" "CustomerAiPilotWorkflowKind" NOT NULL,
    "toolKey" TEXT NOT NULL,
    "accessMode" "CustomerAiToolAccessMode" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "outcome" "CustomerAiPilotOutcome" NOT NULL,
    "actionHash" TEXT NOT NULL,
    "draftPayload" JSONB NOT NULL DEFAULT '{}',
    "provenanceJson" JSONB NOT NULL DEFAULT '{}',
    "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalId" TEXT,
    "estimatedCostUnits" INTEGER,
    "blockedReason" TEXT,
    "workflowJobId" TEXT,
    "workflowSyncState" "CustomerAiPilotWorkflowSyncState" NOT NULL DEFAULT 'NOT_QUEUED',
    "workflowValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiPilotTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAiPilotApproval" (
    "id" TEXT NOT NULL,
    "preparedTaskId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "employeeId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "workflowKind" "CustomerAiPilotWorkflowKind" NOT NULL,
    "actionHash" TEXT NOT NULL,
    "allowedAction" TEXT NOT NULL,
    "destinationRef" TEXT,
    "approvedByUserId" TEXT NOT NULL,
    "approverPlatformRole" TEXT NOT NULL,
    "maxCostUnits" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiPilotApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiPilotTask_publicId_key" ON "CustomerAiPilotTask"("publicId");
CREATE UNIQUE INDEX "CustomerAiPilotTask_workflowJobId_key" ON "CustomerAiPilotTask"("workflowJobId");
CREATE UNIQUE INDEX "CustomerAiPilotTask_customerAccountId_employeeId_idempotencyKey_key" ON "CustomerAiPilotTask"("customerAccountId", "employeeId", "idempotencyKey");
CREATE INDEX "CustomerAiPilotTask_customerAccountId_createdAt_idx" ON "CustomerAiPilotTask"("customerAccountId", "createdAt");
CREATE INDEX "CustomerAiPilotTask_employeeId_createdAt_idx" ON "CustomerAiPilotTask"("employeeId", "createdAt");

CREATE UNIQUE INDEX "CustomerAiPilotApproval_preparedTaskId_key" ON "CustomerAiPilotApproval"("preparedTaskId");
CREATE INDEX "CustomerAiPilotApproval_customerAccountId_createdAt_idx" ON "CustomerAiPilotApproval"("customerAccountId", "createdAt");

ALTER TABLE "CustomerAiPilotTask" ADD CONSTRAINT "CustomerAiPilotTask_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAiPilotTask" ADD CONSTRAINT "CustomerAiPilotTask_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiPilotTask" ADD CONSTRAINT "CustomerAiPilotTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "CustomerAiEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerAiPilotApproval" ADD CONSTRAINT "CustomerAiPilotApproval_preparedTaskId_fkey" FOREIGN KEY ("preparedTaskId") REFERENCES "CustomerAiPilotTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAiPilotApproval" ADD CONSTRAINT "CustomerAiPilotApproval_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
