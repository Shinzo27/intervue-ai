# Intervue AI

Multi-tenant, AI-powered interview & recruitment SaaS.

Recruiters build reusable interview pipelines (immutable published versions), publish jobs, and
invite candidates through tokenized links — **no candidate accounts**. The interview itself is
**conversational**: an AI interviewer asks the frozen pipeline's questions, scores every answer
against its rubric with **two independent models**, and a permission-checked **MCP tool layer**
performs the state changes. Humans keep the final say: every AI decision can be overridden, and
every action — human or AI — lands in an audit trail.

```text
Organization ─► Pipeline (draft) ─► publish ─► PipelineVersion  (immutable snapshot)
    │                                              │
    └─► Job posting ─► publish ────────────────────┘
             │
             └─► Candidate ─► Application ─► tokenized link ─► InterviewSession
                                                                    │
                              ┌─────────────────────────────────────┘
                              ▼
                 Conversational interviewer (ai-service)
                              │  MCP tools (12)
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
   Pipeline MCP          Scoring MCP            Action MCP
   questions/stages      two-model rubric       advance / complete /
   progress (read)       evaluation             decision / review + audit
                              │
                              ▼
                    Scores → Decision → human override
```

## Quickstart — one command

```sh
git clone <repo> && cd intervue-ai
docker compose -f infra/compose/docker-compose.yml up --build
```

That brings up Postgres, Redis, the API, the AI service and both apps (migrations run
automatically at backend startup):

| Service | URL | What it is |
|---|---|---|
| HR dashboard | http://localhost:3002 | Recruiter console |
| Candidate portal | http://localhost:3003 | The interview itself (no account) |
| API | http://localhost:3000/api · `/api/docs` | NestJS REST + Swagger |
| AI service | http://localhost:3100 | MCP HTTP transport + interviewer routes |

**No LLM keys required.** With none set, the AI service runs its deterministic `fake` provider, so
the entire product — interview, scoring, decision, review — works offline. Set `GROQ_API_KEY`
and/or `OPENAI_API_KEY` (plus `LLM_PROVIDER`, `LLM_SECONDARY_PROVIDER`) for real models.

### Demo script (5 minutes)

1. Sign up at http://localhost:3002, create an organization.
2. **Pipelines → New pipeline**: add stages, questions (TEXT/MCQ), and rubric criteria —
   then **Publish version**. Watch the snapshot appear; v1 stays frozen forever.
3. **Jobs → your job → Publish job → Invite candidate**: the invite form hands you the
   candidate's interview link.
4. Open the link (http://localhost:3003): the AI asks the questions conversationally, one stage
   at a time. Refresh mid-interview — progress and transcript are preserved.
5. Back in the dashboard: **Applications → Review** shows the transcript, per-question scores
   with criterion bars, both models' evaluations (with disagreement badge), the decision, and
   an override form. **Audit** shows who did what — `USER` vs `AI`.

### Local development (no containers for app code)

```sh
pnpm install
docker compose -f infra/compose/docker-compose.dev.yml up -d   # Postgres + Redis only
cp services/backend/.env.example services/backend/.env
cp services/ai-service/.env.example services/ai-service/.env
cd services/backend && pnpm exec prisma migrate dev && cd ../..
pnpm dev
```

## The AI layer

The AI never touches the database. It is an **actor that requests capabilities**, and every
capability is validated server-side.

**12 MCP tools** in three groups (full catalog + design rules in [`docs/ai.md`](docs/ai.md)):

| Group | Tools |
|---|---|
| Pipeline (read) | `get_current_interview_state`, `get_current_question`, `get_stage_questions`, `get_question_details`, `get_interview_progress` |
| Scoring | `evaluate_answer`, `get_application_scores` |
| Action (permission-checked) | `advance_interview`, `complete_interview`, `create_decision`, `request_human_review`, `create_audit_event` |

- **Structured, validated output** — every evaluation is Zod-validated; a malformed model reply
  fails the `AIEvaluation` row loudly instead of writing a bad score.
- **Two-model scoring** — the same prompt runs on two providers; ≤20pp gap → averaged consensus,
  larger gap → the score is kept for reference and the answer is flagged `needsHumanReview` and
  audited. A question with no rubric criteria produces an explicit `QUESTION_HAS_NO_RUBRIC`
  outcome rather than a meaningless 0/0 score.
- **Deny-by-default permissions** — `decision:override` is structurally ungrantable to the AI, so
  "AI never overwrites a human decision" holds in both directions (§38, §64 of the master note).
- **Auditability** — AI actions are distinguishable from human ones (`actorType: USER | AI |
  SYSTEM`) and carry tool/capability metadata.

## Security model

- **Multi-tenant by construction**: every business query is scoped by `organizationId` resolved
  from the session, never from the request body.
- **Candidates hold capability, not identity**: the invite token resolves to exactly one
  application (no interview id to guess), is expiry-checked server-side, and exposes only a
  candidate-safe transcript.
- **RBAC at API boundaries**: `owner | admin | recruiter | interviewer` with explicit permission
  decorators; the AI service holds a separate service token for internal routes only.
- **Immutability**: publishing freezes a pipeline version; a published job cannot see later
  template edits, and historical answers reference the exact `QuestionVersion` used.

## Verification

Everything below is exercised by scripts in the repo — not aspirational.

| Suite | Command | Result |
|---|---|---|
| MCP end-to-end (both transports, all 12 tools, permission + cross-org denials) | `pnpm --filter ai-service test:e2e` | 26 checks pass |
| Conversational interviewer e2e (question relay, progression, completion, late/error paths) | `pnpm --filter ai-service test:e2e:interviewer` | 13 checks pass |
| AI service unit tests (registry, scoring aggregation, policy, interviewer) | `pnpm --filter ai-service test` | 68 pass |
| Backend API e2e (internal capability surface) | `pnpm --filter backend test:e2e` | 6 pass |
| Full recruitment chain (auth → … → override → audit) | `python infra/postman/run_collection.py` | 56 pass |
| Offline scoring evaluation (36 golden cases, two models) | `pnpm --filter ai-service eval` | MAE **~12 pp** (11.9–12.2 across recorded runs), in-band 69–77%, model agreement 91–94% |

## Monorepo layout

```text
apps/
  marketing/          Public landing page
  hr-dashboard/       Recruiter console  (jobs, pipeline builder, review, audit)
  candidate-portal/   Candidate interview UI (tokenized, account-less)
services/
  backend/            NestJS API, RBAC, interview runtime, decisions, notifications, audit
  ai-service/         MCP server + interviewer agent + scoring + evals
packages/             ui · types · utils · config · eslint-config · typescript-config
infra/
  compose/            docker-compose.yml (full stack) · docker-compose.dev.yml (infra only)
  postman/            Postman collection + runnable chain runner
docs/                 ai.md · architecture.md · database.md · api.md · decisions.md · deployment.md
```

## Documentation

- [`docs/ai.md`](docs/ai.md) — MCP tool catalog, scoring architecture, safety rules, eval baseline
- [`docs/master-note.md`](docs/master-note.md) — the full project master note
- [`docs/architecture.md`](docs/architecture.md) · [`docs/database.md`](docs/database.md) · [`docs/api.md`](docs/api.md)
- [`docs/deployment.md`](docs/deployment.md) — deployment notes
- [`docs/frontend-redesign-plan.md`](docs/frontend-redesign-plan.md) — 4-day frontend redesign plan and design system
