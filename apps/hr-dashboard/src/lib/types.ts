/** Shapes returned by the backend REST API (only the fields the dashboard reads). */

export interface Candidate {
  firstName: string;
  lastName: string;
  email: string;
}

export interface Application {
  id: string;
  status: string;
  inviteToken: string;
  jobPostingId: string;
  createdAt: string;
  completedAt?: string | null;
  candidate: Candidate;
  jobPosting?: { id?: string; title: string };
}

export interface Job {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  publishedAt?: string | null;
  pipelineId?: string | null;
  pipeline: { id: string; name: string } | null;
  pipelineVersion: { id: string; version: number; publishedAt?: string } | null;
}

export interface PipelineSummary {
  id: string;
  name: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
  versions?: { id: string; version: number; publishedAt: string | null }[];
  _count?: { stages?: number };
}

export interface Option {
  id: string;
  text: string;
  order: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string | null;
  maxScore: number;
}

export interface Question {
  id: string;
  question: string;
  type: string;
  order: number;
  required: boolean;
  options: Option[];
  rubricCriteria: RubricCriterion[];
}

export interface Stage {
  id: string;
  name: string;
  order: number;
  questions: Question[];
}

export interface Pipeline {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
}

export interface PipelineVersion {
  id: string;
  version: number;
  status: string;
  publishedAt: string;
  stageCount: number;
  questionCount: number;
  jobCount: number;
}

/** Must match the backend QuestionType enum exactly (the DTO validator rejects anything else). */
export const QUESTION_TYPES = [
  { value: "MULTI_LINE", label: "Long answer" },
  { value: "SINGLE_LINE", label: "Short answer" },
  { value: "MCQ", label: "Multiple choice" },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]["value"];

export function questionTypeLabel(type: string): string {
  return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}
