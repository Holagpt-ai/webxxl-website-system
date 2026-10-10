-- AlterEnum
ALTER TYPE "ProjectActivityEventType" ADD VALUE 'FILE_DELETED';

-- CreateTable
CREATE TABLE "ProjectFileLink" (
    "id" TEXT NOT NULL,
    "projectFileId" TEXT NOT NULL,
    "approvalId" TEXT,
    "changeRequestId" TEXT,
    "supportRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFileLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFileLink_projectFileId_idx" ON "ProjectFileLink"("projectFileId");

-- CreateIndex
CREATE INDEX "ProjectFileLink_approvalId_idx" ON "ProjectFileLink"("approvalId");

-- CreateIndex
CREATE INDEX "ProjectFileLink_changeRequestId_idx" ON "ProjectFileLink"("changeRequestId");

-- CreateIndex
CREATE INDEX "ProjectFileLink_supportRequestId_idx" ON "ProjectFileLink"("supportRequestId");

-- AddForeignKey
ALTER TABLE "ProjectFileLink" ADD CONSTRAINT "ProjectFileLink_projectFileId_fkey" FOREIGN KEY ("projectFileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileLink" ADD CONSTRAINT "ProjectFileLink_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "ProjectApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileLink" ADD CONSTRAINT "ProjectFileLink_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileLink" ADD CONSTRAINT "ProjectFileLink_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
