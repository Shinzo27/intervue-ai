# AI & MCP Architecture

> **Status:** Implementation in progress (Phases 1–7 of the completion plan). This document is the authoritative reference for the Intervue AI AI/MCP layer and is updated as each phase lands.

---

## 1. Where AI lives

`services/ai-service` is a single Node/TypeScript service that hosts:

- The **MCP server** (stdio + Streamable HTTP transports)
- The **Pipeline / Scoring / Action MCP** toolsets
- The **conversational interviewer agent** (LLM tool-calling)
- The **two-model scoring engine**
- The **offline eval harness**

**Hard rule:** `ai-service` never touches PostgreSQL and never imports Prisma. It reaches business state exclusively through the backend's internal REST API.

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
              Backend internal REST API
                         │
                         ▼
                     PostgreSQL
```

---

## 2. The boundary: backend internal API

The backend exposes a service-to-service surface under `/api/internal/*` (global prefix `api`, controller prefix `internal`). This is the *only* coupling point between the two services.

Rules:

1. **The backend is the only writer of business state.** MCP tools are orchestrators, not database writers.
2. Every internal endpoint is guarded by `InternalServiceGuard` — `Authorization: Internal <INTERNAL_SERVICE_SECRET>`.
3. Route handlers are additionally marked `@Public()` — **not** to make them public, but to opt them out of the Better Auth *session* `APP_GUARD` (which the auth package registers globally). The service token guard remains the authority; these routes have zero browser/session surface.
4. Every internal endpoint validates input with class-validator DTOs and performs **organization-scoped** queries.
5. Each MCP tool maps to one internal endpoint (thin adapter) or orchestrates a small sequence of them (e.g. `evaluate_answer`).
6. All state-changing AI actions produce audit events with `actorType: AI` and metadata identifying tool, model, request context, and result.

---

## 3. MCP server design

- **Registry pattern:** tools are registered as `{ name, description, inputSchema (Zod), permissions, handler }`. No ad-hoc tool wiring.
- **Transports:** `stdio` (local agents, Claude Desktop, dev tooling) and Streamable `HTTP` (the runtime interviewer + external agent demos). Same toolset, both transports.
- Every tool provides: validated input, predictable structured errors, trace-id propagation to the backend, and explicit permission declarations.
- **Never:** `execute_sql`, raw Prisma access, or unrestricted resource access. Tools expose *business capabilities*.

---

## 4. Tool catalog

Phase tags refer to the completion plan. ✅ = implemented.

### Pipeline MCP (read-only)

| Tool | Purpose | Phase |
|---|---|---|
| `get_current_interview_state` ✅ | Session, current stage version, current question version (+options +rubric), progress, application/candidate/job summary | 2 |
| `get_current_question` ✅ | Verbatim question text + options for the current question version | 3 |
| `get_stage_questions` ✅ | All questions for a stage version, in order (ownership-checked against the interview) | 3 |
| `get_question_details` ✅ | Question + options + rubric criteria (ownership-checked) | 3 |
| `get_interview_progress` ✅ | Stage-by-stage runtime map + answered/total counters | 3 |
| `evaluate_answer` ✅ | Two-model rubric evaluation → AIEvaluation rows + Score + criteria (disagreement → human review) | 4 |
| `get_application_scores` ✅ | Persisted question scores with criterion breakdowns | 4 |

### MCP server foundation (Phase 2 — implemented)

- `services/ai-service` is now a real service (ESM, express, zod-validated env, fail-fast boot).
- **Tool registry pattern** (`src/mcp/registry.ts`): tools declared once (`{name, description, inputSchema(Zod), permissions, readOnly, handler}`), wired to any transport; handlers get SDK-validated args + trace context; errors map to structured `{ok:false, error:{kind,status,hint,traceId}}` — never silent.
- **Backend client** (`src/backend/client.ts`): typed methods per internal endpoint, `x-trace-id` propagation, exponential-backoff retry on idempotent requests, `BackendError(status, traceId)`.
- **Dual transports**: Streamable HTTP (stateless, per-request transport, Bearer-token auth, open `/health` probe) and **stdio** (local agents/Claude Desktop). Verified live on both: initialize / tools/list / tools/call, 401 auth, structured 404, SDK-level `-32602` invalid-UUID rejection.
- First tools live: **all 5 Pipeline MCP read tools**. Stage/question reads enforce interview ownership server-side — foreign snapshot ids 404. (Schema note: stage/question version ids are cuids, validated `min(5)`; interview ids are UUIDs.)

### Backend internal capability surface (Phase 1 — implemented)

| Endpoint | Purpose |
|---|---|
| `GET /api/internal/interviews/:id/state` | Full agent-facing state (stage, question + options + rubric, progress, candidate/job summary) |
| `GET /api/internal/interviews/:id/transcript` | Conversation messages for agent context |
| `POST /api/internal/interviews/:id/messages` | Append Message (role + optional metadata) |
| `POST /api/internal/interviews/:id/answers` | Answer submission (delegates to runtime flow; stores as TRANSCRIPT) |
| `POST /api/internal/evaluations` | Create PENDING evaluation (one per model — two-model scoring) |
| `PATCH /api/internal/evaluations/:id/complete` | Complete with score/reasoning/result |
| `PATCH /api/internal/evaluations/:id/fail` | Fail with error metadata (no invalid score) |
| `POST /api/internal/scores` | Transactional upsert of Score + CriterionScores (unique per app+questionVersion) |
| `GET /api/internal/applications/:id/score-summary` | Aggregated totals + per-question rows |
| `POST /api/internal/interviews/:id/complete` | Guarded, idempotent completion sweep |
| `POST /api/internal/applications/:id/decision` | Persist AI recommendation (+ `DECISION_CREATED` audit, actorType AI) |
| `POST /api/internal/audit-events` | Append audit event (USER/AI/SYSTEM) |
| `GET /api/internal/audit/:organizationId` | List audit events (recency) |
| `POST /api/internal/candidate/validate` | Legacy v0 candidate-token validation |

### Scoring MCP

| Tool | Purpose | Phase |
|---|---|---|
| `evaluate_answer` | Answer + rubric → structured criterion scores, overall score, reasoning; persists AIEvaluation → Score → CriterionScores | 4 |
| `compute_application_score` | Aggregate question scores → application-level total (rubric-max weighted) | 4 |
| `get_score` | Retrieve persisted question/application scores | 4 |

### Action MCP

| Tool | Purpose | Phase |
|---|---|---|
| `advance_interview` | Progress question/stage pointers (validated transitions only) | 5 |
| `complete_interview` | Mark session + application completed | 5 |
| `create_decision` | Persist AI/system recommendation (distinct from human decisions) | 6 |
| `request_human_review` | Flag an application for recruiter review (used on model disagreement) | 5 |
| `create_audit_event` | Append an AI-attributed audit record | 5 |

### Permission matrix (Action MCP)

- AI **may**: advance interview state, persist evaluations/scores, create AI recommendations, flag for review, audit.
- AI **may never**: override a human decision, modify published pipeline snapshots, access other organizations' data, delete audit history, or bypass state-transition validation.

---

## 5. Two-model scoring

```text
Answer ──► Model A (OpenAI, primary)   ──► Evaluation A ─┐
         └─► Model B (Groq Llama, 2nd) ──► Evaluation B ─┤
                                                          ▼
                                              Aggregator
                          agreement (Δ ≤ threshold) → final score persisted
                          disagreement → conservative blend + request_human_review + audit
```

- Both evaluations are persisted as `AIEvaluation` rows tagged with their model.
- Structured output is enforced with Zod: `{ criterionScores[], overallScore, confidence, reasoning }`. Invalid output → 1 retry with error feedback → `FAILED` (no score written).
- Token usage (prompt/completion/total) is captured per evaluation for cost tracking.

---

## 6. Conversational interviewer

- OpenAI tool-calling loop bound to the MCP tools; system prompt = persona + current state fetched via Pipeline MCP.
- **The pipeline snapshot is the source of truth** — the agent never invents questions, stages, or rubrics.
- Candidate message → `Message(CANDIDATE)` + `Answer(TRANSCRIPT)` → evaluation (async, does not block the next question) → advance → `Message(ASSISTANT)` with the next question.
- SSE streaming endpoint serves the candidate portal.
- **Deterministic fallback:** if the LLM is unavailable or errors, the service asks the current question verbatim, stores the answer, and queues evaluation for retry. The interview must never dead-end because of an AI outage.

---

## 7. Safety rules (non-negotiable)

1. AI never bypasses organization boundaries.
2. AI never modifies published pipeline snapshots.
3. AI never changes or deletes human decisions — it may only add recommendations and request review.
4. Every AI state change is permission-validated, org-validated, resource-validated, and audited.
5. The backend remains the final authority for authorization, state validation, and data integrity.

---

## 8. Failure paths

| Failure | Behavior |
|---|---|
| LLM call fails | `AIEvaluation → FAILED`, error metadata stored, no Score written |
| Invalid structured output | 1 retry with validation errors fed back → FAILED if still invalid |
| Backend unreachable | Tool returns typed error; retries with backoff (idempotent reads only) |
| Interviewer LLM down | Deterministic fallback mode (question asked verbatim, evaluation queued) |
| Model disagreement | Conservative blend + `request_human_review` + audit event |

---

## 9. Offline evals

`services/ai-service/evals/` — golden answer set with expected score bands; `pnpm eval` runs the scoring pipeline offline and reports inter-model agreement %, MAE vs bands, and per-criterion calibration. Results are recorded here once Phase 7 lands.

---

## Related documents

- `docs/master-note.md` — full project master note
- `docs/architecture.md`, `docs/database.md`, `docs/api.md` — backend references
