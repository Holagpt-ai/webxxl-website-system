-- Batch 9D: threaded customer support replies (portal persistence; apply on owner-authorized environments only).

CREATE TABLE "SupportRequestMessage" (
    "id" TEXT NOT NULL,
    "supportRequestId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequestMessage_supportRequestId_createdAt_idx" ON "SupportRequestMessage"("supportRequestId", "createdAt");

ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;