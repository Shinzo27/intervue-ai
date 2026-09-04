# Intervue AI — Complete Project Master Note

> **Purpose:** This document is the single project-level reference for Intervue AI: completed work, current architecture, database/runtime flow, Sprint 5 AI/MCP direction, and planned features through the end of the project.
>
> **Status:** Active development. Sprint 2 is complete. Sprint 3 and Sprint 4 backend work are implemented. Sprint 5 runtime/database foundation is working; AI + MCP implementation is the current focus.

---

# 1. Product Overview

## Product

**Intervue AI** is a multi-tenant, AI-powered interview and recruitment SaaS.

The system allows an organization to:

1. Create and manage jobs.
2. Build reusable interview pipelines.
3. Publish immutable pipeline versions.
4. Attach a pipeline to a job.
5. Invite candidates without requiring candidate accounts.
6. Create an interview session from an application.
7. Run a candidate-facing interview.
8. Collect answers and conversation data.
9. Use AI to evaluate answers against rubric criteria.
10. Produce question-level and application-level scores.
11. Generate hiring decisions.
12. Allow authorized humans to override AI decisions.
13. Keep an audit trail of important actions.
14. Eventually expose AI capabilities through MCP tools so an AI agent can safely interact with the recruitment system.

---

# 2. Primary Technology Stack

## Backend

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Better Auth
- Docker
- AWS eventually

## AI / MCP

- Dedicated `services/ai-service`
- LLM integration
- Model Context Protocol (MCP)
- Pipeline MCP
- Scoring MCP
- Action MCP
- Conversational interview agent
- AI evaluation and decision workflows

## Infrastructure

Currently:

- PostgreSQL

Deferred until actually required:

- Redis
- MinIO
- BullMQ

The infrastructure strategy is intentionally incremental instead of provisioning everything at the beginning.

---

# 3. Repository / Monorepo Direction

The project uses a monorepo structure with pnpm workspaces and Turbo.

Important services:

```text
services/
├── backend/
└── ai-service/
```

## Backend

```text
services/backend
```

Responsibilities:

- REST API
- Authentication integration
- Authorization
- Business logic
- Prisma/database access
- Interview runtime
- Applications
- Candidates
- Jobs
- Pipelines
- Scores
- Decisions
- Audit logging

## AI Service

```text
services/ai-service
```

Responsibilities:

- AI/LLM integration
- Conversational interview agent
- MCP server
- MCP tools
- Pipeline MCP
- Scoring MCP
- Action MCP
- AI orchestration

Important architectural decision:

> Pipeline, Scoring, and Action MCP modules are part of `ai-service`. They are not separate deployed microservices.

---

# 4. Authentication and Multi-Tenancy

## Authentication

Better Auth is used instead of custom JWT authentication.

Better Auth handles:

- Authentication
- Sessions
- Users
- Organizations
- Organization membership
- Invitations

Better Auth is mounted at:

```text
/api/auth
```

Current development base URL:

```text
http://localhost:3000
```

Frontend development origin:

```text
http://localhost:3001
```

## Multi-Tenancy

The system is organization-based.

Every business-data query must be scoped by:

```text
organizationId
```

This is a fundamental security rule.

A user belonging to Organization A must not be able to access Organization B's business data.

---

# 5. Roles and RBAC

Current roles:

```text
OWNER
ADMIN
RECRUITER
INTERVIEWER
```

RBAC is implemented at API boundaries.

The system has:

- Permission definitions
- Permission-protected endpoints
- Permission guard
- Authentication/session checks
- Organization context
- User context

Typical request context:

```text
Request
  ↓
Better Auth session
  ↓
User
  ↓
Organization membership
  ↓
Role
  ↓
Permission
  ↓
Controller
  ↓
Service
  ↓
Organization-scoped database query
```

---

# 6. Completed Sprint 2

Sprint 2 is considered complete.

## Completed infrastructure

- NestJS backend initialized.
- PostgreSQL connected.
- Prisma configured.
- Better Auth integrated.
- Better Auth organization plugin enabled.
- Better Auth schema generated.
- Better Auth schema migrated.
- Authentication working.
- Organization creation working.
- Organization invitations working.
- Custom RBAC implemented.
- Permission-protected endpoint tested.
- Request logging implemented.
- CORS configured.
- Better Auth trusted origins configured.
- Session checking implemented and verified.

---

# 7. Sprint 3 — Jobs & Pipelines

## Goal

Create the reusable interview configuration system.

Main concepts:

```text
JobPosting
    ↓
Pipeline
    ↓
PipelineVersion
    ↓
PipelineStageVersion
    ↓
QuestionVersion
    ↓
QuestionOptionVersion
    ↓
RubricCriterionVersion
```

---

# 8. Job Posting

A `JobPosting` represents a recruitment position.

It belongs to an organization.

It can reference a pipeline configuration.

Typical lifecycle:

```text
DRAFT
  ↓
PUBLISHED
  ↓
CLOSED
```

A job posting can be configured while in draft state.

Publishing makes the job available for candidate entry.

