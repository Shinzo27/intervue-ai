export interface InterviewState {
  interview: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  application: {
    id: string;
    status: string;
    organizationId: string;
  };
  candidate: { id: string; name: string; email: string };
  job: { id: string; title: string };
  stage: {
    id: string;
    order: number;
    status: string;
    pipelineStageVersionId: string;
    name: string;
    questionCount: number;
  } | null;
  question: {
    id: string;
    order: number;
    type: string;
    required: boolean;
    question: string;
    options: { id: string; text: string; order: number }[];
    rubricCriteria: {
      id: string;
      name: string;
      description: string | null;
      maxScore: number;
    }[];
  } | null;
  progress: {
    totalStages: number;
    completedStages: number;
    totalQuestions: number;
    answeredQuestions: number;
  };
}

export interface Transcript {
  conversationId: string | null;
  messages: {
    id: string;
    role: 'CANDIDATE' | 'ASSISTANT';
    content: string;
    metadata: unknown;
    createdAt: string;
  }[];
}

export interface Message {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
  createdAt: string;
}

export interface AIEvaluation {
  id: string;
  interviewSessionId: string;
  answerId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  model: string | null;
  score: string | null;
  reasoning: string | null;
  result: unknown;
  createdAt: string;
}

export interface Score {
  id: string;
  applicationId: string;
  questionVersionId: string;
  overallScore: number;
  maxScore: number;
  reasoning: string | null;
  criterionScores: {
    id: string;
    rubricCriterionVersionId: string;
    score: number;
    reasoning: string | null;
  }[];
}

export interface ScoreSummary {
  applicationId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
  questions: Score[];
}

export interface CurrentQuestion {
  interviewId: string;
  interviewStatus: string;
  stageId: string;
  stageName: string;
  question: {
    id: string;
    order: number;
    type: string;
    required: boolean;
    question: string;
    options: { id: string; text: string; order: number }[];
  };
}

export interface StageQuestions {
  interviewId: string;
  stage: { id: string; name: string; order: number };
  runtimeStage: { id: string; order: number; status: string };
  questions: CurrentQuestion['question'][];
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
}

export interface QuestionDetails {
  interviewId: string;
  question: CurrentQuestion['question'];
  rubricCriteria: RubricCriterion[];
  stageVersion: { id: string; name: string; order: number };
}

export interface InterviewProgress {
  interviewId: string;
  interviewStatus: string;
  progress: InterviewState['progress'];
  stages: {
    id: string;
    order: number;
    status: string;
    pipelineStageVersionId: string;
    isCurrent: boolean;
  }[];
  currentStageId: string | null;
}

export interface AnswerContext {
  answer: {
    id: string;
    type: string;
    content: string;
    submittedAt: string;
  };
  questionVersion: {
    id: string;
    order: number;
    type: string;
    required: boolean;
    question: string;
    options: { id: string; text: string; order: number }[];
  };
  rubricCriteria: RubricCriterion[];
  interview: { id: string; status: string };
  application: {
    id: string;
    organizationId: string;
    candidate: { id: string; firstName: string; lastName: string };
  };
}

export interface ApplicationScoreRow {
  id: string;
  applicationId: string;
  questionVersionId: string;
  overallScore: number;
  maxScore: number;
  reasoning: string | null;
  criterionScores: {
    id: string;
    rubricCriterionVersionId: string;
    score: number;
    reasoning: string | null;
    rubricCriterionVersion: { id: string; name: string; maxScore: number };
  }[];
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  actorType: 'USER' | 'AI' | 'SYSTEM';
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}
