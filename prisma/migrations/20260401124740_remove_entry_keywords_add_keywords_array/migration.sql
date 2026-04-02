/*
  Warnings:

  - You are about to drop the `entry_keywords` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "entry_keywords" DROP CONSTRAINT "entry_keywords_analysis_id_fkey";

-- AlterTable
ALTER TABLE "emotion_analyses" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "entry_keywords";
