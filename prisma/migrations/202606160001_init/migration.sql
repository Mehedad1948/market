CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Symbol" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Symbol_symbol_key" ON "Symbol"("symbol");

CREATE TABLE "SymbolDailyMetric" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT,
  "tradeCount" BIGINT,
  "tradeVolume" DECIMAL(30,4),
  "tradeValue" DECIMAL(30,4),
  "priceMin" DECIMAL(30,4),
  "priceMax" DECIMAL(30,4),
  "priceYesterday" DECIMAL(30,4),
  "priceFirst" DECIMAL(30,4),
  "priceLast" DECIMAL(30,4),
  "priceLastChange" DECIMAL(30,4),
  "priceLastChangePercent" DECIMAL(30,8),
  "closePrice" DECIMAL(30,4),
  "closePriceChange" DECIMAL(30,4),
  "closePriceChangePercent" DECIMAL(30,8),
  "rawJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SymbolDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SymbolDailyMetric_symbol_date_key" ON "SymbolDailyMetric"("symbol", "date");
CREATE INDEX "SymbolDailyMetric_symbol_date_idx" ON "SymbolDailyMetric"("symbol", "date");

CREATE TABLE "SymbolRealLegalDaily" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "buyCountIndividual" BIGINT,
  "buyCountLegal" BIGINT,
  "sellCountIndividual" BIGINT,
  "sellCountLegal" BIGINT,
  "buyVolumeIndividual" DECIMAL(30,4),
  "buyVolumeLegal" DECIMAL(30,4),
  "sellVolumeIndividual" DECIMAL(30,4),
  "sellVolumeLegal" DECIMAL(30,4),
  "buyValueIndividual" DECIMAL(30,4),
  "sellValueIndividual" DECIMAL(30,4),
  "rawJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SymbolRealLegalDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SymbolRealLegalDaily_symbol_date_key" ON "SymbolRealLegalDaily"("symbol", "date");
CREATE INDEX "SymbolRealLegalDaily_symbol_date_idx" ON "SymbolRealLegalDaily"("symbol", "date");

CREATE TABLE "AnalysisCache" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol" TEXT NOT NULL,
  "paramsHash" TEXT NOT NULL,
  "latestDataDate" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalysisCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalysisCache_symbol_paramsHash_latestDataDate_key" ON "AnalysisCache"("symbol", "paramsHash", "latestDataDate");
CREATE INDEX "AnalysisCache_symbol_expiresAt_idx" ON "AnalysisCache"("symbol", "expiresAt");

CREATE TABLE "AnalysisRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "symbol" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "cacheHit" BOOLEAN NOT NULL,
  "dataSource" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalysisRequest_symbol_createdAt_idx" ON "AnalysisRequest"("symbol", "createdAt");
