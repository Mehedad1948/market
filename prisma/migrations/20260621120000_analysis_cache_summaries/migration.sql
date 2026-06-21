-- AlterTable
ALTER TABLE "AnalysisCache"
ADD COLUMN "action" TEXT,
ADD COLUMN "score" INTEGER,
ADD COLUMN "bias" TEXT,
ADD COLUMN "entryTiming" TEXT,
ADD COLUMN "latestClosePrice" DECIMAL(30,4),
ADD COLUMN "latestClosePriceChangePercent" DECIMAL(30,8),
ADD COLUMN "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "AnalysisCache_paramsHash_analyzedAt_idx" ON "AnalysisCache"("paramsHash", "analyzedAt");

-- CreateIndex
CREATE INDEX "AnalysisCache_paramsHash_action_score_idx" ON "AnalysisCache"("paramsHash", "action", "score");

-- CreateIndex
CREATE INDEX "AnalysisCache_expiresAt_idx" ON "AnalysisCache"("expiresAt");
