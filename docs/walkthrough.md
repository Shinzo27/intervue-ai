# Intervue AI — project walkthrough

Everything in this document describes behaviour that exists in the code today. Where
something is partial or missing it says so explicitly.

## 1. What the product is

A multi-tenant recruitment SaaS where the interview itself is conducted by an AI agent, and
every AI action runs through a permission-checked, auditable tool layer. Humans define the
interview structure, and humans keep the final hiring decision.

Four **human roles** plus one **AI actor**:

| Actor | Who | Identity | How they act |
|---|---|---|---|
| `OWNER` | Org creator | Better Auth user + organization membership | Session cookie |
| `ADMIN` | Org manager | Better Auth user + membership | Session cookie |
| `RECRUITER` | Hires | Better Auth user + membership | Session cookie |
| `INTERVIEWER` | Evaluates | Better Auth user + membership | Session cookie |
| `AI` | ai-service | **No user account** — holds a service token | Internal API + MCP tools |
| *Candidate* | Interviewee | **No account at all** — holds an invite token | Public tokenized routes |

The candidate is deliberately not an RBAC role: they authenticate by possession of a token, not
by identity. That is what makes "candidates never need an account" safe.

## 2. Permission matrix (source: `config/role-permission.ts`)

| Capability | OWNER | ADMIN | RECRUITER | INTERVIEWER |
|---|:--:|:--:|:--:|:--:|
| `organization:manage` | ✅ | — | — | — |
| `members:manage` | ✅ | ✅ | — | — |
| `jobs:view` / `create` / `update` / `publish` | ✅ | ✅ | ✅ | — |
| `jobs:delete` | ✅ | ✅ | — | — |
| `pipeline:view` | ✅ | ✅ | ✅ | ✅ |
| `pipeline:create` / `update` | ✅ | ✅ | ✅ | — |
| `pipeline:delete` | ✅ | ✅ | — | — |
| `candidate:view` | ✅ | ✅ | ✅ | ✅ |
| `interview:evaluate` | ✅ | ✅ | **—** | ✅ |
| `decision:override` | ✅ | ✅ | ✅ | — |
| `audit:view` | ✅ | ✅ | ✅ | — |

**Known inconsistency (not yet fixed):** the application review screen is gated on
`interview:evaluate`, but `RECRUITER` does not hold that capability — so a recruiter can own the
decision (`decision:override`) yet cannot open the screen that shows the scores behind it. The
fix is a product decision: either grant `interview:evaluate` to `RECRUITER`, or split
"view evaluation" from "run evaluation" into two capabilities. Currently `OWNER`, `ADMIN` and
`INTERVIEWER` can open the review screen; `RECRUITER` gets 403.

## 3. Role-by-role walkthrough

### OWNER — everything, plus org lifecycle
1. Signs up / signs in (Better Auth, email + password) → creates an organization.
2. Manages members and invitations (`members:manage`) — invite a recruiter or interviewer,
   change their role, remove them.
3. Builds pipelines, publishes versions, publishes jobs, invites candidates.
4. Reviews any application, overrides any decision, reads the full audit trail.
5. Can delete pipelines and jobs (`jobs:delete`, `pipeline:delete`).

### ADMIN — same operational surface, without org deletion rights
Everything OWNER does except `organization:manage` (rename/delete the organization itself).
Admins manage members, publish, review, override, and read audit.

### RECRUITER — the hiring loop
1. Creates job postings against an existing pipeline.
2. **Publishes a job** — this freezes the chosen pipeline into an immutable `PipelineVersion`.
   From that moment the job can only ever be interviewed on that snapshot.
3. **Invites a candidate** (name + email, no account): creates `Candidate` + `Application` +
   a unique `inviteToken`, and queues an invitation email containing the interview link.
4. Watches applications progress: `INVITED → STARTED → IN_PROGRESS → COMPLETED → DECIDED`.
5. Reads scores and AI evaluations, then **overrides the AI decision** when it is wrong —
   reason required, previous outcome preserved (§44).
6. Reads the audit trail to see what the AI did and when.
7. **Cannot** run evaluations (`interview:evaluate` missing) — see the inconsistency above.

### INTERVIEWER — evaluation-only
1. Can view pipelines (read-only) and candidates.
2. Can run/trigger answer evaluation (`interview:evaluate`).
3. **Cannot** create or publish jobs, manage pipelines, decide, or read audit.

