-- AlterTable: add username as nullable first, backfill, then add constraints
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill existing rows: derive username from the part before '@' in email,
-- appended with a short unique suffix to guarantee uniqueness
UPDATE "users"
SET "username" = SPLIT_PART("email", '@', 1) || '_' || SUBSTR(REPLACE("id"::TEXT, '-', ''), 1, 6)
WHERE "username" IS NULL;

-- Make the column NOT NULL now that all rows are populated
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");
