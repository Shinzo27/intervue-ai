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

> Phase 5 added `POST /internal/interviews/:id/conversation` — an idempotent
> transcript bootstrap, without which `appendMessage` 404s and no conversation can start.

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

### Action MCP (implemented)

| Tool | Capability | Purpose |
|---|---|---|
| `advance_interview` | `interview:advance` | Validate an `IN_PROGRESS` interview and return the backend-authoritative position (stage, question, progress) |
| `complete_interview` | `interview:complete` | Mark session + application completed (idempotent) |
| `create_decision` | `decision:recommend` | Derive PASS/FAIL from persisted scores against a pass threshold (default 70%) and persist the recommendation |
| `request_human_review` | `review:request` | Flag an application for recruiter review (model disagreement / failed evaluation) |
| `create_audit_event` | `audit:write` | Append an AI-attributed audit record |

**On `advance_interview`:** question → stage → interview progression is performed
transactionally by the backend inside `submitAnswer` (`interviews.service.ts`), which is
the sole authority for it. The tool therefore validates state, enforces org scope and
audits the step, then returns the backend's authoritative current position — it does not
re-implement progression in the AI service, which would fork the state machine.

**Review flags persist in the audit log.** `request_human_review` writes a
`HUMAN_REVIEW_REQUESTED` audit event; there is no mutable flag column, so the recruiter
UI surfaces flags by querying audit events for the organization.

### Permission matrix (Action MCP)

Implemented in `src/mcp/action/permissions.ts`. Deny-by-default and evaluated in a fixed
order — forbidden → not granted → org scope — so rejections are deterministic and auditable.

- AI **may**: advance interview state, persist evaluations/scores, create AI recommendations, flag for review, audit.
- AI **may never**: override a human decision, modify published pipeline snapshots, access other organizations' data, delete audit history, or bypass state-transition validation.
- `decision:override` is **structurally ungrantable**: it is absent from the grant table and listed in `FORBIDDEN_CAPABILITIES`, so a future edit that merely adds a capability cannot accidentally hand the AI override rights.
- Org scope is deny-by-default at the call site: a tool that cannot verify the resource's owning organization refuses to act.

Every permitted action records `{ tool, actorType, actorId, capability, traceId }` in its
audit metadata.

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

## 6. Conversational interviewer (implemented)

Turn flow (`src/ai/interviewer/agent.ts`):

```text
candidate message
  → Message(CANDIDATE)            (idempotent conversation bootstrap first)
  → Answer(TRANSCRIPT) via POST /internal/interviews/:id/answers
       └─ backend advances question/stage/interview pointers transactionally
  → re-read state, build prompt from the snapshot
  → Message(ASSISTANT) with the NEXT question, verbatim
  → scoring runs after the reply — never blocks the next question
```

- **The pipeline snapshot is the source of truth.** The prompt embeds the current question inside a `<question>` fence and forbids inventing, splitting or rewording it; when there is no current question the agent wraps up instead of asking anything.
- The agent never moves a pointer itself — the backend owns progression.
- Candidate-facing routes: `POST /interviews/:id/chat` and `POST /interviews/:id/chat/stream` (SSE frames `start` → `delta`* → `done`), mounted **before** the MCP bearer guard because the portal is not a tool caller. Phase 9 puts candidate-token verification in front of them.
- **Deterministic fallback:** on LLM failure or empty output the agent asks the snapshot question verbatim and marks the turn `mode: 'fallback'`; the answer is already stored, so scoring can be retried. The interview never dead-ends because of an AI outage.
- A late message on a completed interview is recorded with `scored: false` and never attached to a question, so an afterthought stays visible to the recruiter without polluting scoring state.

Chat uses its own `ChatProvider` contract (`src/llm/chat.ts`), separate from the scoring `LlmProvider`: chat needs multi-turn history and a token cap, which the single-shot structured-output `evaluate()` shape cannot express. `fake` implements the same contract and relays the fenced question, so the offline e2e run exercises the real constraint instead of a stub.

---

## 6b. Human override boundary (implemented)

The AI/human split is enforced on **both** sides, so "AI never overwrites a human
decision" is not a convention but a property of the code:

