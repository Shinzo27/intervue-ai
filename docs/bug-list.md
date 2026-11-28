# Bug list

_As of 2026-11-28._ Bugs found while bringing the stack up and during days 1–2 of the frontend redesign.
**8 are open** and **12 are fixed**. Each fixed entry names the commit that fixed it.

Severity: **High** blocks running, building or using a core flow · **Medium** wrong behaviour with a workaround · **Low** cosmetic, tooling or docs.

## Open

| # | Severity | Area | Bug | Impact | Suggested fix |
|---|---|---|---|---|---|
| 1 | Medium | Backend API | `GET /job-postings/:id` returns `pipeline: null` even when `pipelineId` is set (the list endpoint returns it correctly). | Clients think no pipeline is attached. The dashboard works around it by looking the pipeline up by `pipelineId`. | Include the `pipeline` relation in the job-postings `findOne` query. |
| 2 | Medium | Backend tooling | `pnpm --filter backend lint` reports 1,902 errors, mostly `no-unsafe-*` on Prisma calls, because the Prisma client isn't generated locally (no `node_modules/.prisma/client`). | Lint is unusable for the backend; the root `pnpm lint` fails. | Run `prisma generate` in a `postinstall` or `prelint` script, then fix any real errors left. |
| 3 | Medium | Backend tooling | The backend `lint` script runs `eslint --fix`, so linting rewrites source files (13 files were reformatted by one run). | Running lint, or the root `pnpm lint`, leaves unexpected diffs. | Make `lint` check-only; add a separate `lint:fix`. |
| 4 | Medium | Auth / Team | Better Auth's organization plugin has no `sendInvitationEmail`, and no screen lists or accepts invitations. | Teammates invited during onboarding stay "pending" and can never join. | Configure `sendInvitationEmail` (Resend transport already exists) and build the Team screen (redesign day 4) with an accept-invitation route. |
| 5 | Medium | Permissions | `RECRUITER` holds `decision:override` but not `interview:evaluate`, so the application review screen returns 403 for recruiters (see [walkthrough.md](walkthrough.md), section 2). | Recruiters can't see the scores behind the decisions they own. | Product decision: grant `interview:evaluate` to `RECRUITER`, or split "view evaluation" from "run evaluation". |
| 6 | Low | Backend API | `GET /applications` doesn't return review flags (`needsHumanReview`, model disagreement) or the decision. | The dashboard can't show a "Flagged for review" count; it shows "Decided" instead. | Add a review summary (flag count, decision outcome) to the list response. |
| 7 | Low | Tooling | `infra/postman/update_collection.py` reads from `C:/Users/PRATHAM/Downloads/…` and writes to `E:/Projects/…`. | The collection can only be regenerated on the original author's machine. | Take the source path as an argument; write next to the script. |
| 8 | Low | Docs | `docs/api.md`, `docs/architecture.md`, `docs/database.md` and `docs/frontend.md` are empty but linked from the README. | Readers hit blank pages. | Fill them, or remove the links until they're written. |

**Also noted (not bugs):** `pnpm install` warns about an unmet peer dependency (`@better-auth/drizzle-adapter` wants `drizzle-orm@^0.45.2`; `0.41.0` is installed). It has no visible effect today.

## Fixed

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 1 | High | Backend / Docker | Backend container crash-looped: `Cannot find module dist/main`. `prisma.config.ts` widens the TypeScript root, so the build emits to `dist/src/main`. | Docker `CMD` and `start:prod` point to `dist/src/main`. | `51cf1d9` |
| 2 | High | AI service | Service refused to start without OpenAI/Groq keys, contradicting the docs. Compose passes unset keys as empty strings, which failed validation. | Blank `OPENAI_API_KEY` / `GROQ_API_KEY` / `MCP_HTTP_TOKEN` are treated as unset, so the offline `fake` provider boots. | `51cf1d9` |
| 3 | Medium | Tooling | `pnpm demo:seed` (`run_collection.py`) read the backend `.env` from a hard-coded `E:/Projects/…` path and crashed on Linux. | Secret resolved from the env var, then the repo-relative `.env`, then the compose default. | `51cf1d9` |
| 4 | High | Dashboard | No sign-up or create-organization screen, though the README demo starts with "sign up, create an organization". | `/sign-up`, `/sign-in` and a 3-step `/onboarding`; signed-out users and users with no organization are routed there. | `2d5a921` |
| 5 | Medium | Frontend tooling | `pnpm lint` crashed in `hr-dashboard` and `candidate-portal`: lint script but no ESLint config (the portal didn't have ESLint installed). | Added configs and dependencies; fixed the 8 errors and 3 warnings this surfaced. Both apps lint with 0 problems. | `2da406b` |
| 6 | Medium | Frontend | Pages set state synchronously inside effects (`react-hooks/set-state-in-effect`): cascading re-renders. | Shared `useResource` hook; all pages load through it. | `8b5c2f8`, `2da406b` |
| 7 | Medium | Frontend build | Turbopack's `next/font/google` loader failed in the candidate portal ("queries have exactly one entry"), and builds needed network access to Google Fonts. | Fonts self-hosted via `@fontsource-variable` and `next/font/local`; builds work offline. | `4398268` |
| 8 | Medium | Dashboard | Candidate interview links were hard-coded to `http://localhost:3003`. | Built from `NEXT_PUBLIC_CANDIDATE_PORTAL_URL` (default unchanged). | `8b5c2f8` |
| 9 | Low | Dashboard | Internal links used `<a href>` (full page reloads); sign-out used `window.location`. | `next/link` and the router. | `2d5a921`, `2da406b` |
| 10 | Low | Dashboard | Navigation used Unicode glyphs (◱ ▤ ⑃) as icons, with no accessible names when collapsed. | Lucide icons; tooltips and `aria-label`s in the collapsed sidebar. | `b1d2109` |
| 11 | Low | UI kit (redesign) | Tab strip scrolled vertically because triggers overlapped the list border. | Baseline drawn as an inset shadow. | `ccbff75` |
| 12 | Low | UI kit (redesign) | Stepper hid step labels on phones with `display: none`, so screen readers heard only "1, 2, 3". | Labels visually hidden but still announced. | `2d5a921` |

## How to verify

- Stack: `docker compose -f infra/compose/docker-compose.yml up --build`, then `python3 infra/postman/run_collection.py`. The last run passed 56/56.
- Frontend lint: `pnpm --filter hr-dashboard lint` and `pnpm --filter candidate-portal lint`. Both pass with 0 problems.
