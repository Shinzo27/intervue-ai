# Build from the repo root:
#   docker build -f apps/hr-dashboard/Dockerfile -t intervue-hr-dashboard .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /repo

COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter hr-dashboard build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo ./

EXPOSE 3002

CMD ["pnpm", "--filter", "hr-dashboard", "start"]
