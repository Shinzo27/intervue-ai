# Deployment

## Local, one command (recommended for demos)

```sh
docker compose -f infra/compose/docker-compose.yml up --build
```

Brings up Postgres, Redis, the API, the AI service and both Next.js apps.
Migrations run at backend startup, so no manual step is needed.

| Host port | Service |
|---|---|
| 3000 | REST API (`/api`, Swagger at `/api/docs`) |
| 3100 | AI service (MCP HTTP transport + interviewer routes) |
| 3002 | HR dashboard (recruiter console) |
| 3003 | Candidate portal (tokenized interviews) |

Postgres and Redis are **not** published to the host — app containers reach them over
the compose network (`postgres:5432`, `redis:6379`). This keeps the stack from
colliding with a locally installed PostgreSQL/Redis, which is common on dev machines.

### Images

| Image | Dockerfile | Notes |
|---|---|---|
| `intervue-backend` | `services/backend/Dockerfile` | Runs `prisma migrate deploy` before `node dist/main` |
| `intervue-ai-service` | `services/ai-service/Dockerfile` | `node dist/index.js http` — MCP + interviewer |
| `intervue-hr-dashboard` | `apps/hr-dashboard/Dockerfile` | `next build` then `next start -p 3002` |
| `intervue-candidate-portal` | `apps/candidate-portal/Dockerfile` | `next build` then `next start -p 3003` |

All four use the repo root as build context (pnpm workspaces must resolve as a graph)
and share a BuildKit cache mount for the pnpm store.

**Image size tradeoff:** the runtime stages copy the whole workspace (including
dev dependencies) so the images are large — the backend image is ~1.9 GB on disk
(384 MB compressed). This is deliberate for a portfolio demo (simplicity and
reproducibility over size); a production build would prune to production
dependencies with `pnpm deploy` or a multi-stage pruned copy.

Two container-specific gotchas, both already handled in the Dockerfiles:

1. **Prisma client generation** — pnpm does not run dependency postinstall scripts by
   default, so `prisma generate` is an explicit build step. Without it `nest build`
   fails with ~198 type errors that do not reproduce on the host.
2. **Redis connection** — the queue module reads `REDIS_HOST` / `REDIS_PORT` from the
   environment instead of hardcoding `localhost`, so the same image works locally and
   in compose.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `INTERNAL_SERVICE_SECRET` | dev value | Shared secret between backend and AI service |
| `BETTER_AUTH_SECRET` | dev value | Session/token signing — **change in production** |
| `FRONTEND_URL` | dashboard + portal + marketing | CORS + Better Auth trusted origins (comma-separated) |
| `LLM_PROVIDER` / `LLM_SECONDARY_PROVIDER` | `fake` / `none` | `fake` runs the product fully offline |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | — | Required when the matching provider is selected |
| `RESEND_API_KEY` | — | Unset → the dev notification transport logs emails instead of sending |

## Local development (app code outside containers)

```sh
pnpm install
docker compose -f infra/compose/docker-compose.dev.yml up -d   # Postgres + Redis only
cp services/backend/.env.example services/backend/.env
cp services/ai-service/.env.example services/ai-service/.env
cd services/backend && pnpm exec prisma migrate dev && cd ../..
pnpm dev                                                        # turbo runs every service
```

## Not production-ready yet

- No TLS/ingress story, no secrets manager — env vars only.
- Next.js apps run in development-style servers inside the images (`next start` is
  production mode, but there is no CDN/asset optimisation pass).
- The AI service holds a single shared service token rather than per-call mTLS.
- Object storage (resumes/files) is designed for but not implemented (master note §46).