---

# 9. Pipeline Templates

A Pipeline is an organization-level reusable interview template.

It defines the interview structure.

A pipeline contains stages.

Stages contain questions.

Questions can contain:

- Question type
- Order
- Required flag
- Options where applicable
- Rubric criteria

Pipeline template:

```text
Pipeline
 ├── Stage
 │    ├── Question
 │    ├── Question
 │    └── ...
 ├── Stage
 │    └── Questions
 └── ...
```

---

# 10. Pipeline Versioning / Snapshot Architecture

This is one of the most important architectural decisions in the project.

A pipeline is reusable and can evolve.

A published job must not change because someone later edits the reusable pipeline.

Therefore:

```text
Pipeline Template
      ↓
Pipeline Version
      ↓
Stage Versions
      ↓
Question Versions
      ↓
Rubric Versions
```

When a JobPosting is published, its interview configuration is effectively frozen through a published pipeline snapshot/version.

## Why?

Example:

```text
Pipeline v1
  Technical Interview
    Question A
    Question B
```

Job A uses v1.

Later, the recruiter edits the pipeline:

```text
Pipeline v2
  Technical Interview
    Question A
    Question B
    Question C
```

Job A must continue using v1.

A new Job B can use v2.

Therefore:

```text
Job A → PipelineVersion 1
Job B → PipelineVersion 2
```

This prevents historical interviews from changing unexpectedly.

---

# 11. Sprint 3 APIs / Functionality

Implemented areas include:

- Pipeline CRUD
- Job posting CRUD
- Pipeline stage management
- Question management
- Rubric configuration
- Publishing
- Snapshot/version workflow
- Organization-scoped queries
- RBAC-protected mutations

The snapshot workflow was specifically tested.

---

# 12. Sprint 4 — Applications & Candidate Entry

## Goal

Allow candidates to enter interviews without creating an account.

Core entities:

```text
Candidate
Application
InterviewSession
```

Flow:

```text
JobPosting
    ↓
Candidate
    ↓
Application
    ↓
Invite Token
    ↓
Candidate Interview Link
```

---

# 13. Candidate Identity

Candidates do not require a Better Auth account.

Candidate identity is separate from recruiter/user identity.

The candidate record contains basic candidate information such as:

- First name
- Last name
- Email

The candidate is associated with an organization.

---

# 14. Application

An Application connects:

```text
Candidate
    +
JobPosting
```

The current design is one application per candidate in the current implementation.

Application lifecycle:

```text
INVITED
  ↓
STARTED
  ↓
IN_PROGRESS
  ↓
COMPLETED
  ↓
DECIDED
```

The application also stores:

- Invite token
- Token expiration
- Interview progress
- Current stage version
- Current question version

---

# 15. Candidate Interview Access

Candidates receive a tokenized interview link.

No candidate account is required.

Access flow:

```text
Candidate
  ↓
Tokenized URL
  ↓
GET /api/interviews/access/:token
  ↓
Application lookup
  ↓
Candidate lookup
  ↓
Job lookup
  ↓
Published pipeline snapshot
  ↓
InterviewSession lookup
  ↓
Current interview state
```

The access response provides enough information for the candidate-facing interview UI to render the current interview state.

---

# 16. Sprint 5 — Runtime Foundation

Sprint 5 is broader than just runtime.

The runtime/database foundation is now working.

The remaining major work is the AI + MCP layer.

Current runtime entities include:

```text
InterviewSession
InterviewStage
Answer
Conversation
Message
AIEvaluation
Score
CriterionScore
Decision
DecisionOverride
AuditLog
```

---

# 17. Interview Session

An `InterviewSession` represents one actual interview execution.

It belongs to an Application.

Important state:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
ABANDONED
```

Important fields include:

- applicationId
- status
- currentStageId
- startedAt
- completedAt
- createdAt
- updatedAt

The interview session contains:

- Interview stages
- Conversations
- Answers
- AI evaluations

---

# 18. Interview Stage Runtime

`InterviewStage` represents a stage of the frozen pipeline inside a running interview.

It stores:

- Interview session
- Pipeline stage version
- Order
- Status
- Started timestamp
- Completed timestamp

Lifecycle:

```text
NOT_STARTED
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

The current stage is tracked on the interview session.

---

# 19. Interview Runtime Flow

Current working flow:

```text
Application
    ↓
Create InterviewSession
    ↓
Create InterviewStage records
    ↓
Set first stage as current
    ↓
Start interview
    ↓
Candidate answers question
    ↓
Answer is stored
    ↓
Find next question
    ↓
If question exists:
    currentQuestionVersionId = next question
    ↓
If no question:
    current stage = COMPLETED
    ↓
Find next stage
    ↓
If stage exists:
    next stage = IN_PROGRESS
    currentStageId = next stage
    currentQuestionVersionId = first question
    ↓
If no stage:
    InterviewSession = COMPLETED
    Application = COMPLETED
```

This flow has been tested successfully.

---

# 20. Answer Model

The Answer model now correctly references:

```text
questionVersionId
```

