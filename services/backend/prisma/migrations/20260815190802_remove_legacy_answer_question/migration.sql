/*
  Warnings:

  - You are about to drop the column `questionId` on the `Answer` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_questionId_fkey";

-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "questionId";
