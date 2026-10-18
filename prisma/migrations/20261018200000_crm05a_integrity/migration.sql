-- AlterTable
ALTER TABLE "CrmImportJob" ADD COLUMN "committedContactCount" INTEGER;

-- CreateTable
CREATE TABLE "CrmDataAccessAudit" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resourceRef" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmDataAccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmDataAccessAudit_customerAccountId_operation_createdAt_idx" ON "CrmDataAccessAudit"("customerAccountId", "operation", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_customerAccountId_id_key" ON "CrmContact"("customerAccountId", "id");

-- AddForeignKey
ALTER TABLE "CrmDataAccessAudit" ADD CONSTRAINT "CrmDataAccessAudit_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