rather than relying on the mutable original Question record.

This is critical because interviews operate against frozen pipeline versions.

Current answer concepts:

- Interview session
- Interview stage
- Question version
- Answer type
- Content
- Submitted timestamp

Current answer types include:

```text
TEXT
OPTION
TRANSCRIPT
```

The previous `questionId` relationship was removed from the runtime Answer model because the interview must be tied to the immutable question version.

---

# 21. Answer Submission

Current endpoint:

```http
POST /api/interviews/:interviewId/answers
```

Request:

```json
{
  "questionId": "<questionVersionId>",
  "content": "Candidate answer..."
}
```

The service:

1. Validates the interview.
2. Ensures the interview is in progress.
3. Ensures there is a current stage.
4. Finds the question version.
5. Verifies the question belongs to the current stage.
6. Prevents duplicate answers.
7. Creates the answer.
8. Finds the next question.
9. Advances the question when one exists.
10. Completes the stage when the last question is answered.
11. Starts the next stage when one exists.
12. Completes the interview when the final stage is completed.

This was tested end-to-end.

---

# 22. Conversation / Message Runtime

The runtime also supports:

```text
Conversation
    ↓
Message
```

Messages use:

```text
MessageRole
```

Current roles:

```text
CANDIDATE
ASSISTANT
```

This provides the foundation for the conversational AI interviewer.

Future message metadata can contain structured AI/runtime information without changing the basic message model.

---

# 23. AI Evaluation

`AIEvaluation` represents an AI evaluation run for an answer.

Current status:

```text
PENDING
COMPLETED
FAILED
```

The model stores:

- interviewSessionId
- answerId
- status
- model
- score
- reasoning
- result JSON
- timestamps

Important:

There is no `RUNNING` value in the current `EvaluationStatus` enum.

The implementation currently uses the supported statuses.

---

# 24. AI Scoring

The scoring architecture separates:

## AI Evaluation

What did the AI think about the answer?

```text
Answer
  ↓
AIEvaluation
  ↓
score
reasoning
result
```

## Persistent Score

What score is assigned to the application/question?

```text
Application
   +
QuestionVersion
   ↓
Score
```

A Score stores:

- applicationId
- questionVersionId
- overallScore
- maxScore
- reasoning

Unique constraint:

```text
(applicationId, questionVersionId)
```

This prevents duplicate question-level score records for the same application.

---

# 25. Rubric Scoring

A question can have versioned rubric criteria.

```text
QuestionVersion
    ↓
RubricCriterionVersion
```

Each criterion has:

- Name
- Description
- Maximum score

The actual score for a criterion is stored in:

```text
CriterionScore
```

Relationship:

```text
Score
   ↓
CriterionScore
   ↓
RubricCriterionVersion
```

A CriterionScore stores:

- Score
- Reasoning

Unique constraint:

```text
(scoreId, rubricCriterionVersionId)
```

This allows the AI scoring engine to explain how each rubric criterion contributed to the overall score.

---

# 26. Decision System

A Decision represents the hiring outcome for an application.

Current decision concepts include:

```text
PASS
```

and other configured outcomes as defined by the current enum.

Decision contains:

- applicationId
- outcome
- totalScore
- maxScore
- reasoning
- decidedAt
- timestamps

There is one decision per application in the current design.

---

# 27. Human Override

AI should not be treated as the final unquestionable authority.

The system supports human overrides.

```text
AI Decision
    ↓
Human reviews
    ↓
Override
    ↓
New Decision Outcome
```

`DecisionOverride` stores:

- decisionId
- overriddenById
- previousOutcome
- newOutcome
- reason
- createdAt

This gives a historical record of who changed the AI/system decision and why.

---

# 28. Audit Logging

`AuditLog` records important system actions.

It stores:

- organizationId
- actorType
- actorId
- action
- entityType
- entityId
- metadata
- createdAt

Indexes exist for:

```text
organizationId
entityType + entityId
actorId
createdAt
```

Audit logging is important for:

- Security
- Debugging
- Compliance
- Human overrides
- AI actions
- Recruitment history

---

# 29. Current End-to-End Backend Flow

```text
USER
 ↓
Better Auth
 ↓
Organization Membership
 ↓
RBAC
 ↓
Backend API
 ↓
Organization-scoped Service
 ↓
PostgreSQL / Prisma
```

Recruitment flow:

```text
Organization
 ↓
Pipeline Template
 ↓
Pipeline Version
 ↓
Job Posting
 ↓
Candidate
 ↓
Application
 ↓
Invite Token
 ↓
Interview Session
 ↓
Interview Stages
 ↓
Question Versions
 ↓
Candidate Answers
 ↓
AI Evaluation
 ↓
Scores
 ↓
Decision
 ↓
Human Override
 ↓
Audit Log
```

---

# 30. Current API-Level Interview Flow

## Create interview

```http
POST /api/interviews
```

Creates an InterviewSession for an Application.

The service:

