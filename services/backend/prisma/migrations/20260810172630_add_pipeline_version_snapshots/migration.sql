/*
  Warnings:

  - You are about to drop the column `createdAt` on the `QuestionOptionVersion` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `QuestionVersion` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `RubricCriterionVersion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "QuestionOptionVersion" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "QuestionVersion" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "RubricCriterionVersion" DROP COLUMN "createdAt";
