import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateQuestionOptionDto } from './dto/options/create-question-option.dto';
import { UpdateQuestionOptionDto } from './dto/options/update-question-option.dto';
import { CreateRubricCriterionDto } from './dto/rubrics/create-rubric-criterion.dto';
import { UpdateRubricCriterionDto } from './dto/rubrics/update-rubric-criterion.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    stageId: string,
    dto: CreateQuestionDto,
  ) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipeline: {
          organizationId,
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Pipeline stage not found');
    }

    try {
      return await this.prisma.question.create({
        data: {
          question: dto.question,
          type: dto.type,
          order: dto.order,
          required: dto.required ?? true,
          pipelineStageId: stageId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A question with this order already exists in the stage',
        );
      }

      throw error;
    }
  }

  async findAll(organizationId: string, stageId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipeline: {
          organizationId,
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Pipeline stage not found');
    }

    return this.prisma.question.findMany({
      where: {
        pipelineStageId: stageId,
      },
      include: {
        options: {
          orderBy: {
            order: 'asc',
          },
        },
        rubricCriteria: true,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOne(organizationId: string, stageId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        pipelineStageId: stageId,
        pipelineStage: {
          pipeline: {
            organizationId,
          },
        },
      },
      include: {
        options: {
          orderBy: {
            order: 'asc',
          },
        },
        rubricCriteria: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async update(
    organizationId: string,
    stageId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    await this.findOne(organizationId, stageId, questionId);

    try {
      return await this.prisma.question.update({
        where: {
          id: questionId,
        },
        data: {
          question: dto.question,
          type: dto.type,
          order: dto.order,
          required: dto.required,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A question with this order already exists in the stage',
        );
      }

      throw error;
    }
  }

  async remove(organizationId: string, stageId: string, questionId: string) {
    await this.findOne(organizationId, stageId, questionId);

    await this.prisma.question.delete({
      where: {
        id: questionId,
      },
    });

    return {
      message: 'Question deleted successfully',
    };
  }

  async createOption(
    organizationId: string,
    questionId: string,
    dto: CreateQuestionOptionDto,
  ) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        pipelineStage: {
          pipeline: {
            organizationId,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question.type !== 'MCQ') {
      throw new BadRequestException(
        'Options can only be added to MCQ questions',
      );
    }

    try {
      return await this.prisma.questionOption.create({
        data: {
          text: dto.text,
          order: dto.order,
          questionId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An option with this order already exists');
      }

      throw error;
    }
  }

  async findAllOptions(organizationId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        pipelineStage: {
          pipeline: {
            organizationId,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.questionOption.findMany({
      where: {
        questionId,
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOneOption(
    organizationId: string,
    questionId: string,
    optionId: string,
  ) {
    const option = await this.prisma.questionOption.findFirst({
      where: {
        id: optionId,
        questionId,
        question: {
          pipelineStage: {
            pipeline: {
              organizationId,
            },
          },
        },
      },
    });

    if (!option) {
      throw new NotFoundException('Question option not found');
    }

    return option;
  }

  async updateOption(
    organizationId: string,
    questionId: string,
    optionId: string,
    dto: UpdateQuestionOptionDto,
  ) {
    await this.findOneOption(organizationId, questionId, optionId);

    try {
      return await this.prisma.questionOption.update({
        where: {
          id: optionId,
        },
        data: {
          text: dto.text,
          order: dto.order,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An option with this order already exists');
      }

      throw error;
    }
  }

  async removeOption(
    organizationId: string,
    questionId: string,
    optionId: string,
  ) {
    await this.findOneOption(organizationId, questionId, optionId);

    await this.prisma.questionOption.delete({
      where: {
        id: optionId,
      },
    });

    return {
      message: 'Question option deleted successfully',
    };
  }

  async createRubric(
    organizationId: string,
    questionId: string,
    dto: CreateRubricCriterionDto,
  ) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        pipelineStage: {
          pipeline: {
            organizationId,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.rubricCriterion.create({
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
        questionId,
      },
    });
  }

  async findAllRubrics(organizationId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        pipelineStage: {
          pipeline: {
            organizationId,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.rubricCriterion.findMany({
      where: {
        questionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOneRubric(
    organizationId: string,
    questionId: string,
    rubricId: string,
  ) {
    const rubric = await this.prisma.rubricCriterion.findFirst({
      where: {
        id: rubricId,
        questionId,
        question: {
          pipelineStage: {
            pipeline: {
              organizationId,
            },
          },
        },
      },
    });

    if (!rubric) {
      throw new NotFoundException('Rubric criterion not found');
    }

    return rubric;
  }

  async updateRubric(
    organizationId: string,
    questionId: string,
    rubricId: string,
    dto: UpdateRubricCriterionDto,
  ) {
    await this.findOneRubric(organizationId, questionId, rubricId);

    return this.prisma.rubricCriterion.update({
      where: {
        id: rubricId,
      },
      data: {
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
      },
    });
  }

  async removeRubric(
    organizationId: string,
    questionId: string,
    rubricId: string,
  ) {
    await this.findOneRubric(organizationId, questionId, rubricId);

    await this.prisma.rubricCriterion.delete({
      where: {
        id: rubricId,
      },
    });

    return {
      message: 'Rubric criterion deleted successfully',
    };
  }
}
