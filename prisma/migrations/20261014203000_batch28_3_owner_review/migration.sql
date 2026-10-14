-- CreateEnum
CREATE TYPE "OwnerReviewItemCategory" AS ENUM ('MEDIA', 'CONTENT', 'PRIVACY');

-- CreateEnum
CREATE TYPE "OwnerReviewItemStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'NOT_APPLICABLE');

-- AlterEnum
ALTER TYPE "ProjectActivityEventType" ADD VALUE 'OWNER_REVIEW_ITEM_UPDATED';

-- CreateTable
CREATE TABLE "ProjectOwnerReviewDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "status" "OwnerReviewItemStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOwnerReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOwnerReviewDecision_projectId_itemKey_key" ON "ProjectOwnerReviewDecision"("projectId", "itemKey");

-- CreateIndex
CREATE INDEX "ProjectOwnerReviewDecision_projectId_idx" ON "ProjectOwnerReviewDecision"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectOwnerReviewDecision" ADD CONSTRAINT "ProjectOwnerReviewDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOwnerReviewDecision" ADD CONSTRAINT "ProjectOwnerReviewDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
