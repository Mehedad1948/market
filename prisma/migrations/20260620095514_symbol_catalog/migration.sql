-- AlterTable
ALTER TABLE "Symbol" ADD COLUMN     "displaySector" TEXT,
ADD COLUMN     "instrumentType" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isin" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "rawJson" JSONB,
ADD COLUMN     "sectorId" TEXT,
ADD COLUMN     "sectorName" TEXT,
ADD COLUMN     "tsetmcId" TEXT;

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "slug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sector_slug_key" ON "Sector"("slug");

-- CreateIndex
CREATE INDEX "Symbol_sectorId_idx" ON "Symbol"("sectorId");

-- CreateIndex
CREATE INDEX "Symbol_sectorName_idx" ON "Symbol"("sectorName");

-- CreateIndex
CREATE INDEX "Symbol_instrumentType_idx" ON "Symbol"("instrumentType");

-- CreateIndex
CREATE INDEX "Symbol_isActive_idx" ON "Symbol"("isActive");
