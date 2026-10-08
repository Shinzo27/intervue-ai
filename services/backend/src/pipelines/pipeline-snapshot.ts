import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Pipeline snapshot creation — the single implementation of the freeze
 * semantics described in master-note §10.
 *
 * A published PipelineVersion is an immutable deep copy of the draft
 * template (stages → questions → options → rubric criteria). Both entry
 * points share this code so a snapshot produced by publishing a job is
 * byte-for-byte the same shape as one produced from the pipeline builder:
 *  - JobPostingsService.publish (publishing a job freezes its pipeline)
 *  - PipelinesService.publishVersion (publishing the template itself)
 */

export type Tx = Prisma.TransactionClient;

export interface DraftOption {
  text: string;
  order: number;
}

export interface DraftRubricCriterion {
  name: string;
  description: string | null;
  maxScore: number;
}

export interface DraftQuestion {
  question: string;
  type: string;
  order: number;
  required: boolean;
  options: DraftOption[];
  rubricCriteria: DraftRubricCriterion[];
}

export interface DraftStage {
  name: string;
  order: number;
  questions: DraftQuestion[];
}

/**
 * Business rules a draft must satisfy before it can be frozen. Throws
 * ConflictException (409) so the API contract matches the job-publish flow.
 */
export function validateDraftForPublish(stages: DraftStage[]): void {
  if (stages.length === 0) {
    throw new ConflictException(
      'Pipeline must contain at least one stage before publishing',
    );
  }

  for (const stage of stages) {
    if (stage.questions.length === 0) {
      throw new ConflictException(
        `Stage "${stage.name}" must contain at least one question before publishing`,
      );
    }

    for (const question of stage.questions) {
      if (question.type === 'MCQ' && question.options.length === 0) {
        throw new ConflictException(
          `MCQ question "${question.question}" must have at least one option`,
        );
      }
    }
  }
}

/** Next version number for a pipeline (publishing is cumulative, never reuse). */
export async function nextPipelineVersion(
  tx: Tx,
  pipelineId: string,
): Promise<number> {
  const latest = await tx.pipelineVersion.findFirst({
    where: { pipelineId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return (latest?.version ?? 0) + 1;
}

/** Deep-copy a draft into an immutable PipelineVersion. */
export async function createPipelineVersionSnapshot(
  tx: Tx,
  pipelineId: string,
  stages: DraftStage[],
) {
  const version = await nextPipelineVersion(tx, pipelineId);

  const pipelineVersion = await tx.pipelineVersion.create({
    data: {
      pipelineId,
      version,
      status: 'PUBLISHED',
    },
  });

  for (const stage of stages) {
    const stageVersion = await tx.pipelineStageVersion.create({
      data: {
        pipelineVersionId: pipelineVersion.id,
        name: stage.name,
        order: stage.order,
      },
    });

    for (const question of stage.questions) {
      const questionVersion = await tx.questionVersion.create({
        data: {
          pipelineStageVersionId: stageVersion.id,
          question: question.question,
          type: question.type as never,
          order: question.order,
          required: question.required,
        },
      });

      for (const option of question.options) {
        await tx.questionOptionVersion.create({
          data: {
            questionVersionId: questionVersion.id,
            text: option.text,
            order: option.order,
          },
        });
      }

      for (const rubric of question.rubricCriteria) {
        await tx.rubricCriterionVersion.create({
          data: {
            questionVersionId: questionVersion.id,
            name: rubric.name,
            description: rubric.description,
            maxScore: rubric.maxScore,
          },
        });
      }
    }
  }

  return pipelineVersion;
}
