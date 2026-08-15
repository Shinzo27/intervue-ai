/*
  Warnings:

  - You are about to drop the column `pipelineStageId` on the `InterviewStage` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InterviewStage" DROP CONSTRAINT "InterviewStage_pipelineStageId_fkey";

-- AlterTable
ALTER TABLE "InterviewStage" DROP COLUMN "pipelineStageId";
