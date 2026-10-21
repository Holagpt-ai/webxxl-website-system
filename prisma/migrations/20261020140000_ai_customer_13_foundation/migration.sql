-- AI-CUSTOMER-13: customer AI workforce foundation (additive)

CREATE TYPE "CustomerAiEmployeeStatus" AS ENUM ('DRAFT', 'INACTIVE', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "CustomerAiKnowledgeKind" AS ENUM ('BUSINESS_PROFILE', 'SERVICE_INFO', 'FAQ', 'DOCUMENT', 'REFERENCE');
CREATE TYPE "CustomerAiKnowledgeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CustomerAiChatSessionStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED', 'HANDOFF_PENDING', 'HANDOFF_ACTIVE');
CREATE TYPE "CustomerAiChatMessageRole" AS ENUM ('VISITOR', 'ASSISTANT', 'SYSTEM', 'OPERATOR');
CREATE TYPE "CustomerAiHandoffStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CustomerAiToolAccessMode" AS ENUM ('READ', 'WRITE');

CREATE TABLE "CustomerAiEmployee" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "projectId" TEXT,
    "displayName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "description" TEXT,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "primaryLocale" TEXT NOT NULL DEFAULT 'en',
    "secondaryLocales" JSONB NOT NULL DEFAULT '[]',
    "status" "CustomerAiEmployeeStatus" NOT NULL DEFAULT 'DRAFT',
    "entitlementKey" TEXT NOT NULL DEFAULT 'future.ai-employee',
    "emergencyPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiEmployee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiEmployee_publicId_key" ON "CustomerAiEmployee"("publicId");
CREATE INDEX "CustomerAiEmployee_customerAccountId_status_idx" ON "CustomerAiEmployee"("customerAccountId", "status");
CREATE INDEX "CustomerAiEmployee_customerAccountId_createdAt_idx" ON "CustomerAiEmployee"("customerAccountId", "createdAt");

ALTER TABLE "CustomerAiEmployee" ADD CONSTRAINT "CustomerAiEmployee_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAiEmployee" ADD CONSTRAINT "CustomerAiEmployee_managedSiteId_fkey"
  FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiEmployee" ADD CONSTRAINT "CustomerAiEmployee_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiEmployee" ADD CONSTRAINT "CustomerAiEmployee_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiEmployee" ADD CONSTRAINT "CustomerAiEmployee_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CustomerAiEmployeeAuditEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "CustomerAiEmployeeStatus",
    "toStatus" "CustomerAiEmployeeStatus",
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiEmployeeAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAiEmployeeAuditEvent_employeeId_createdAt_idx" ON "CustomerAiEmployeeAuditEvent"("employeeId", "createdAt");
CREATE INDEX "CustomerAiEmployeeAuditEvent_customerAccountId_createdAt_idx" ON "CustomerAiEmployeeAuditEvent"("customerAccountId", "createdAt");

ALTER TABLE "CustomerAiEmployeeAuditEvent" ADD CONSTRAINT "CustomerAiEmployeeAuditEvent_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "CustomerAiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiKnowledgeItem" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "kind" "CustomerAiKnowledgeKind" NOT NULL,
    "status" "CustomerAiKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "languageTag" TEXT NOT NULL DEFAULT 'en',
    "classification" "CommsDataClassification" NOT NULL DEFAULT 'GENERAL_BUSINESS',
    "currentRevisionId" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiKnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiKnowledgeItem_publicId_key" ON "CustomerAiKnowledgeItem"("publicId");
CREATE INDEX "CustomerAiKnowledgeItem_customerAccountId_status_idx" ON "CustomerAiKnowledgeItem"("customerAccountId", "status");
CREATE INDEX "CustomerAiKnowledgeItem_customerAccountId_kind_languageTag_idx" ON "CustomerAiKnowledgeItem"("customerAccountId", "kind", "languageTag");

ALTER TABLE "CustomerAiKnowledgeItem" ADD CONSTRAINT "CustomerAiKnowledgeItem_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerAiKnowledgeRevision" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "contentJson" JSONB NOT NULL,
    "provenanceJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiKnowledgeRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiKnowledgeRevision_knowledgeItemId_revisionNumber_key" ON "CustomerAiKnowledgeRevision"("knowledgeItemId", "revisionNumber");

ALTER TABLE "CustomerAiKnowledgeRevision" ADD CONSTRAINT "CustomerAiKnowledgeRevision_knowledgeItemId_fkey"
  FOREIGN KEY ("knowledgeItemId") REFERENCES "CustomerAiKnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiEmployeeToolPermission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "accessMode" "CustomerAiToolAccessMode" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedByUserId" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiEmployeeToolPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiEmployeeToolPermission_employeeId_toolKey_accessMode_key" ON "CustomerAiEmployeeToolPermission"("employeeId", "toolKey", "accessMode");
CREATE INDEX "CustomerAiEmployeeToolPermission_customerAccountId_toolKey_idx" ON "CustomerAiEmployeeToolPermission"("customerAccountId", "toolKey");

ALTER TABLE "CustomerAiEmployeeToolPermission" ADD CONSTRAINT "CustomerAiEmployeeToolPermission_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "CustomerAiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiChatSession" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "employeeId" TEXT,
    "managedSiteId" TEXT,
    "status" "CustomerAiChatSessionStatus" NOT NULL DEFAULT 'OPEN',
    "visitorRef" TEXT,
    "visitorLocale" TEXT,
    "chatwootConversationMappingId" TEXT,
    "dataClassification" "CommsDataClassification" NOT NULL DEFAULT 'GENERAL_BUSINESS',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiChatSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiChatSession_publicId_key" ON "CustomerAiChatSession"("publicId");
CREATE INDEX "CustomerAiChatSession_customerAccountId_status_lastMessageAt_idx" ON "CustomerAiChatSession"("customerAccountId", "status", "lastMessageAt");
CREATE INDEX "CustomerAiChatSession_employeeId_status_idx" ON "CustomerAiChatSession"("employeeId", "status");

ALTER TABLE "CustomerAiChatSession" ADD CONSTRAINT "CustomerAiChatSession_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAiChatSession" ADD CONSTRAINT "CustomerAiChatSession_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "CustomerAiEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiChatSession" ADD CONSTRAINT "CustomerAiChatSession_managedSiteId_fkey"
  FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAiChatSession" ADD CONSTRAINT "CustomerAiChatSession_chatwootConversationMappingId_fkey"
  FOREIGN KEY ("chatwootConversationMappingId") REFERENCES "ChatwootConversationMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CustomerAiChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "role" "CustomerAiChatMessageRole" NOT NULL,
    "bodyText" TEXT NOT NULL,
    "contentJson" JSONB,
    "ingestionSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiChatMessage_sessionId_idempotencyKey_key" ON "CustomerAiChatMessage"("sessionId", "idempotencyKey");
CREATE INDEX "CustomerAiChatMessage_customerAccountId_createdAt_idx" ON "CustomerAiChatMessage"("customerAccountId", "createdAt");

ALTER TABLE "CustomerAiChatMessage" ADD CONSTRAINT "CustomerAiChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CustomerAiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiHandoffRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "CustomerAiHandoffStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "requestedByUserId" TEXT,
    "assignedUserId" TEXT,
    "chatwootHandoffRef" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAiHandoffRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAiHandoffRequest_sessionId_status_idx" ON "CustomerAiHandoffRequest"("sessionId", "status");
CREATE INDEX "CustomerAiHandoffRequest_customerAccountId_createdAt_idx" ON "CustomerAiHandoffRequest"("customerAccountId", "createdAt");

ALTER TABLE "CustomerAiHandoffRequest" ADD CONSTRAINT "CustomerAiHandoffRequest_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CustomerAiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiConversationAuditEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiConversationAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAiConversationAuditEvent_sessionId_createdAt_idx" ON "CustomerAiConversationAuditEvent"("sessionId", "createdAt");

ALTER TABLE "CustomerAiConversationAuditEvent" ADD CONSTRAINT "CustomerAiConversationAuditEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "CustomerAiChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerAiAccountUsagePolicy" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "maxActiveEmployees" INTEGER NOT NULL DEFAULT 0,
    "monthlyMessageBudget" INTEGER,
    "monthlyTokenBudget" INTEGER,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 0,
    "executionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emergencyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiAccountUsagePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiAccountUsagePolicy_customerAccountId_key" ON "CustomerAiAccountUsagePolicy"("customerAccountId");

ALTER TABLE "CustomerAiAccountUsagePolicy" ADD CONSTRAINT "CustomerAiAccountUsagePolicy_customerAccountId_fkey"
  FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerAiEmployeeUsageCounter" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "messagesIngested" INTEGER NOT NULL DEFAULT 0,
    "tokensReserved" INTEGER NOT NULL DEFAULT 0,
    "toolCallsAuthorized" INTEGER NOT NULL DEFAULT 0,
    "toolCallsDenied" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAiEmployeeUsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAiEmployeeUsageCounter_employeeId_periodKey_key" ON "CustomerAiEmployeeUsageCounter"("employeeId", "periodKey");
CREATE INDEX "CustomerAiEmployeeUsageCounter_customerAccountId_periodKey_idx" ON "CustomerAiEmployeeUsageCounter"("customerAccountId", "periodKey");

ALTER TABLE "CustomerAiEmployeeUsageCounter" ADD CONSTRAINT "CustomerAiEmployeeUsageCounter_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "CustomerAiEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
