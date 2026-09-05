# Intervue AI

Multi-tenant, AI-powered interview & recruitment SaaS.

Organizations create reusable interview pipelines (immutable published versions), publish jobs, invite candidates via tokenized links (no candidate accounts), and run **conversational AI interviews** whose evaluations are governed by an MCP tool layer with permission-checked actions, two-model scoring, and a full audit trail.

## Monorepo layout

```text
apps/
  marketing/          Public landing page (Next.js)
  hr-dashboard/       Recruiter dashboard (Next.js)        — Phase 8
  candidate-portal/   Candidate interview UI (Next.js)     — Phase 9
services/
  backend/            NestJS REST API (auth, RBAC, jobs, pipelines, interviews, scoring, decisions, audit)
  ai-service/         MCP server + AI agent + two-model scoring + evals
packages/
  ui/                 Shared React primitives
  types/ utils/ config/ eslint-config/ typescript-config/
infra/
  compose/            docker-compose.dev.yml (PostgreSQL + Redis)
docs/                 Architecture & reference docs
```

## Services & ports (dev)

| Service | Port | Notes |
|---|---|---|
| backend | 3000 | REST API at `/api`, Swagger at `/api/docs` |
| marketing | 3001 | Public site |
| hr-dashboard | 3002 | Recruiter app (planned) |
| candidate-portal | 3003 | Candidate app (planned) |
| ai-service | 3100 | MCP HTTP transport |
| PostgreSQL | 5432 | `intervue/intervue_dev`, db `intervue_dev` |
| Redis | 6379 | BullMQ (invitations, async AI work) |

## Quickstart

**Prerequisites:** Node 18+, pnpm 9 (`corepack enable`), Docker.

```sh
# 1. Install
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/compose/docker-compose.dev.yml up -d

# 3. Environment
cp services/backend/.env.example services/backend/.env
cp services/ai-service/.env.example services/ai-service/.env
# → fill in BETTER_AUTH_SECRET, INTERNAL_SERVICE_SECRET, OPENAI_API_KEY

# 4. Database schema
cd services/backend && pnpm exec prisma migrate dev && cd ../..

# 5. Run everything
pnpm dev
```

Backend Swagger: http://localhost:3000/api/docs

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | All services via Turbo |
| `pnpm build` | Production build (cached) |
| `pnpm lint` / `pnpm check-types` | Lint / typecheck all workspaces |
| `pnpm --filter backend test` | Backend unit tests |

## Documentation

- [`docs/ai.md`](docs/ai.md) — AI & MCP architecture (tool catalog, two-model scoring, safety rules)
- [`docs/master-note.md`](docs/master-note.md) — full project master note
- [`docs/architecture.md`](docs/architecture.md) · [`docs/database.md`](docs/database.md) · [`docs/api.md`](docs/api.md) — backend references
- [`infra/postman/`](infra/postman/) — Postman collection (all sprints + internal API) & runnable chain runner:
  `python infra/postman/run_collection.py` (backend must be running on :3000)
