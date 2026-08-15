/*
  Warnings:

  - Added the required column `pipelineStageVersionId` to the `InterviewStage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InterviewStage" ADD COLUMN     "pipelineStageVersionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "InterviewStage_pipelineStageVersionId_idx" ON "InterviewStage"("pipelineStageVersionId");

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_pipelineStageVersionId_fkey" FOREIGN KEY ("pipelineStageVersionId") REFERENCES "PipelineStageVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
