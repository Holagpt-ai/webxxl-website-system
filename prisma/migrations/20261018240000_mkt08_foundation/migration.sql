-- MKT-08: marketing request lifecycle, artifacts, brand context, lead follow-up

ALTER TYPE "MarketingRequestStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'VALIDATING';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'PREPARING';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'DRAFT_READY';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'AWAITING_REVIEW';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'REVISION_REQUESTED';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'HANDED_OFF';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'FAILED';
ALTER TYPE "MarketingRequestStatus" ADD VALUE 'CANCELLED';

CREATE TYPE "MarketingGenerationMode" AS ENUM ('DETERMINISTIC_DRAFT', 'SYNTHETIC_TEST', 'AI_GENERATED');
CREATE TYPE "MarketingContentSafetyClass" AS ENUM ('GENERAL_BUSINESS', 'REGULATED_HEALTHCARE', 'REQUIRES_HUMAN_REVIEW', 'PROHIBITED_CONTENT', 'SOURCE_UNVERIFIED');
CREATE TYPE "MarketingArtifactReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "MarketingFollowUpResolutionState" AS ENUM ('OPEN', 'TASK_PREPARED', 'DISMISSED', 'RESOLVED');

ALTER TABLE "MarketingRequest" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "MarketingRequest" ADD COLUMN "requestFingerprint" TEXT;
ALTER TABLE "MarketingRequest" ADD COLUMN "seoOpportunityId" TEXT;
ALTER TABLE "MarketingRequest" ADD COLUMN "assignedWorkflow" TEXT;

CREATE UNIQUE INDEX "MarketingRequest_idempotencyKey_key" ON "MarketingRequest"("idempotencyKey");
CREATE INDEX "MarketingRequest_customerAccountId_managedSiteId_idx" ON "MarketingRequest"("customerAccountId", "managedSiteId");

ALTER TABLE "MarketingArtifact" ADD COLUMN "marketingRequestId" TEXT;
ALTER TABLE "MarketingArtifact" ADD COLUMN "generationMode" "MarketingGenerationMode" NOT NULL DEFAULT 'DETERMINISTIC_DRAFT';
ALTER TABLE "MarketingArtifact" ADD COLUMN "reviewStatus" "MarketingArtifactReviewStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "MarketingArtifact" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "MarketingArtifact" ADD COLUMN "brandContextVersionId" TEXT;
ALTER TABLE "MarketingArtifact" ADD COLUMN "safetyClass" "MarketingContentSafetyClass" NOT NULL DEFAULT 'GENERAL_BUSINESS';

CREATE INDEX "MarketingArtifact_marketingRequestId_idx" ON "MarketingArtifact"("marketingRequestId");

ALTER TABLE "MarketingArtifact" ADD CONSTRAINT "MarketingArtifact_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MarketingRequestStatusEvent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "marketingRequestId" TEXT NOT NULL,
    "fromStatus" "MarketingRequestStatus",
    "toStatus" "MarketingRequestStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingRequestStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingRequestStatusEvent_marketingRequestId_createdAt_idx" ON "MarketingRequestStatusEvent"("marketingRequestId", "createdAt");
CREATE INDEX "MarketingRequestStatusEvent_customerAccountId_createdAt_idx" ON "MarketingRequestStatusEvent"("customerAccountId", "createdAt");
ALTER TABLE "MarketingRequestStatusEvent" ADD CONSTRAINT "MarketingRequestStatusEvent_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingRequestStatusEvent" ADD CONSTRAINT "MarketingRequestStatusEvent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketingArtifactRevision" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "marketingRequestId" TEXT,
    "marketingArtifactId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "artifactType" "MarketingArtifactType" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "structuredContent" JSONB NOT NULL,
    "mediaRefs" JSONB,
    "ctaDestinations" JSONB,
    "channelPlacement" TEXT,
    "brandContextVersionId" TEXT,
    "complianceVersion" TEXT NOT NULL DEFAULT 'mkt-08-v1',
    "generationMode" "MarketingGenerationMode" NOT NULL DEFAULT 'DETERMINISTIC_DRAFT',
    "generatorIdentity" TEXT NOT NULL,
    "modelVersion" TEXT,
    "safetyClass" "MarketingContentSafetyClass" NOT NULL DEFAULT 'GENERAL_BUSINESS',
    "previousRevisionId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingArtifactRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingArtifactRevision_marketingArtifactId_revisionNumber_key" ON "MarketingArtifactRevision"("marketingArtifactId", "revisionNumber");
