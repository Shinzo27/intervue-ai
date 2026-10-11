# Build from the repo root:
#   docker build -f apps/candidate-portal/Dockerfile -t intervue-candidate-portal .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /repo

COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter candidate-portal build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo ./

EXPOSE 3003

CMD ["pnpm", "--filter", "candidate-portal", "start"]
