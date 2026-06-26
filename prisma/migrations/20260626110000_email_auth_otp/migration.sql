ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'EMAIL';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpChannel') THEN
    CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'SMS');
  END IF;
END $$;

ALTER TABLE "OtpCode"
ADD COLUMN IF NOT EXISTS "channel" "OtpChannel" NOT NULL DEFAULT 'SMS',
ADD COLUMN IF NOT EXISTS "target" TEXT;

UPDATE "OtpCode"
SET "target" = "targetPhone"
WHERE "target" IS NULL
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'OtpCode'
      AND column_name = 'targetPhone'
  );

ALTER TABLE "OtpCode"
ALTER COLUMN "target" SET NOT NULL;

DROP INDEX IF EXISTS "OtpCode_targetPhone_expiresAt_idx";

ALTER TABLE "OtpCode"
DROP COLUMN IF EXISTS "targetPhone";

CREATE INDEX IF NOT EXISTS "OtpCode_channel_target_expiresAt_idx"
ON "OtpCode"("channel", "target", "expiresAt");