1. Finds application.
2. Loads its job.
3. Loads published pipeline snapshot.
4. Prevents duplicate interview sessions.
5. Creates interview session.
6. Creates runtime interview stages.
7. Sets the first stage as current.

---

## Access interview

```http
GET /api/interviews/access/:token
```

Returns:

- Interview ID
- Candidate information
- Job information
- Interview status
- Current stage

---

## Start interview

The interview start flow transitions:

```text
NOT_STARTED → IN_PROGRESS
```

and starts the current stage.

---

## Submit answer

```http
POST /api/interviews/:interviewId/answers
```

Handles:

- Answer creation
- Question validation
- Duplicate protection
- Question progression
- Stage progression
- Interview completion

---

## Complete interview

There was also a completion endpoint during development.

However, because the final answer progression already completes the interview automatically, the normal runtime flow should rely on answer-driven completion rather than requiring the client to manually force completion.

---

# 31. Current Database Versioning Lessons

Important migration history included:

- Better Auth initialization
- Sprint 3 Jobs/Pipelines
- Pipeline version snapshots
- Sprint 4 applications/candidate entry
- Invite tokens
- Sprint 5 AI/conversation/scoring
- Sprint 5 runtime
- Interview stage snapshot relation fixes
- Answer migration from Question to QuestionVersion

The Answer migration was especially important.

Old:

```text
Answer → Question
```

Correct runtime design:

```text
Answer → QuestionVersion
```

Reason:

> Historical interview answers must always refer to the exact question configuration used during that interview.

---

# 32. Sprint 5 — AI + MCP: CURRENT NEXT PHASE

This is the main unfinished portion of Sprint 5.

The architecture is:

```text
                    AI Interviewer
                         │
                         ▼
                    AI Service
                         │
                    MCP Server
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Pipeline MCP   Scoring MCP    Action MCP
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                     Backend
                         │
                         ▼
                    PostgreSQL
```

The MCP modules remain inside:

```text
services/ai-service
```

---

# 33. AI Service

The AI service is a dedicated service responsible for AI-specific orchestration.

Initial structure:

```text
services/ai-service/
├── src/
│   ├── ai/
│   ├── mcp/
│   │   ├── pipeline/
│   │   ├── scoring/
│   │   └── action/
│   └── index.ts
├── .env
├── package.json
└── tsconfig.json
```

Initial service foundation includes:

- TypeScript
- MCP SDK
- Zod
- dotenv
- OpenAI SDK
- Development startup script

The first implementation milestone is:

```text
AI Service
   ↓
MCP Server
   ↓
First MCP tool
```

---

# 34. MCP Concept in This Project

MCP provides a controlled tool interface between the AI model and the application.

The AI model should not directly execute arbitrary database operations.

Instead:

```text
AI
 ↓
MCP Tool
 ↓
Validated input
 ↓
Authorized backend operation
 ↓
Database
```

This provides:

- Structured tools
- Validation
- Explicit capabilities
- Better security boundaries
- Reusable AI capabilities
- Easier testing
- Easier model replacement

---

# 35. Pipeline MCP

Pipeline MCP gives the AI controlled access to interview configuration.

Potential capabilities:

```text
get interview
get current stage
get current question
get stage questions
get question details
get rubric criteria
get next question
get interview progress
```

Example conceptual flow:

```text
AI Interviewer
    ↓
Pipeline MCP
    ↓
Current Interview
    ↓
Current Stage
    ↓
Current Question
```

The MCP tool should only expose the data required by the AI.

It should not expose unrestricted database access.

---

# 36. Scoring MCP

Scoring MCP handles evaluation/scoring capabilities.

Potential responsibilities:

```text
evaluate answer
evaluate rubric criterion
calculate question score
store evaluation
create/update score
retrieve score
calculate application score
```

Conceptual flow:

```text
Candidate Answer
       ↓
Scoring MCP
       ↓
AI Evaluation
       ↓
Rubric Criteria
       ↓
Criterion Scores
       ↓
Overall Question Score
       ↓
Application Score
```

The AI scoring result should be structured and persisted.

---

# 37. Action MCP

Action MCP is the controlled action layer.

Potential actions:

```text
advance interview
complete stage
complete interview
create/update decision
record decision reasoning
request human review
send notification
create audit event
```

Critical security rule:

> The AI must not perform privileged actions merely because the model requested them.

Flow:

```text
AI requests action
       ↓
Action MCP
       ↓
Permission validation
       ↓
Organization validation
       ↓
Resource validation
       ↓
Execute action
       ↓
Audit log
```

---

# 38. Permission Checks Before AI Actions

This is a major architecture requirement.

AI should be treated as an actor capable of requesting actions, not as an unrestricted system administrator.

For example:

```text
AI → "Change candidate decision"
       ↓
Action MCP
       ↓
Check organization
       ↓
Check acting identity/context
       ↓
Check permission
       ↓
Allow / Reject
       ↓
Audit
```

This prevents an AI model from bypassing normal authorization boundaries.

---

# 39. Conversational Interview Agent

The conversational interviewer is the main AI-facing experience.

Conceptual flow:

