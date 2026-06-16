-- AlterTable
ALTER TABLE "AnalysisCache" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AnalysisRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Symbol" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SymbolDailyMetric" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SymbolRealLegalDaily" ALTER COLUMN "id" DROP DEFAULT;