| Direction | Enforcement |
|---|---|
| AI cannot change a decision | The internal `createDecision` endpoint rejects a second decision for the same application; there is no internal override endpoint at all. The Action MCP also refuses to request `decision:override`, which `permissions.ts` lists in `FORBIDDEN_CAPABILITIES`. |
| Only an authorized human can change one | `POST /interviews/:id/decision/override` requires the `decision:override` permission (owner, admin, recruiter — §44's "Recruiter/Admin"). An interviewer may score an interview but may not change a hiring outcome. |
| History is never silently lost | Each override writes a `DecisionOverride` row holding `previousOutcome`, `newOutcome`, `reason` and the acting user, then updates the decision. |
| Overrides are attributable | The audit event is written with `actorType: USER`, distinguishable forever from the `AI` events written by recommendation flows. |
| Tenant boundary | The service refuses an override whose application belongs to another organization, reported as 404 so the endpoint never confirms another tenant's interview exists. |

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

## 9. Offline evals (implemented)

`services/ai-service/evals/` runs the scoring pipeline offline — no backend, no MCP — over
a golden answer set. `pnpm eval`.

| File | Purpose |
|---|---|
| `fixtures.json` | 36 golden cases across 5 expected-quality levels (excellent → poor), spanning 4 questions and 10 rubric criteria |
| `run.ts` | Loads fixtures, runs every configured provider, writes `report.json` + `report.md` |
| `metrics.ts` | The metric maths, unit-tested (`evals/__tests__/metrics.test.ts`) |

Metrics reported:

- **MAE** vs the expected band midpoint (percentage points)
- **In-band rate** — how often the score landed inside the expected band
- **Inter-model agreement** — % of cases within the 20pp disagreement threshold, plus mean gap
- **By-level means** — a healthy evaluator is *monotonic*: excellent answers must outscore poor ones
- **Per-criterion separation** — mean awarded % on high-band cases minus low-band cases. A criterion near 0pp is not discriminating between a strong answer and a weak one, which is a rubric defect the aggregate score hides.

### Baseline numbers (measured)

Recorded from a complete run — 35 of 36 cases scored (97.2%), the one dropout being a
provider schema-validation failure, not a harness problem.

| Metric | Value |
|---|---|
| Cases | 36 (35 scored, 97.2%) |
| **MAE vs expected band midpoint** | **11.9 pp** |
| **In-band rate** (score landed inside the expected band) | **77.1%** |
| **Inter-model agreement** (Δ ≤ 20pp) | **94.3%** (mean gap 5.9 pp) |
| Mean score across all cases | 57.9% |
| Runtime | ~12 min, 72 provider calls |

**Run-to-run variance** (same fixtures, same models, a later run): MAE **12.2 pp**, in-band
**68.6%**, inter-model agreement **91.4%** (mean gap 7.9 pp). LLM scoring is not deterministic,
so treat roughly ±1 pp of MAE and several points of in-band rate as noise: use this harness to
compare *changes* (a prompt or rubric edit), never to compare absolute runs with each other.

By expected quality level — the evaluator is **monotonic**, which is the strongest single
signal that it is actually discriminating rather than scoring everything alike:

| Expected level | n | Mean score | MAE |
|---|---|---|---|
| excellent | 7 | 95.4% | 5.7 pp |
| strong | 7 | 88.2% | 8.1 pp |
| adequate | 7 | 68.9% | 17.1 pp |
| weak | 6 | 24.2% | 15.8 pp |
| poor | 8 | 14.4% | 13.1 pp |

Per-criterion separation (mean awarded % on high-band minus low-band cases): every
criterion discriminates, from **46.7 pp** (Clarity) to **100 pp** (MCQ Correctness and
Justification). The weakest criterion is the actionable one — Clarity is the criterion
least affected by answer quality.

**Configuration:** `groq:openai/gpt-oss-120b` + `groq:qwen/qwen3.8-27b`.

### Caveats to state alongside these numbers

1. **Model-level diversity, not provider-level.** Both scorers run on one provider, so
   94.3% agreement is corroboration between two *models*, not between two independent
   vendors. The harness prints which kind a run used for exactly this reason. Configure
   `LLM_SECONDARY_PROVIDER=openai` with an OpenAI key for genuine provider diversity.
2. **1 of 72 calls (1.4%) returned structurally invalid JSON** from `gpt-oss-120b` — a
   non-string `rubricCriterionVersionId`. The Zod contract caught it and no invalid score
   was written, which is the designed failure path, but the true structured-output
   reliability is ~98.6%, not 100%.
3. **10 of 72 calls were rate-limited and needed retry.** Free-tier output-token caps are
   tight; the harness backs off and honours the provider's stated wait. Keep
   `EVAL_CONCURRENCY` low on free tiers.
4. **Single run, single point in time.** Model versions change underneath you; re-run
   before quoting.

### Reproducing

```bash
LLM_PROVIDER=groq GROQ_API_KEY=... \
LLM_SECONDARY_PROVIDER=groq LLM_SECONDARY_MODEL=qwen/qwen3.8-27b \
EVAL_CONCURRENCY=2 pnpm --filter ai-service eval
```

A run is only reported as quotable when it used real providers **and** scored ≥95% of
cases. Errored cases drop out of the metrics entirely, so a partial run reports only the
survivors and looks equally confident — see `isQuotable()` in `evals/metrics.ts`.

---

## Related documents

- `docs/master-note.md` — full project master note
- `docs/architecture.md`, `docs/database.md`, `docs/api.md` — backend references