### AI actor — never an administrator
The ai-service holds a **separate service token** (`Internal <secret>`) and can only reach the
21 internal routes, never the session-guarded recruiter routes. Its capabilities are a fixed
allow-list (`ai-service/src/mcp/action/permissions.ts`); `decision:override` is structurally
ungrantable, so the AI can never replace a human decision. Every action it takes is audited with
`actorType: AI` and tool/capability metadata.

### Candidate — capability, not identity
1. Opens `/interview/<token>` (candidate portal). The token resolves to exactly one application;
   there is no interview id in the URL to guess or tamper with.
2. Sees an intro (job title, expectations), starts the interview, and answers conversationally.
3. Refreshing mid-interview restores the transcript and progress bar.
4. Sees a completion screen; their answers are already scored as they go.
5. Cannot see scores, other candidates, or any recruiter surface.

## 4. The end-to-end workflow (the demo spine)

```
recruiter                 candidate                    ai-service                  recruiter
   │                          │                             │                          │
   ├─ build pipeline ─────────┤                             │                          │
   ├─ publish pipeline ───────┤  (immutable snapshot)       │                          │
   ├─ publish job ────────────┤  (job pins the snapshot)    │                          │
   ├─ invite candidate ───────┼──► email with token link    │                          │
   │                          ├─ open /interview/<token>   │                          │
   │                          ├─ POST start ───────────────►│ opening question          │
   │                          ├─ POST chat ────────────────►│ reply + next question     │
   │                          │                             ├─ evaluate_answer ────────┤
   │                          │                             │   (2 models, consensus)   │
   │                          ├─ final answer ─────────────►│ complete_interview        │
   │                          │                             ├─ create_decision ────────┤
   │                          │                             │   (threshold → PASS/FAIL) │
   ├─ review scores ──────────┼─────────────────────────────┼──────────────────────────┤
   ├─ override decision ──────┤  (reason required, audited) │                          │
   └─ read audit trail ───────┘                             │                          │
```

State transitions, enforced in the backend (not the UI):

| Entity | States |
|---|---|
| Application | `INVITED → STARTED → IN_PROGRESS → COMPLETED → DECIDED` |
| Interview session | `NOT_STARTED → IN_PROGRESS → COMPLETED` (`ABANDONED` when expired) |
| Interview stage | `NOT_STARTED → IN_PROGRESS → COMPLETED` (`SKIPPED`) |
| AI evaluation | `PENDING → COMPLETED` or `FAILED` |
| Decision | `PASS` / `FAIL` |
| Pipeline version | `PUBLISHED` → `ARCHIVED` (never mutated, never deleted) |

## 5. Functionality catalogue

### Authentication and multi-tenancy
- Better Auth at `/api/auth` — email/password, sessions, organizations, members, invitations.
- Every business table carries `organizationId`; every query is scoped by the caller's active
  organization. Cross-org access returns **404, not 403** — the API does not confirm that a
  record it will not show you exists.
- Session → active org → role → permission set, resolved per request by `PermissionsGuard`.

### Pipelines (the interview blueprint)
- Stages → questions (ordered) → options (MCQ) → rubric criteria with weights.
- **Draft vs published:** a draft is freely editable; publishing deep-copies it into an
  immutable `PipelineVersion`. A job pins one version forever.
- Publishing validates the draft first (no empty stages, no questions without criteria) and
  bumps the version number atomically. The same helper (`pipeline-snapshot.ts`) backs both
  pipeline publish and job publish, so the immutability rule exists in exactly one place.
- `GET /pipelines/:id/versions` shows the history; the UI marks drafts editable and published
  snapshots read-only.

### Jobs and invitations
- Job posting = title, description, location, employment type, and a pinned pipeline version.
- Publishing a job is what creates the pinned snapshot; drafts stay editable.
- Invitation creates `Candidate` (deduped by email per org), `Application`, `inviteToken`,
  and enqueues an email. Inviting twice reuses the candidate, not the application.

### Interview runtime
- The backend owns state: session, current stage/question, transcript, answers, progress.
- The AI service reads state through **Pipeline MCP** and writes answers/decisions through the
  internal API — it never touches the database.
- Answers are typed (`TEXT`, `OPTION`, `TRANSCRIPT`) and immutable once stored.

### AI evaluation (two-model scoring)
- Each answer is scored by **two different providers** (enforced at startup: the secondary
  provider must differ from the primary, or the service refuses to boot).
