-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CONTACT', 'PROJECT_INTAKE', 'QUOTE_REQUEST');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'STAGE_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'FOLLOW_UP_SET', 'CONVERTED', 'EMAIL_DELIVERED');

-- CreateTable
CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "businessName" TEXT,
    "headline" TEXT,
    "payload" JSONB NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "submissionFingerprint" TEXT NOT NULL,
    "resendMessageId" TEXT,
    "assignedToId" TEXT,
    "followUpAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "customerAccountId" TEXT,
    "projectId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesLead_referenceCode_key" ON "SalesLead"("referenceCode");

-- CreateIndex
CREATE INDEX "SalesLead_stage_createdAt_idx" ON "SalesLead"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "SalesLead_contactEmail_idx" ON "SalesLead"("contactEmail");

-- CreateIndex
CREATE INDEX "SalesLead_assignedToId_idx" ON "SalesLead"("assignedToId");

-- CreateIndex
CREATE INDEX "SalesLead_submissionFingerprint_createdAt_idx" ON "SalesLead"("submissionFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "SalesLead_customerAccountId_idx" ON "SalesLead"("customerAccountId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_source_key" ON "NewsletterSubscriber"("email", "source");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_email_idx" ON "NewsletterSubscriber"("email");

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
