-- Customer website previews. Approval targets an immutable deployment id, not a mutable host alias.
ALTER TYPE "ProjectActivityEventType" ADD VALUE 'WEBSITE_PREVIEW_REGISTERED';

ALTER TABLE "ProjectApproval" ADD COLUMN "metadata" JSONB;

CREATE TYPE "WebsitePreviewProvider" AS ENUM ('VERCEL', 'NETLIFY', 'CLOUDFLARE_PAGES', 'OTHER');

CREATE TYPE "WebsitePreviewStatus" AS ENUM ('DEVELOPMENT', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED');

CREATE TABLE "WebsitePreview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "provider" "WebsitePreviewProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliasUrl" TEXT NOT NULL,
    "status" "WebsitePreviewStatus" NOT NULL DEFAULT 'DEVELOPMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePreview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsitePreviewVersion" (
    "id" TEXT NOT NULL,
    "previewId" TEXT NOT NULL,
    "provider" "WebsitePreviewProvider" NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "sourceRevision" TEXT,
    "registeredUrl" TEXT NOT NULL,
    "status" "WebsitePreviewStatus" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "registeredById" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvalId" TEXT,
    "changeRequestId" TEXT,

    CONSTRAINT "WebsitePreviewVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsitePreview_projectId_key" ON "WebsitePreview"("projectId");
CREATE INDEX "WebsitePreview_customerAccountId_idx" ON "WebsitePreview"("customerAccountId");

CREATE UNIQUE INDEX "WebsitePreviewVersion_provider_deploymentId_key" ON "WebsitePreviewVersion"("provider", "deploymentId");
CREATE UNIQUE INDEX "WebsitePreviewVersion_approvalId_key" ON "WebsitePreviewVersion"("approvalId");
CREATE UNIQUE INDEX "WebsitePreviewVersion_changeRequestId_key" ON "WebsitePreviewVersion"("changeRequestId");
CREATE INDEX "WebsitePreviewVersion_previewId_registeredAt_idx" ON "WebsitePreviewVersion"("previewId", "registeredAt");
CREATE UNIQUE INDEX "WebsitePreviewVersion_one_current_per_preview_idx" ON "WebsitePreviewVersion"("previewId") WHERE "isCurrent" = true;

ALTER TABLE "WebsitePreview" ADD CONSTRAINT "WebsitePreview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsitePreview" ADD CONSTRAINT "WebsitePreview_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsitePreviewVersion" ADD CONSTRAINT "WebsitePreviewVersion_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "WebsitePreview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsitePreviewVersion" ADD CONSTRAINT "WebsitePreviewVersion_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsitePreviewVersion" ADD CONSTRAINT "WebsitePreviewVersion_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ProjectApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsitePreviewVersion" ADD CONSTRAINT "WebsitePreviewVersion_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

REVOKE ALL ON TABLE "WebsitePreview", "WebsitePreviewVersion" FROM anon, authenticated;
