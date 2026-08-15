-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('CANDIDATE', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'AI', 'SYSTEM');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "currentQuestionVersionId" TEXT,
ADD COLUMN     "currentStageVersionId" TEXT;

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionScore" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "rubricCriterionVersionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "reasoning" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionOverride" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "overriddenById" TEXT NOT NULL,
    "previousOutcome" "DecisionOutcome" NOT NULL,
    "newOutcome" "DecisionOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSession_applicationId_key" ON "ConversationSession"("applicationId");

-- CreateIndex
CREATE INDEX "ConversationSession_applicationId_idx" ON "ConversationSession"("applicationId");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Score_applicationId_idx" ON "Score"("applicationId");

-- CreateIndex
CREATE INDEX "Score_questionVersionId_idx" ON "Score"("questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_applicationId_questionVersionId_key" ON "Score"("applicationId", "questionVersionId");

-- CreateIndex
CREATE INDEX "CriterionScore_scoreId_idx" ON "CriterionScore"("scoreId");

-- CreateIndex
CREATE INDEX "CriterionScore_rubricCriterionVersionId_idx" ON "CriterionScore"("rubricCriterionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionScore_scoreId_rubricCriterionVersionId_key" ON "CriterionScore"("scoreId", "rubricCriterionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_applicationId_key" ON "Decision"("applicationId");

-- CreateIndex
CREATE INDEX "Decision_applicationId_idx" ON "Decision"("applicationId");

-- CreateIndex
CREATE INDEX "DecisionOverride_decisionId_idx" ON "DecisionOverride"("decisionId");

-- CreateIndex
CREATE INDEX "DecisionOverride_overriddenById_idx" ON "DecisionOverride"("overriddenById");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Application_currentStageVersionId_idx" ON "Application"("currentStageVersionId");

-- CreateIndex
CREATE INDEX "Application_currentQuestionVersionId_idx" ON "Application"("currentQuestionVersionId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_currentStageVersionId_fkey" FOREIGN KEY ("currentStageVersionId") REFERENCES "PipelineStageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_currentQuestionVersionId_fkey" FOREIGN KEY ("currentQuestionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "Score"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_rubricCriterionVersionId_fkey" FOREIGN KEY ("rubricCriterionVersionId") REFERENCES "RubricCriterionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionOverride" ADD CONSTRAINT "DecisionOverride_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionOverride" ADD CONSTRAINT "DecisionOverride_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