```text
Candidate
   ↓
Interview UI
   ↓
Backend
   ↓
AI Service
   ↓
LLM
   ↓
MCP Tools
   ↓
Pipeline / Scoring / Action
   ↓
Backend
   ↓
Candidate
```

The agent should understand:

- Current job
- Current interview
- Current stage
- Current question
- Previous conversation
- Candidate answer
- Interview progress
- Relevant rubric context

It should not invent the interview structure.

The pipeline snapshot remains the source of truth.

---

# 40. Conversational Message Flow

Example:

```text
AI:
"Tell me about a challenging project you worked on."

Candidate:
"I worked on a distributed backend..."

       ↓

Message stored
       ↓

Answer/transcript stored
       ↓

AI evaluates answer
       ↓

Scoring MCP
       ↓

Rubric evaluation
       ↓

Score persisted
       ↓

Pipeline MCP determines next question
       ↓

Action/Runtime advances interview
       ↓

AI asks next question
```

---

# 41. AI Evaluation Architecture

A robust evaluation flow:

```text
Answer
  ↓
Create AIEvaluation(PENDING)
  ↓
Scoring MCP
  ↓
LLM evaluation
  ↓
Structured result
  ↓
Validate result
  ↓
Store score
  ↓
Store criterion scores
  ↓
AIEvaluation → COMPLETED
```

Failure path:

```text
LLM failure
   ↓
AIEvaluation → FAILED
   ↓
Store error/result metadata
   ↓
Do not create invalid score
```

---

# 42. Two-Model Scoring Architecture

Planned AI architecture includes two-model scoring.

The purpose is to reduce over-reliance on a single model.

Conceptually:

```text
Answer
  ↓
Model A ──→ Evaluation A
  ↓
Model B ──→ Evaluation B
  ↓
Comparison / aggregation
  ↓
Final score
```

The exact model providers/configuration can remain replaceable.

The database should store enough information to identify:

- Model
- Score
- Reasoning
- Structured result

---

# 43. AI Decision Flow

After interview scoring:

```text
Question Scores
      ↓
Application Score
      ↓
Decision Logic
      ↓
AI/System Recommendation
      ↓
Decision
```

Example:

```text
Total Score = 8/10
        ↓
PASS
```

The decision should contain reasoning.

The system should preserve the difference between:

- AI recommendation
- Persisted decision
- Human override

---

# 44. Human Override Flow

```text
AI Recommendation
       ↓
Recruiter/Admin reviews
       ↓
Override
       ↓
Previous outcome stored
       ↓
New outcome stored
       ↓
Reason required
       ↓
Audit log
```

Example:

```text
AI: REJECT
Human: PASS
Reason: "Strong production experience not captured by rubric."
```

This history must never be silently overwritten.

---

# 45. Notifications

Planned notification capabilities include:

- Candidate invitation
- Interview reminders
- Interview completion notification
- Recruiter notification
- Decision notification
- Human review notification

Redis/BullMQ should only be introduced when asynchronous notification workloads actually require them.

---

# 46. Files

A future file system can support:

- Candidate resumes
- Job descriptions
- Interview attachments
- AI-generated artifacts
- Evaluation exports

Object storage is expected to eventually use MinIO locally and AWS-compatible storage in production.

MinIO is deferred until required.

---

# 47. Organization Settings

Planned organization-level settings include:

- Interview defaults
- AI configuration
- Scoring thresholds
- Decision rules
- Notification preferences
- Branding
- Candidate experience settings
- Organization metadata

These settings must remain organization-scoped.

---

# 48. Frontend / Pipeline Builder

Planned UI includes a visual pipeline builder.

Recruiter workflow:

```text
Create Pipeline
    ↓
Add Stage
    ↓
Add Questions
    ↓
Configure Question Type
    ↓
Add Options
    ↓
Add Rubric Criteria
    ↓
Reorder
    ↓
Save
    ↓
Publish Version
```

The builder must make the distinction between:

```text
Draft Template
```

and:

```text
Published Snapshot
```

clear to the user.

---

# 49. Candidate Interview UI

Planned candidate experience:

```text
Interview Link
    ↓
Candidate Verification / Access
    ↓
Interview Introduction
    ↓
Current Stage
    ↓
Question / Conversation
    ↓
Answer
    ↓
Next Question
    ↓
Next Stage
    ↓
Completion
```

Candidate should not need a platform account.

---

# 50. Recruiter Dashboard

Planned recruiter functionality:

- Organization dashboard
- Job postings
- Pipeline management
- Candidate list
- Applications
- Interview status
- Scores
- AI evaluation
- Decisions
- Human overrides
- Audit history

---

# 51. Candidate / Application Dashboard

Planned recruiter-side application view:

```text
Candidate
 ↓
Application
 ↓
Job
 ↓
Interview
 ↓
Stage progress
 ↓
Answers
 ↓
AI evaluation
 ↓
Scores
 ↓
Decision
```

This becomes the main hiring review screen.

---

# 52. Security Requirements

Security is a first-class requirement.