- Each model's result is stored as its own `AIEvaluation` row (`PENDING → COMPLETED/FAILED`),
  so a provider failure is visible rather than silently averaged away.
- **Agreement ≤ 20 percentage points** → consensus score (per-criterion average).
  **Disagreement > 20** → `needsHumanReview` + a `SCORING_DISAGREEMENT` audit event. The system
  never quietly picks one model's opinion.
- Scores aggregate per answer → per application, with criterion-level detail retained.

### Decisions
- `create_decision` compares the aggregate score to a threshold → `PASS`/`FAIL`, writes the
  decision with `decidedBy: AI`, and audits it.
- A human with `decision:override` can override; the override stores the reason, the previous
  outcome, and who did it. The AI cannot call override — structurally impossible.

### Audit
- Append-only events with `actorType: USER | AI | SYSTEM`, actor id, action, entity,
  before/after metadata, and the MCP tool name for AI actions.
- Recruiter-facing `GET /audit` (permission `audit:view`) with filters. This is the answer to
  "how do you trust an AI in a hiring loop" — you can read every move it made.

### Notifications
- BullMQ queues (Redis) with a pluggable transport: `dev` logs the email, `resend` sends it.
- Two events: candidate invitation (with the tokenized link) and interview completion
  (to the job owner, including the score).
- Notification is fired **after** the database transaction commits, so a queue failure can never
  roll back a stored answer.

### User interfaces
| App | Port | Audience | Pages |
|---|---|---|---|
| HR dashboard | 3002 | owner/admin/recruiter/interviewer | `/dashboard`, `/jobs`, `/jobs/[id]`, `/applications`, `/applications/[id]` (review + override), `/pipelines`, `/pipelines/[id]` (builder + versions), `/audit` |
| Candidate portal | 3003 | candidate (token) | `/`, `/interview/[token]` |
| Marketing | 3001 | public | landing |

Both Next apps proxy through same-origin route handlers, so there is no CORS surface and no
token ever reaches browser JS for the candidate flow.

## 6. The MCP layer (why it exists)

The AI is not given database access. It is given **12 tools** in three groups, each one a
business operation with the same validation, permission checks and audit as a human action:

| Group | Tools |
|---|---|
| Pipeline (read) | `get_current_interview_state`, `get_current_question`, `get_stage_questions`, `get_question_details`, `get_interview_progress` |
| Scoring | `evaluate_answer` (write), `get_application_scores` (read) |
| Action | `advance_interview`, `complete_stage`, `complete_interview`, `create_decision`, `request_human_review`, `create_audit_event` |

Transports: stateless **Streamable HTTP** (`POST /mcp`, bearer token) for the platform, and
**stdio** for Claude Desktop / MCP Inspector — same tool registry, same permissions.

Design consequences worth stating in an interview:
- **The backend is the source of truth for scoring input.** `evaluate_answer` takes an answer
  id; the orchestrator fetches the answer, its question and its rubric from the backend. A
  caller cannot inject text to inflate a score.
- **Permissions are enforced server-side per tool**, not by trusting the agent.
- **Every tool call is traceable**: `x-trace-id` is propagated and attached to audit events.

## 7. Known gaps

| Gap | Impact |
|---|---|
| `RECRUITER` lacks `interview:evaluate` | Recruiters cannot open the review screen (§2) |
| Org settings (10.2) not built | Decision threshold and model choice are env-only, not per-organization |
| No file/object storage | Resume upload designed for, not implemented |
| Dashboard has no member-management UI | Roles/invitations are API-only today |
| Next apps ship without production asset optimisation | Fine for demo, not for real traffic |
| Image build is slow (~10 min cold) | Each Dockerfile installs the workspace; a shared base stage would fix it |

## 8. Demo script (5 minutes)

```sh
docker compose -f infra/compose/docker-compose.yml up --build   # or: pnpm dev + dev infra
python infra/postman/run_collection.py                          # seeds a full org
```
1. Sign in at `localhost:3002` as the seeded owner.
2. `/pipelines` → open the backend-engineer pipeline → show the draft, then versions.
3. `/jobs` → open the job → show the pinned version.
4. `/applications` → invite a candidate → copy the tokenized link from the backend log.
5. Open the link at `localhost:3003` → answer the questions.
6. Back in `/applications/[id]` → scores, per-criterion detail, AI decision.
7. Override the decision with a reason → `/audit` shows both the AI decision and the override.