CREATE UNIQUE INDEX "MarketingArtifactRevision_customerAccountId_revisionHash_key" ON "MarketingArtifactRevision"("customerAccountId", "revisionHash");
CREATE INDEX "MarketingArtifactRevision_marketingRequestId_createdAt_idx" ON "MarketingArtifactRevision"("marketingRequestId", "createdAt");
ALTER TABLE "MarketingArtifactRevision" ADD CONSTRAINT "MarketingArtifactRevision_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingArtifactRevision" ADD CONSTRAINT "MarketingArtifactRevision_marketingArtifactId_fkey" FOREIGN KEY ("marketingArtifactId") REFERENCES "MarketingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingArtifactRevision" ADD CONSTRAINT "MarketingArtifactRevision_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketingArtifactReview" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "marketingRequestId" TEXT NOT NULL,
    "marketingArtifactId" TEXT NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "intendedAction" TEXT NOT NULL,
    "allowedChannel" TEXT,
    "allowedTarget" TEXT,
    "status" "MarketingArtifactReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approverUserId" TEXT,
    "policyVersion" TEXT NOT NULL DEFAULT 'mkt-08-v1',
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingArtifactReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingArtifactReview_customerAccountId_status_idx" ON "MarketingArtifactReview"("customerAccountId", "status");
CREATE INDEX "MarketingArtifactReview_revisionHash_idx" ON "MarketingArtifactReview"("revisionHash");
ALTER TABLE "MarketingArtifactReview" ADD CONSTRAINT "MarketingArtifactReview_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingArtifactReview" ADD CONSTRAINT "MarketingArtifactReview_marketingArtifactId_fkey" FOREIGN KEY ("marketingArtifactId") REFERENCES "MarketingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingArtifactReview" ADD CONSTRAINT "MarketingArtifactReview_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketingBrandContextVersion" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "businessName" TEXT NOT NULL,
    "approvedServices" JSONB,
    "operatingGeography" JSONB,
    "businessCategory" TEXT,
    "audience" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "brandTone" TEXT,
    "approvedClaims" JSONB,
    "excludedTopics" JSONB,
    "brandAssetRefs" JSONB,
    "approvedCtaDestinations" JSONB,
    "complianceReviewState" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceProvenance" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingBrandContextVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingBrandContextVersion_customerAccountId_managedSiteId_versionNumber_locale_key" ON "MarketingBrandContextVersion"("customerAccountId", "managedSiteId", "versionNumber", "locale");
CREATE INDEX "MarketingBrandContextVersion_customerAccountId_managedSiteId_idx" ON "MarketingBrandContextVersion"("customerAccountId", "managedSiteId");
ALTER TABLE "MarketingBrandContextVersion" ADD CONSTRAINT "MarketingBrandContextVersion_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingBrandContextVersion" ADD CONSTRAINT "MarketingBrandContextVersion_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MarketingLeadFollowUpPolicy" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ageThresholdDays" INTEGER NOT NULL DEFAULT 4,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "eligibleLeadStages" JSONB,
    "qualifyingEventTypes" JSONB,
    "coverageRequirements" JSONB,
    "assignmentPolicy" TEXT,
    "exclusions" JSONB,
    "escalationThreshold" INTEGER,
    "policyVersion" TEXT NOT NULL DEFAULT 'mkt-08-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingLeadFollowUpPolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingLeadFollowUpPolicy_customerAccountId_enabled_idx" ON "MarketingLeadFollowUpPolicy"("customerAccountId", "enabled");