Every business-data operation should consider:

1. Authentication
2. Organization membership
3. Role
4. Permission
5. Resource ownership
6. Organization scope
7. Audit requirements

Never rely only on the frontend for authorization.

AI tools must follow the same security model.

---

# 53. Multi-Tenant Database Rules

Every organization-owned business model should be traceable to an organization.

Important organization-scoped areas:

- Job postings
- Pipelines
- Candidates
- Applications
- Interviews
- Scores
- Decisions
- Audit logs
- Settings

Queries must prevent cross-tenant access.

Indexes should support common organization-scoped lookups.

---

# 54. Important Constraints

Examples of constraints already used:

```text
Application.applicationId → unique InterviewSession
Application.candidateId → unique in current design
Application.inviteToken → unique
PipelineVersion(pipelineId, version) → unique
PipelineStageVersion(pipelineVersionId, order) → unique
QuestionVersion(pipelineStageVersionId, order) → unique
Score(applicationId, questionVersionId) → unique
CriterionScore(scoreId, rubricCriterionVersionId) → unique
Decision.applicationId → unique
```

These constraints protect business invariants at the database level.

---

# 55. Lifecycle Integrity

Important lifecycle rules:

## Pipeline

```text
Template
 ↓
Version
 ↓
Published
 ↓
Archived
```

## Application

```text
INVITED
 ↓
STARTED
 ↓
IN_PROGRESS
 ↓
COMPLETED
 ↓
DECIDED
```

## Interview

```text
NOT_STARTED
 ↓
IN_PROGRESS
 ↓
COMPLETED
```

## Interview Stage

```text
NOT_STARTED
 ↓
IN_PROGRESS
 ↓
COMPLETED
```

## AI Evaluation

```text
PENDING
 ↓
COMPLETED

or

PENDING
 ↓
FAILED
```

---

# 56. Important Data Ownership Rules

```text
Organization
 ├── Users / Membership
 ├── Jobs
 ├── Pipelines
 ├── Candidates
 ├── Applications
 ├── Interviews
 ├── Scores
 ├── Decisions
 └── Audit Logs
```

The system should be able to answer:

> Who owns this data?

> Which organization does it belong to?

> Which user is allowed to modify it?

> Was the change made by a human or AI?

> What was the previous state?

---

# 57. AI Actor / Audit Model

AI-originated actions should be distinguishable from human actions.

Audit records should be capable of representing:

```text
HUMAN
SYSTEM
AI
```

and identifying the actor/context where appropriate.

For AI actions, audit metadata can capture:

- Tool name
- Model
- Request context
- Resource
- Action
- Result
- Reason
- Evaluation/run identifier

This is important for debugging and trust.

---

# 58. Error Handling Requirements

The backend should consistently handle:

- Invalid IDs
- Missing resources
- Unauthorized users
- Forbidden actions
- Wrong organization
- Invalid state transitions
- Duplicate records
- Expired invite tokens
- Missing pipeline snapshots
- Missing stages
- Missing questions
- Duplicate answers
- AI failures
- Scoring failures
- Action failures

Current development has already encountered and resolved several Prisma/API errors, including:

- Foreign key constraint failures
- P2022
- P2011
- P2023-style validation scenarios
- Invalid UUID errors
- Duplicate stage order errors
- Permission errors

These debugging experiences reinforce the importance of keeping Prisma schema, migrations, generated client, and runtime code synchronized.

---

# 59. Infrastructure Roadmap

## Currently required

```text
PostgreSQL
```

## Later

```text
Redis
BullMQ
MinIO / object storage
AWS infrastructure
```

Do not add infrastructure merely because it is planned.

Introduce each dependency when the product feature requires it.

---

# 60. Planned Final Product Flow

The final intended flow is:

```text
                    ORGANIZATION
                         │
                         ▼
                 Recruiter/Admin
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Job Posting             Pipeline
              │                     │
              │               Pipeline Version
              │                     │
              └──────────┬──────────┘
                         ▼
                     Publish Job
                         │
                         ▼
                      Candidate
                         │
                         ▼
                    Application
                         │
                         ▼
                    Invite Token
                         │
                         ▼
                 Candidate Interview
                         │
                         ▼
                 Interview Session
                         │
                         ▼
                 Frozen Pipeline
                         │
                         ▼
                Conversational Agent
                         │
                         ▼
                       MCP
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      Pipeline        Scoring         Action
         MCP             MCP            MCP
          │              │              │
          ▼              ▼              ▼
      Questions       Evaluation      State Changes
      Stages          Rubrics         Decisions
      Progress        Scores          Notifications
                         │
                         ▼
                    AI Evaluation
                         │
                         ▼
                       Scores
                         │
                         ▼
                      Decision
                         │
                  ┌──────┴──────┐
                  ▼             ▼
               PASS/FAIL    Human Override
                                 │
                                 ▼
                            Audit Log
```

---

# 61. Full Candidate Interview Example

Example:

