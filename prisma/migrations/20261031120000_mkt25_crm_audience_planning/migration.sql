-- Batch 25: CRM segment audience planning references on marketing requests (additive).
-- Not applied in production without separate owner authorization.

ALTER TABLE "MarketingRequest" ADD COLUMN "crmSegmentId" TEXT;
ALTER TABLE "MarketingRequest" ADD COLUMN "audienceEvaluatedAt" TIMESTAMP(3);
ALTER TABLE "MarketingRequest" ADD COLUMN "audiencePlanningSummary" JSONB;

ALTER TABLE "MarketingRequest" ADD CONSTRAINT "MarketingRequest_crmSegmentId_fkey"
  FOREIGN KEY ("crmSegmentId") REFERENCES "CrmSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MarketingRequest_customerAccountId_crmSegmentId_idx"
  ON "MarketingRequest"("customerAccountId", "crmSegmentId");
