-- BATCH-15.1: Distributed capture rate-limit windows (PostgreSQL-backed).

CREATE TABLE "AnalyticsCaptureRateWindow" (
    "publicKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsCaptureRateWindow_pkey" PRIMARY KEY ("publicKeyId","windowStart")
);

CREATE INDEX "AnalyticsCaptureRateWindow_expiresAt_idx" ON "AnalyticsCaptureRateWindow"("expiresAt");
