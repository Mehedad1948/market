CREATE TYPE "DiscountCodeStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "DiscountCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "valueType" "DiscountValueType" NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "currency" TEXT,
    "minimumSubtotalAmount" DECIMAL(18,2),
    "maximumDiscountAmount" DECIMAL(18,2),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountCodePlan" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCodePlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentTransaction"
ADD COLUMN     "discountCodeId" TEXT,
ADD COLUMN     "amountBeforeDiscount" DECIMAL(18,2),
ADD COLUMN     "discountAmount" DECIMAL(18,2),
ADD COLUMN     "discountCodeSnapshot" TEXT;

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");

CREATE INDEX "DiscountCode_status_startsAt_endsAt_idx" ON "DiscountCode"("status", "startsAt", "endsAt");

CREATE INDEX "DiscountCode_createdByUserId_createdAt_idx" ON "DiscountCode"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "DiscountCodePlan_discountCodeId_planId_key" ON "DiscountCodePlan"("discountCodeId", "planId");

CREATE INDEX "DiscountCodePlan_planId_idx" ON "DiscountCodePlan"("planId");

CREATE INDEX "PaymentTransaction_discountCodeId_idx" ON "PaymentTransaction"("discountCodeId");

ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscountCodePlan" ADD CONSTRAINT "DiscountCodePlan_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountCodePlan" ADD CONSTRAINT "DiscountCodePlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
