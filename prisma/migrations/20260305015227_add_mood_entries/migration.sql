-- CreateEnum
CREATE TYPE "InputMethod" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "mood_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "contentIv" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "inputMethod" "InputMethod" NOT NULL DEFAULT 'TEXT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "aiAnalysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mood_entries_userId_idx" ON "mood_entries"("userId");

-- CreateIndex
CREATE INDEX "mood_entries_userId_entryDate_idx" ON "mood_entries"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "mood_entries_userId_createdAt_idx" ON "mood_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mood_entries_analysisStatus_idx" ON "mood_entries"("analysisStatus");

-- AddForeignKey
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
