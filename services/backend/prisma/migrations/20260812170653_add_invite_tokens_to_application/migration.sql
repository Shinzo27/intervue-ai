/*
  Warnings:

  - The values [APPLIED,SCREENING,INTERVIEW,SELECTED,REJECTED,WITHDRAWN] on the enum `ApplicationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `appliedAt` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the `Interview` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[candidateId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inviteToken]` on the table `Application` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `inviteToken` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenExpiresAt` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('INVITED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'DECIDED');
ALTER TABLE "public"."Application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Application" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING ("status"::text::"ApplicationStatus_new");
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "Application" ALTER COLUMN "status" SET DEFAULT 'INVITED';
COMMIT;

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_applicationId_fkey";

-- DropIndex
DROP INDEX "Application_candidateId_idx";

-- DropIndex
DROP INDEX "Application_candidateId_jobPostingId_key";

-- DropIndex
DROP INDEX "Candidate_organizationId_email_key";

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "appliedAt",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT NOT NULL,
ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INVITED';

-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "phone";

-- DropTable
DROP TABLE "Interview";

-- DropEnum
DROP TYPE "InterviewStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Application_candidateId_key" ON "Application"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_inviteToken_key" ON "Application"("inviteToken");

-- CreateIndex
CREATE INDEX "Application_inviteToken_idx" ON "Application"("inviteToken");