```text
Job:
Backend Developer

Pipeline:
Backend Interview v3

Stage 1:
Technical Interview

Question:
Explain SQL vs NoSQL.

Candidate answers.

↓
Answer persisted

↓
AI evaluation

↓
Rubric:
Database fundamentals = 4/5
Reasoning stored

↓
Next question

↓
Stage 1 completed

↓
Stage 2:
Project Experience

Question:
Tell us about a challenging project.

Candidate answers.

↓
AI evaluation

↓
Stage completed

↓
Interview completed

↓
Application completed

↓
Scores aggregated

↓
Decision generated

↓
Recruiter reviews

↓
Recruiter can override

↓
Override reason stored

↓
Audit log created
```

---

# 62. AI Agent Example

The final conversational agent should behave conceptually like:

```text
System:
You are conducting an interview.

Agent needs current question.

AI
 ↓
Pipeline MCP
 ↓
getCurrentQuestion()
 ↓
Question returned

AI asks question.

Candidate responds.

AI
 ↓
Store conversation/answer
 ↓
Scoring MCP
 ↓
Evaluate answer against rubric

AI
 ↓
Pipeline MCP
 ↓
Get next question

AI
 ↓
Action MCP
 ↓
Advance interview

AI asks next question.
```

The model never needs direct unrestricted SQL access.

---

# 63. MCP Tool Design Principles

Every tool should have:

- Clear name
- Clear description
- Zod input schema
- Validated output
- Explicit permissions
- Explicit resource scope
- Predictable errors
- Audit behavior where relevant

Bad design:

```text
execute_sql(sql)
```

Preferred design:

```text
get_current_interview()
get_current_question()
evaluate_answer()
advance_interview()
create_decision()
```

The AI receives business capabilities instead of database internals.

---

# 64. AI Safety / Control Principles

The AI must not:

- Bypass organization boundaries
- Access another organization's candidates
- Modify arbitrary database rows
- Change decisions without authorization
- Invent pipeline questions
- Modify published pipeline snapshots
- Delete audit history
- Silently overwrite human decisions

The backend remains the final authority for:

- Authorization
- State validation
- Data integrity
- Persistence

---

# 65. Testing Strategy

Testing should cover:

## Authentication

- Login
- Session
- Organization membership
- Invitation

## Authorization

- Owner
- Admin
- Recruiter
- Interviewer
- Forbidden actions
- Cross-organization access

## Pipeline

- CRUD
- Ordering
- Publishing
- Versioning
- Snapshot immutability

## Applications

- Candidate
- Application
- Invite token
- Expiry
- Access

## Interview

- Create
- Start
- Access
- Answer
- Duplicate answer
- Question progression
- Stage progression
- Completion

## AI

- Evaluation creation
- Successful evaluation
- Failed evaluation
- Structured output
- Rubric scoring

## MCP

- Tool validation
- Tool authorization
- Tool execution
- Invalid resources
- Cross-tenant attempts
- Action audit

## Decisions

- Decision generation
- Human override
- Override reason
- Audit record

---

# 66. API Smoke-Test Sequence

The eventual end-to-end Postman flow should resemble:

```text
1. Authentication
2. Create/select organization
3. Create pipeline
4. Add stages
5. Add questions
6. Add rubric criteria
7. Publish pipeline
8. Create job posting
9. Publish job
10. Create candidate
11. Create application
12. Generate/use invite token
13. Create interview
14. Access interview
15. Start interview
16. Submit answer
17. Progress questions
18. Progress stages
19. Complete interview
20. Trigger AI evaluation
21. Create scores
22. Generate decision
23. Override decision
24. Verify audit log
```

---

# 67. Current Status Summary

## Completed

### Foundation

- [x] Monorepo setup
- [x] pnpm workspace
- [x] Turbo
- [x] NestJS backend
- [x] PostgreSQL
- [x] Prisma
- [x] Docker foundation

### Authentication

- [x] Better Auth
- [x] Sessions
- [x] Organizations
- [x] Membership
- [x] Invitations
- [x] Trusted origins
- [x] CORS

### Authorization

- [x] Roles
- [x] Permissions
- [x] RBAC
- [x] Permission guard
- [x] Protected endpoints
- [x] Organization context

### Sprint 3

- [x] Job postings
- [x] Pipelines
- [x] Pipeline stages
- [x] Questions
- [x] Rubrics
- [x] Pipeline versions
- [x] Published snapshots
- [x] CRUD APIs
- [x] RBAC protection
- [x] Snapshot workflow

### Sprint 4

- [x] Candidates
- [x] Applications
- [x] Invite tokens
- [x] Candidate access
- [x] Candidate-facing interview entry

### Sprint 5 Runtime

- [x] Interview sessions
- [x] Interview stages
- [x] Stage progression
- [x] Question progression
- [x] Answers
- [x] QuestionVersion-based answers
- [x] Conversations
- [x] Messages
- [x] AI evaluation model
- [x] Scores
- [x] Criterion scores
- [x] Decisions
- [x] Decision overrides
- [x] Audit logs
- [x] Interview completion flow
- [x] Application completion flow

### Current AI Service Foundation