ALTER TABLE "MarketingLeadFollowUpPolicy" ADD CONSTRAINT "MarketingLeadFollowUpPolicy_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadFollowUpPolicy" ADD CONSTRAINT "MarketingLeadFollowUpPolicy_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MarketingLeadFollowUpEvaluation" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "managedSiteId" TEXT,
    "crmContactId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "coverageState" "CrmFollowUpCoverage" NOT NULL,
    "evidenceRefs" JSONB,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleUserId" TEXT,
    "recommendedAction" TEXT,
    "resolutionState" "MarketingFollowUpResolutionState" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingLeadFollowUpEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingLeadFollowUpEvaluation_customerAccountId_dedupeKey_key" ON "MarketingLeadFollowUpEvaluation"("customerAccountId", "dedupeKey");
CREATE UNIQUE INDEX "MarketingLeadFollowUpEvaluation_idempotencyKey_key" ON "MarketingLeadFollowUpEvaluation"("idempotencyKey");
CREATE INDEX "MarketingLeadFollowUpEvaluation_customerAccountId_coverageState_idx" ON "MarketingLeadFollowUpEvaluation"("customerAccountId", "coverageState");
ALTER TABLE "MarketingLeadFollowUpEvaluation" ADD CONSTRAINT "MarketingLeadFollowUpEvaluation_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadFollowUpEvaluation" ADD CONSTRAINT "MarketingLeadFollowUpEvaluation_managedSiteId_fkey" FOREIGN KEY ("managedSiteId") REFERENCES "ManagedSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadFollowUpEvaluation" ADD CONSTRAINT "MarketingLeadFollowUpEvaluation_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "MarketingLeadFollowUpEvaluation_customerAccountId_crmContactId_idx" ON "MarketingLeadFollowUpEvaluation"("customerAccountId", "crmContactId");

CREATE TABLE "MarketingFollowUpTaskIntent" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "crmContactId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL DEFAULT 'mkt-08-callback',
    "intentFingerprint" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "crmTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingFollowUpTaskIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingFollowUpTaskIntent_idempotencyKey_key" ON "MarketingFollowUpTaskIntent"("idempotencyKey");
CREATE UNIQUE INDEX "MarketingFollowUpTaskIntent_crmTaskId_key" ON "MarketingFollowUpTaskIntent"("crmTaskId");
CREATE UNIQUE INDEX "MarketingFollowUpTaskIntent_customerAccountId_crmContactId_policyKey_evaluationId_key" ON "MarketingFollowUpTaskIntent"("customerAccountId", "crmContactId", "policyKey", "evaluationId");
CREATE INDEX "MarketingFollowUpTaskIntent_customerAccountId_crmContactId_idx" ON "MarketingFollowUpTaskIntent"("customerAccountId", "crmContactId");
ALTER TABLE "MarketingFollowUpTaskIntent" ADD CONSTRAINT "MarketingFollowUpTaskIntent_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingFollowUpTaskIntent" ADD CONSTRAINT "MarketingFollowUpTaskIntent_crmContactId_fkey" FOREIGN KEY ("crmContactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingFollowUpTaskIntent" ADD CONSTRAINT "MarketingFollowUpTaskIntent_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "MarketingLeadFollowUpEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketingWorkflowRun" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "marketingRequestId" TEXT NOT NULL,
    "workflowKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "MarketingWorkflowRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingWorkflowRun_idempotencyKey_key" ON "MarketingWorkflowRun"("idempotencyKey");
CREATE INDEX "MarketingWorkflowRun_marketingRequestId_status_idx" ON "MarketingWorkflowRun"("marketingRequestId", "status");
ALTER TABLE "MarketingWorkflowRun" ADD CONSTRAINT "MarketingWorkflowRun_marketingRequestId_fkey" FOREIGN KEY ("marketingRequestId") REFERENCES "MarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingWorkflowRun" ADD CONSTRAINT "MarketingWorkflowRun_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
