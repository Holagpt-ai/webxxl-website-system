-- Batch 24: revision categories, deployment version linkage, request-thread comments

CREATE TYPE "ChangeRequestCategory" AS ENUM ('DESIGN', 'CONTENT', 'MEDIA', 'FUNCTIONALITY', 'OTHER');

ALTER TYPE "ProjectActivityEventType" ADD VALUE 'CHANGE_REQUEST_UPDATED';

ALTER TABLE "ChangeRequest" ADD COLUMN "category" "ChangeRequestCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ChangeRequest" ADD COLUMN "websitePreviewVersionId" TEXT;

ALTER TABLE "ProjectComment" ADD COLUMN "changeRequestId" TEXT;

CREATE INDEX "ChangeRequest_websitePreviewVersionId_idx" ON "ChangeRequest"("websitePreviewVersionId");
CREATE INDEX "ProjectComment_changeRequestId_idx" ON "ProjectComment"("changeRequestId");

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_websitePreviewVersionId_fkey"
  FOREIGN KEY ("websitePreviewVersionId") REFERENCES "WebsitePreviewVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_changeRequestId_fkey"
  FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
