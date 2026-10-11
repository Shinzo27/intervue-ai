# Build from the repo root:
#   docker build -f services/ai-service/Dockerfile -t intervue-ai-service .
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /repo

COPY . .

RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm --filter ai-service build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo ./

# MCP HTTP transport + the candidate-facing interviewer routes.
EXPOSE 3100

CMD ["node", "services/ai-service/dist/index.js", "http"]
