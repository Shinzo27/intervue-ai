# Build from the repo root (monorepo context):
#   docker build -f services/backend/Dockerfile -t intervue-backend .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /repo

# Whole-repo context: the pnpm workspace must be resolvable as a graph.
COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

# pnpm does not run dependency postinstall scripts by default, so the Prisma
# client must be generated explicitly — without it `nest build` compiles
# against missing types (198 errors) even though it works on the host.
RUN pnpm --filter backend exec prisma generate

RUN pnpm --filter backend build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo ./

EXPOSE 3000

# Migrations run at container start so `docker compose up` yields a usable
# database; the API only begins serving after the schema is current.
CMD ["sh", "-c", "pnpm --filter backend exec prisma migrate deploy && node services/backend/dist/main"]
