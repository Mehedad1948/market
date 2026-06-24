CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "paramsHash" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "scoringVersion" INTEGER NOT NULL,
    "horizons" JSONB NOT NULL,
    "symbols" JSONB NOT NULL,
    "symbolCount" INTEGER NOT NULL DEFAULT 0,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BacktestSignalSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "asOfDate" TEXT NOT NULL,
    "sectorId" TEXT,
    "sectorName" TEXT,
    "latestClosePrice" DECIMAL(30,4),
    "compositeAction" TEXT NOT NULL,
    "compositeScore" INTEGER NOT NULL,
    "compositeBias" TEXT NOT NULL,
    "compositeEntryTiming" TEXT NOT NULL,
    "shortAction" TEXT NOT NULL,
    "shortScore" INTEGER NOT NULL,
    "shortQuality" TEXT NOT NULL,
    "shortForNewPosition" TEXT NOT NULL,
    "shortForExistingPosition" TEXT NOT NULL,
    "midAction" TEXT NOT NULL,
    "midScore" INTEGER NOT NULL,
    "midQuality" TEXT NOT NULL,
    "midForNewPosition" TEXT NOT NULL,
    "midForExistingPosition" TEXT NOT NULL,
    "longAction" TEXT NOT NULL,
    "longScore" INTEGER NOT NULL,
    "longQuality" TEXT NOT NULL,
    "longForNewPosition" TEXT NOT NULL,
    "longForExistingPosition" TEXT NOT NULL,
    "atrVolatilityRegime" TEXT NOT NULL,
    "relativeTradeValue20" DECIMAL(30,8),
    "liquidityBucket" TEXT NOT NULL,
    "forwardReturn1d" DECIMAL(30,8),
    "forwardReturn5d" DECIMAL(30,8),
    "forwardReturn20d" DECIMAL(30,8),
    "forwardReturn60d" DECIMAL(30,8),
    "maxDrawdown1d" DECIMAL(30,8),
    "maxDrawdown5d" DECIMAL(30,8),
    "maxDrawdown20d" DECIMAL(30,8),
    "maxDrawdown60d" DECIMAL(30,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestSignalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BacktestRun_status_startedAt_idx" ON "BacktestRun"("status", "startedAt");
CREATE INDEX "BacktestRun_paramsHash_scoringVersion_startedAt_idx" ON "BacktestRun"("paramsHash", "scoringVersion", "startedAt");

CREATE UNIQUE INDEX "BacktestSignalSnapshot_runId_symbol_asOfDate_key" ON "BacktestSignalSnapshot"("runId", "symbol", "asOfDate");
CREATE INDEX "BacktestSignalSnapshot_runId_compositeAction_idx" ON "BacktestSignalSnapshot"("runId", "compositeAction");
CREATE INDEX "BacktestSignalSnapshot_runId_asOfDate_idx" ON "BacktestSignalSnapshot"("runId", "asOfDate");
CREATE INDEX "BacktestSignalSnapshot_runId_sectorName_idx" ON "BacktestSignalSnapshot"("runId", "sectorName");
CREATE INDEX "BacktestSignalSnapshot_runId_liquidityBucket_idx" ON "BacktestSignalSnapshot"("runId", "liquidityBucket");
CREATE INDEX "BacktestSignalSnapshot_runId_atrVolatilityRegime_idx" ON "BacktestSignalSnapshot"("runId", "atrVolatilityRegime");
CREATE INDEX "BacktestSignalSnapshot_runId_shortForNewPosition_idx" ON "BacktestSignalSnapshot"("runId", "shortForNewPosition");
CREATE INDEX "BacktestSignalSnapshot_runId_shortForExistingPosition_idx" ON "BacktestSignalSnapshot"("runId", "shortForExistingPosition");
CREATE INDEX "BacktestSignalSnapshot_runId_midForNewPosition_idx" ON "BacktestSignalSnapshot"("runId", "midForNewPosition");
CREATE INDEX "BacktestSignalSnapshot_runId_midForExistingPosition_idx" ON "BacktestSignalSnapshot"("runId", "midForExistingPosition");
CREATE INDEX "BacktestSignalSnapshot_runId_longForNewPosition_idx" ON "BacktestSignalSnapshot"("runId", "longForNewPosition");
CREATE INDEX "BacktestSignalSnapshot_runId_longForExistingPosition_idx" ON "BacktestSignalSnapshot"("runId", "longForExistingPosition");

ALTER TABLE "BacktestSignalSnapshot" ADD CONSTRAINT "BacktestSignalSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
