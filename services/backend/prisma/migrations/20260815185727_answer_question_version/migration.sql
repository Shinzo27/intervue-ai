/*
  Warnings:

  - Added the required column `questionVersionId` to the `Answer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_questionId_fkey";

-- DropIndex
DROP INDEX "Answer_questionId_idx";

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "questionVersionId" TEXT NOT NULL,
ALTER COLUMN "questionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Answer_questionVersionId_idx" ON "Answer"("questionVersionId");

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