- [x] `services/ai-service` created
- [x] TypeScript foundation
- [x] MCP SDK dependency
- [x] Zod
- [x] dotenv
- [x] OpenAI SDK
- [x] Basic service entrypoint

---

# 68. Current Work — Next Tasks

The immediate implementation order is:

```text
1. AI Service foundation
2. MCP server foundation
3. Pipeline MCP
4. Pipeline MCP tools
5. Scoring MCP
6. Scoring tools
7. Action MCP
8. Action authorization
9. Conversational interview agent
10. AI evaluation execution
11. Two-model scoring
12. AI decision generation
13. Human override integration with AI
14. AI audit trail
15. Full AI/MCP integration tests
```

---

# 69. Remaining Product Roadmap

After the core Sprint 5 AI/MCP work, remaining product work should include the productization layer.

## Candidate experience

- Candidate interview UI
- Conversational UI
- Progress indicator
- Interview completion screen
- Error/recovery states

## Recruiter experience

- Dashboard
- Job management UI
- Pipeline builder
- Candidate management
- Application review
- Interview review
- Score visualization
- Decision review
- Override UI
- Audit history UI

## AI productization

- AI configuration
- Model configuration
- Prompt/version management where needed
- Evaluation monitoring
- AI failure handling
- AI observability
- Cost/token tracking where needed

## Notifications

- Invitation
- Reminder
- Completion
- Decision
- Human review

## Files

- Resume uploads
- Job documents
- Candidate attachments
- Object storage

## Organization settings

- Branding
- Interview settings
- AI settings
- Scoring settings
- Notifications

## Infrastructure

- Redis when needed
- BullMQ when asynchronous workloads require it
- MinIO/object storage when file handling requires it
- AWS deployment
- Production observability
- CI/CD

---

# 70. Final Architecture

The final product architecture is intended to be:

```text
                         FRONTEND
                            │
              ┌─────────────┴─────────────┐
              │                           │
        Recruiter UI                Candidate UI
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
                     NestJS Backend
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
      Better Auth         RBAC             REST APIs
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                            ▼
                         Prisma
                            │
                            ▼
                       PostgreSQL

                            ▲
                            │
                      AI Service
                            │
                       MCP Server
                            │
            ┌───────────────┼───────────────┐
            │               │               │
       Pipeline MCP    Scoring MCP     Action MCP
            │               │               │
            └───────────────┼───────────────┘
                            │
                           LLM
```

---

# 71. Core Architectural Rules

These rules should remain stable unless there is a deliberate architecture change.

1. Better Auth handles authentication, sessions, organizations and membership.
2. Do not reintroduce custom JWT authentication.
3. Multi-tenancy is organization-based.
4. Every business-data query must be organization-scoped.
5. RBAC is enforced at API boundaries.
6. Pipeline templates are reusable.
7. Published pipeline versions are immutable snapshots for running/historical jobs.
8. Candidate accounts are not required.
9. Answers reference QuestionVersion for historical correctness.
10. AI does not get unrestricted database access.
11. MCP tools expose explicit business capabilities.
12. AI actions go through permission validation.
13. Important AI/human actions are auditable.
14. Human overrides must preserve previous decision history.
15. Pipeline, Scoring and Action MCP modules live inside `ai-service`.
16. Redis, MinIO and BullMQ are introduced only when actually required.
17. PostgreSQL remains the source of truth for business state.
18. The backend remains authoritative for authorization and data integrity.

---

# 72. Project Completion Definition

Intervue AI should be considered complete when the following works end-to-end:

```text
Organization signs in
        ↓
Creates job
        ↓
Creates reusable pipeline
        ↓
Publishes pipeline
        ↓
Publishes job
        ↓
Invites candidate
        ↓
Candidate opens tokenized link
        ↓
Interview session starts
        ↓
AI interviewer conducts interview
        ↓
Pipeline MCP supplies correct questions
        ↓
Candidate answers
        ↓
Scoring MCP evaluates answers
        ↓
Rubrics produce criterion scores
        ↓
Scores aggregate
        ↓
AI/system generates decision
        ↓
Action MCP performs authorized state changes
        ↓
Interview completes
        ↓
Application becomes completed/decided
        ↓
Recruiter reviews result
        ↓
Human can override
        ↓
Override is audited
        ↓
Recruiter sees complete candidate evaluation
```

That is the target system.

---

# 73. Current Position

**We are NOT finished with Sprint 5.**

The database and interview runtime foundation is working.

The remaining core Sprint 5 work is:

```text
🔥 MCP Server
🔥 Pipeline MCP
🔥 Scoring MCP
🔥 Action MCP
🔥 Conversational AI Interviewer
🔥 AI Evaluation Execution
🔥 Two-Model Scoring
🔥 AI Decision Integration
🔥 Permission-controlled AI Actions
🔥 AI Auditability
```

The immediate next implementation is:

```text
AI Service
   ↓
MCP Server
   ↓
Pipeline MCP
   ↓
First real MCP tool
```

This document should be updated as major architecture/features are completed.
