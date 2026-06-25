-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('WATCHLIST_CHANGE', 'SIGNAL_ACTION', 'SIGNAL_SCORE');

-- CreateEnum
CREATE TYPE "AlertRuleScope" AS ENUM ('ALL_WATCHLIST', 'SYMBOL');

-- CreateEnum
CREATE TYPE "WatchlistChangeEvent" AS ENUM ('ADDED', 'REMOVED');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertRuleType" NOT NULL,
    "scope" "AlertRuleScope" NOT NULL DEFAULT 'ALL_WATCHLIST',
    "symbol" TEXT,
    "signalAction" TEXT,
    "minScore" INTEGER,
    "watchlistChangeEvent" "WatchlistChangeEvent",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "symbol" TEXT,
    "eventKey" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_userId_enabled_idx" ON "AlertRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_type_enabled_idx" ON "AlertRule"("type", "enabled");

-- CreateIndex
CREATE INDEX "AlertRule_scope_symbol_idx" ON "AlertRule"("scope", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_alertRuleId_eventKey_key" ON "AlertDelivery"("alertRuleId", "eventKey");

-- CreateIndex
CREATE INDEX "AlertDelivery_userId_createdAt_idx" ON "AlertDelivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_symbol_createdAt_idx" ON "AlertDelivery"("symbol", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
