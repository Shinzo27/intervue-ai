import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  JobPostingStatus,
  PipelineStatus,
  PipelineVersionStatus,
  QuestionType,
} from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // --------------------------------------------------
  // Organization
  // --------------------------------------------------

  const organization = await prisma.organization.create({
    data: {
      id: 'org_demo',
      name: 'Demo Organization',
      slug: 'demo-organization',
      createdAt: new Date(),
    },
  });

  // --------------------------------------------------
  // User
  // --------------------------------------------------

  const user = await prisma.user.create({
    data: {
      id: 'user_demo',
      name: 'Demo Admin',
      email: 'admin@demo.com',
      emailVerified: true,
    },
  });

  // --------------------------------------------------
  // Organization Membership
  // --------------------------------------------------

  await prisma.member.create({
    data: {
      id: 'member_demo',
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      createdAt: new Date(),
    },
  });

  // --------------------------------------------------
  // Pipeline Template
  // --------------------------------------------------

  const pipeline = await prisma.pipeline.create({
    data: {
      name: 'Backend Developer Interview',
      organizationId: organization.id,
      createdById: user.id,
      status: PipelineStatus.ACTIVE,
    },
  });

  // --------------------------------------------------
  // Pipeline Version
  // --------------------------------------------------

  const pipelineVersion = await prisma.pipelineVersion.create({
    data: {
      pipelineId: pipeline.id,
      version: 1,
      status: PipelineVersionStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  // --------------------------------------------------
  // Stage 1
  // --------------------------------------------------

  const technicalStage = await prisma.pipelineStageVersion.create({
    data: {
      pipelineVersionId: pipelineVersion.id,
      name: 'Technical Interview',
      order: 1,
    },
  });

  // --------------------------------------------------
  // Stage 2
  // --------------------------------------------------

  const behavioralStage = await prisma.pipelineStageVersion.create({
    data: {
      pipelineVersionId: pipelineVersion.id,
      name: 'Behavioral Interview',
      order: 2,
    },
  });

  // --------------------------------------------------
  // Questions
  // --------------------------------------------------

  const technicalQuestion = await prisma.questionVersion.create({
    data: {
      pipelineStageVersionId: technicalStage.id,
      question: 'Explain the difference between SQL and NoSQL databases.',
      type: QuestionType.MULTI_LINE,
      order: 1,
      required: true,
    },
  });

  const behavioralQuestion = await prisma.questionVersion.create({
    data: {
      pipelineStageVersionId: behavioralStage.id,
      question: 'Tell us about a challenging project you worked on.',
      type: QuestionType.MULTI_LINE,
      order: 1,
      required: true,
    },
  });

  // --------------------------------------------------
  // Rubric Criteria
  // --------------------------------------------------

  await prisma.rubricCriterionVersion.create({
    data: {
      questionVersionId: technicalQuestion.id,
      name: 'Technical Understanding',
      description: 'Understanding of database concepts and trade-offs.',
      maxScore: 10,
    },
  });

  await prisma.rubricCriterionVersion.create({
    data: {
      questionVersionId: behavioralQuestion.id,
      name: 'Problem Solving',
      description: 'Ability to explain challenges and solutions clearly.',
      maxScore: 10,
    },
  });

  // --------------------------------------------------
  // Job Posting
  // --------------------------------------------------

  const jobPosting = await prisma.jobPosting.create({
    data: {
      title: 'Backend Developer',
      description:
        'Backend developer responsible for building scalable APIs and services.',
      organizationId: organization.id,
      createdById: user.id,
      pipelineId: pipeline.id,
      pipelineVersionId: pipelineVersion.id,
      status: JobPostingStatus.PUBLISHED,
    },
  });

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Organization:', organization.id);
  console.log('User:', user.id);
  console.log('Pipeline:', pipeline.id);
  console.log('Pipeline Version:', pipelineVersion.id);
  console.log('Job Posting:', jobPosting.id);
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
