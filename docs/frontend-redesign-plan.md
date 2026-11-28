# Intervue AI — Frontend Redesign Plan

_As of 2026-11-28_

## Summary

We rebuild every Intervue AI frontend surface from scratch in 4 days on one shared design system, keeping the backend and API contracts unchanged. Today the three apps use three unrelated colour schemes, system fonts, Unicode glyphs as icons and dark-only themes; after the redesign they read as one trustworthy hiring product.

**In scope**

- `packages/ui` — rebuilt as the single design system: tokens, theme, and every component the apps use.
- `apps/hr-dashboard` — recruiter console: auth and onboarding, dashboard, jobs, pipelines, applications, review, audit, plus new team and settings screens.
- `apps/candidate-portal` — the account-less, AI-led interview experience.
- `apps/marketing` — the public landing page.

**Out of scope:** backend, ai-service, database, API shapes. Where a new screen needs data the API does not expose yet, it ships with the UI and an empty state, and the gap is listed under open decisions.

**"From scratch" means:** new tokens, new components, new layouts and new copy. Existing page files are replaced, not restyled; only data-fetching code in `src/lib` is reused.

**Done when**

- All three apps import tokens and components only from `@repo/ui`; no hex values or one-off CSS classes in app code.
- Light and dark themes, both passing WCAG 2.2 AA contrast (4.5:1 text, 3:1 UI).
- Every screen works at 375, 768, 1024 and 1440 px with no horizontal page scroll.
- The README's 5-minute demo runs end to end on the new UI, including sign-up, which has no screen today.
- Lighthouse accessibility 95+ and CLS under 0.1 on every page.

## Current state audit

The frontend is about 3,550 lines of TSX across three Next.js 16 / React 19 / Tailwind 4 apps, and each app invents its own look. The shared `@repo/ui` package has only 7 primitives, and the candidate portal does not use it at all.

| Surface | Screens today | Look today | Main problems |
| --- | --- | --- | --- |
| HR dashboard (:3002) | Sign-in (inline in the shell layout), Dashboard, Jobs list + detail, Pipelines list + builder, Applications list + review, Audit | Dark only, indigo accent `#6366f1`, system font, local `.panel` / `.chip` classes | No sign-up or create-organization screen, though the README demo starts there; no team or settings screens, though the API supports member management; Unicode glyphs (◱ ▤ ⑃) as nav icons; review page is one 448-line file |
| Candidate portal (:3003) | Landing, Interview `/interview/[token]` | Dark only, its own token set, no shared components | The whole interview flow is one 380-line page; no designed states for expired link, connection loss or completion |
| Marketing | One page: hero, how it works, differentiator, product preview, demo, pricing, footer | Dark only, amber accent `#f5a623`, framer-motion | Brand colour differs from the product it sells; no light theme |
| `packages/ui` | badge, button, card, code, container, input, mono-label | Unthemed primitives | No tokens, no form, table, dialog, toast, tabs, menu or empty-state components |

**What we keep:** routes and URL shapes (invite links already sent must keep working), `src/lib/api.ts` and `auth-client.ts`, and Better Auth as the session layer.

## Design direction

The product should feel like **calm precision**: a trustworthy hiring tool where the AI is clearly visible but never in charge. Light is the default theme, with a full dark theme; trust blue drives actions, and one violet hue marks everything the AI did.

The UI/UX Pro Max design-system search (B2B SaaS, AI recruiting; variance 4, motion 4, density 7) returned the "Hero + Features + CTA" pattern, a trust-blue palette and Plus Jakarta Sans. Its style pick, glassmorphism, suits a marketing hero but hurts legibility in dense tables, so we split the style by surface:

| Surface | Style (UI/UX Pro Max) | Density | Why |
| --- | --- | --- | --- |
| HR dashboard | Data-Dense Dashboard | High: 36 px table rows, 8–12 px card padding | Recruiters scan many candidates and scores; maximum information per screen |
| Candidate portal | Minimal, conversation-first | Low: one column, max 720 px | One nervous candidate, one task; nothing should compete with the question |
| Marketing | Hero + Features + CTA, frosted glass in the hero only | Low: 24–96 px spacing | Persuasion and first impression; motion allowed here and nowhere else |

**Signature idea — human vs AI is always visible.** The product's core promise is that humans keep the final say. Every AI-authored item (interviewer messages, AI scores, AI decisions, audit rows with `actorType: AI`) carries the violet AI marker; human actions use neutral styling. Model disagreement and "needs human review" use the warning colour, never the AI colour.

**Do**

- Use SVG icons from one set (Lucide) everywhere.
- Show scores as number + bar + band label, never colour alone.
- Stream interviewer text token by token instead of showing a long spinner.
- Keep focus rings visible, and respect `prefers-reduced-motion`.

**Don't**

- Emoji or Unicode glyphs as icons.
- Dark theme by default, or glass effects inside the dashboard.
- Bouncy easing (`back.out`) on tables or data, which reads as sloppy on informational UI.
- Placeholder-only form labels, or errors shown only at the top of a form.

## Design system

All tokens live in `packages/ui/src/styles/tokens.css` as CSS variables, mapped into Tailwind 4 with `@theme`, and switched by `[data-theme]` plus `prefers-color-scheme`. Components reference semantic names only (`bg-surface`, `text-muted`), never hex values. Light values for primary, background, muted and destructive come from the UI/UX Pro Max palette; the dark theme and the AI, success and warning colours are our additions. Every ratio below was computed against its real background.

### Colour

| Token | Light | Dark | Contrast (light / dark) | Use |
| --- | --- | --- | --- | --- |
| `--bg` | `#F8FAFC` | `#0B1120` | — | Page background |
| `--surface` | `#FFFFFF` | `#111827` | — | Cards, tables, panels |
| `--fg` | `#0F172A` | `#E2E8F0` | 17.1 / 15.3 | Body text |
| `--muted-fg` | `#475569` | `#94A3B8` | 7.6 / 6.9 | Secondary text, labels |
| `--border` | `#E2E8F0` | `#1F2937` | decorative | Dividers, card edges |
| `--border-input` | `#64748B` | `#64748B` | 4.8 / 3.7 | Inputs, checkboxes (3:1 UI rule) |
| `--primary` | `#2563EB` | `#60A5FA` | 5.2 / 7.4 with on-primary | Primary buttons, links, focus ring |
| `--ai` | `#7C3AED` | `#A78BFA` | 5.7 / 6.5 | Everything the AI authored |
| `--success` | `#15803D` | `#4ADE80` | 5.0 / 10.2 | Pass, completed |
| `--warning` | `#B45309` | `#FBBF24` | 5.0 / 10.6 | Needs review, model disagreement, expiring |
| `--danger` | `#DC2626` | `#F87171` | 4.8 / 6.4 | Fail, destructive actions, errors |
| `--accent` | `#EA580C` | `#EA580C` | 5.9 with black text | Marketing CTAs only |

Each status colour also gets a `-subtle` tint (about 10% opacity on the surface) for badges and row highlights, with text staying in the full colour.

### Typography

- **UI and headings:** Plus Jakarta Sans 400 / 500 / 600 / 700, loaded via `next/font` (no layout shift).
- **Data:** Fira Code 500 with tabular numbers for scores, IDs, tokens and timestamps (UI/UX Pro Max "Dashboard Data" pairing).
- **Scale (px / line height):** 12/16 caption · 14/20 body-sm (tables) · 16/24 body · 18/28 lead · 20/28 h4 · 24/32 h3 · 30/36 h2 · 36/40 h1 · 48–60 marketing display.
- Body text is never below 14 px in the app or 16 px in the candidate portal.

### Space, shape, depth, motion

- **Spacing:** 4 px base; scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- **Radius:** 6 px inputs and badges · 8 px buttons · 12 px cards · 16 px dialogs · full for avatars and pills.
- **Elevation:** 3 levels — `sm` (cards, a 1 px border plus faint shadow), `md` (menus, popovers), `lg` (dialogs, toasts). Dark theme uses lighter surfaces instead of shadows.
- **Motion:** 150 ms hover and press · 200 ms menus and tooltips · 250 ms dialogs and drawers · exits about 30% faster than entries; ease-out, no overshoot in the app. Animate only opacity and transform. With `prefers-reduced-motion`, everything snaps to the final state.
- **Layout:** 12-column grid; app shell = 240 px sidebar (64 px collapsed) + 56 px top bar; content max 1280 px; breakpoints 375 / 768 / 1024 / 1440.
- **Icons:** Lucide, 16 px in tables, 20 px in navigation, 1.5 px stroke; icon-only buttons always carry an `aria-label`.

## Component library

`packages/ui` is rebuilt as about 40 components on Radix UI primitives (focus, keyboard and ARIA handled correctly) styled with the tokens above, plus `class-variance-authority` for variants. Every interactive component ships default, hover, focus-visible, active, disabled and loading states, in both themes.

| Group | Components | Key variants and states |
| --- | --- | --- |
| Foundations | ThemeProvider, ThemeToggle, Icon, VisuallyHidden, Container, Stack, Grid | light / dark / system |
| Actions | Button, IconButton, ButtonGroup, Link | primary, secondary, ghost, outline, destructive; sm / md / lg; loading spinner keeps the button's width |
| Forms | Field (label, hint, error), Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, DatePicker, FileDrop | invalid, disabled, read-only; error text under the field, linked with `aria-describedby` |
| Data display | Table (sortable, sticky header, row selection), DataList, Badge, StatusPill, Avatar, KPI Card, ScoreBar, ScoreRing, Timeline, Code / Mono | StatusPill covers every application state from INVITED to DECIDED; ScoreBar = number + bar + band label |
| AI-specific | AIMarker, AIMessage, ModelComparison, DisagreementBadge, ReviewFlag | Violet for AI-authored; warning for disagreement and human review |
| Feedback | Toast, Alert, Banner, Skeleton, Spinner, Progress, EmptyState, ErrorState | info / success / warning / danger; skeletons sized like the real content (no layout shift) |
| Overlays | Dialog, ConfirmDialog, Drawer (Sheet), Popover, Tooltip, DropdownMenu, CommandPalette (⌘K) | Focus trapped, Esc closes, focus returns to the trigger |
| Navigation | AppShell, Sidebar, Topbar, Breadcrumbs, Tabs, Pagination, Stepper, OrgSwitcher | Sidebar collapses to icons at 1024 px and to a drawer below 768 px |
| Conversation | ChatThread, ChatBubble (AI / candidate), Composer, TypingIndicator, StreamingText | Enter sends, Shift+Enter adds a line, IME-safe; a visible send button for touch |

Each component gets a small demo route (`/_ui` in the dashboard, dev only) so all states can be checked in both themes before pages are built.

## Screen-by-screen spec

There are 20 screens in total: 14 in the HR dashboard (4 of them new), 4 candidate-portal states, and the marketing home page with its shared chrome. Routes stay where they are, so existing links keep working.

### HR dashboard

| Screen | Route | Layout and key interactions |
| --- | --- | --- |
| Sign in **(rebuilt)** | `/sign-in` | Split screen: form left, product proof right (score preview, "AI never overrides a human"). Inline errors; password show/hide. |
| Sign up **(new)** | `/sign-up` | Name, work email, password with strength hint; leads straight into onboarding. |
| Create organization **(new)** | `/onboarding` | 3-step Stepper: organization name → invite teammates (skippable) → "create your first pipeline" call to action. |
| Dashboard | `/dashboard` | KPI row (open jobs, interviews in progress, awaiting decision, flagged for review); "Needs your attention" list sorted by urgency; recent AI activity with AI markers; quick actions. |
| Jobs | `/jobs` | Table with status filter tabs (Draft / Published / Closed), search, a pipeline-version column, row menu. Empty state teaches the job → pipeline link. |
| Job detail | `/jobs/[id]` | Header with status and Publish action (ConfirmDialog explains the version freeze); tabs Overview / Candidates / Settings; "Invite candidate" drawer that returns a copyable link. |
| Pipelines | `/pipelines` | Cards showing stage count, question count, latest published version and draft-changes badge. |
| Pipeline builder | `/pipelines/[id]` | Three panes: stage list (drag to reorder) · question editor (TEXT / MCQ, rubric criteria with weights) · live preview of the candidate view. "Publish version" shows a diff against the last version; published versions are read-only with a version switcher. |
| Applications | `/applications` | Dense table: candidate, job, status pill, overall score bar, AI decision, review flag. Filters, saved views, bulk actions. |
| Application review | `/applications/[id]` | Left: transcript with AI/candidate bubbles. Right, sticky: overall score, per-question ScoreBars with criterion breakdown, ModelComparison with DisagreementBadge, AI decision card, and an override form (reason required, previous outcome shown). |
| Audit | `/audit` | Timeline grouped by day; filters for actor type (USER / AI / SYSTEM), action and date; AI rows show tool and capability metadata on expand. |
| Team **(new)** | `/settings/team` | Members table with role select and remove; invite dialog; role-permission matrix for reference. |
| Settings **(new)** | `/settings` | Organization profile, theme preference, notification preferences. |
| Error and empty states | global | 404, 403 ("Your role can't open this" with the required capability named), offline, and an empty state for every list. |

### Candidate portal

| State | Layout and key interactions |
| --- | --- |
| Welcome | Job title, company, expected duration and number of stages, what the AI will and won't do, consent checkbox, "Start interview". |
| Interview | Single column, max 720 px; stage Stepper at the top; ChatThread with streaming AI text; composer pinned to the bottom (safe-area aware on mobile); autosave indicator; refresh restores everything. |
| Complete | Calm confirmation, what happens next and when; no scores shown. |
| Link problems | Expired, already completed, invalid or connection lost — each with plain-language copy and a recruiter-contact hint. |

### Marketing

| Page | Sections |
| --- | --- |
| Home | Hero (headline, two CTAs, product screenshot in the frosted-glass frame) → logos and proof → how it works (3 steps) → "human in the loop" differentiator → product tour (dashboard, review, interview) → security and audit → pricing → FAQ → final CTA → footer. |
| Shared chrome | Sticky navbar with blurred background, mobile menu, theme toggle; footer with product, company and legal columns. |

## 4-day plan

The work runs foundations first, then the recruiter flow, then review and the candidate interview, then marketing and polish. By the end of day 3 the whole README demo must run on the new UI, which leaves day 4 as buffer and polish rather than new risk.

| Day | Focus | Main work | End-of-day gate |
| --- | --- | --- | --- |
| 1 | Foundations | Tokens (light + dark), fonts, icons, shell, ~30 core components | Shell + components pass in both themes |
| 2 | Recruiter core | Auth + onboarding, Dashboard + Jobs, Pipeline builder | Demo steps 1–3 work on new UI |
| 3 | Review + candidate | Applications + review, Audit timeline, Candidate portal | **Full 5-min demo runs on new UI** |
| 4 | Marketing + polish | Marketing site, Team + Settings, A11y + QA sweep | Checklist green, ready to ship |

Day 3's gate is the one that matters: if it slips, Team and Settings move to a follow-up day and marketing ships with fewer sections.

### Day 1 — Foundations

- [ ] Create the `tokens.css` theme (light + dark), Tailwind 4 `@theme` mapping and ThemeProvider with a no-flash script.
- [ ] Load Plus Jakarta Sans and Fira Code through `next/font` in all three apps; add Lucide.
- [ ] Build foundations, actions, forms, feedback and overlay components (about 30) with all states, on Radix.
- [ ] Build AppShell, Sidebar, Topbar, Breadcrumbs, OrgSwitcher and CommandPalette.
- [ ] Add the `/_ui` demo route and check every component in both themes with the keyboard.
- [ ] Remove the old `.panel` / `.chip` CSS and the per-app colour variables.

**End-of-day check:** the empty shell renders in both themes at all 4 breakpoints, with no hex values in app code.

### Day 2 — Recruiter core

- [ ] Sign in, sign up and the 3-step onboarding (create organization, invite teammates, first-pipeline CTA).
- [ ] Dashboard: KPI cards, "Needs your attention" list, AI activity feed.
- [ ] Table, Tabs, Pagination, StatusPill and EmptyState components, driven by the Jobs screens.
- [ ] Jobs list and job detail, with the Publish confirm dialog and the Invite drawer that returns a copyable link.
- [ ] Pipelines list and the three-pane builder (stages, question and rubric editor, live preview, publish diff).

**End-of-day check:** demo steps 1–3 (sign up, build and publish a pipeline, publish a job and invite) work on the new UI; `run_collection.py` still passes 56/56.

### Day 3 — Review and candidate experience

- [ ] Data-display and AI components: ScoreBar, ScoreRing, ModelComparison, DisagreementBadge, AIMarker, Timeline.
- [ ] Applications table with filters and bulk actions.
- [ ] Application review: transcript, sticky score panel, model comparison, decision card and override form.
- [ ] Audit timeline with actor-type filters and expandable AI metadata.
- [ ] Candidate portal: welcome, interview chat (streaming, IME-safe composer, resume on refresh), complete, and link-problem states.

**End-of-day check:** the full 5-minute README demo runs end to end on the new UI, on desktop and on a 375 px phone for the candidate.

### Day 4 — Marketing and polish

- [ ] Marketing home: navbar, hero with frosted product frame, how it works, differentiator, product tour, security, pricing, FAQ, CTA, footer.
- [ ] Team and Settings screens; 403, 404 and offline pages.
- [ ] Accessibility sweep: keyboard pass on every screen, screen-reader labels, contrast spot checks in both themes.
- [ ] Performance pass: Lighthouse on every page, fix CLS and image sizes, check bundle size.
- [ ] Update `docs/frontend.md` (empty today) with the design system and component usage; record before/after screenshots.

**End-of-day check:** every screen passes the quality checklist below, and the Docker stack builds and runs cleanly.

## Quality bar, risks and open decisions

No screen counts as done until it passes the checklist below in both themes. Run the checklist at the end of each day, not only on day 4.

**Per-screen checklist** (from the UI/UX Pro Max pre-delivery list)

- [ ] Contrast: text 4.5:1, UI controls and focus rings 3:1, in light and dark.
- [ ] The keyboard reaches every action in a logical order; focus is always visible; dialogs trap and return focus.
- [ ] Touch targets are at least 44 × 44 px on mobile, with 8 px between them.
- [ ] Works at 375 / 768 / 1024 / 1440 px with no horizontal page scroll; wide tables scroll inside their own container.
- [ ] Loading, empty, error and success states are designed, not default.
- [ ] No emoji or glyph icons; icon-only buttons have labels.
- [ ] `prefers-reduced-motion` respected; only opacity and transform animate.
- [ ] No hex values or one-off classes in app code — tokens and `@repo/ui` only.
- [ ] Lighthouse accessibility 95+, CLS under 0.1, fonts via `next/font`.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 4 days is tight for 20 screens plus about 40 components | Day 4 polish gets squeezed | Components are built only as screens need them; Team and Settings are the first to cut, to a follow-up day |
| Rewriting pages breaks working flows | The demo chain fails | Run `infra/postman/run_collection.py` (API) and a manual walkthrough of the README demo at the end of each day |
| New screens need data the API lacks (sign-up flow, team, settings) | Screens without data | Use Better Auth's existing organization endpoints first; anything missing ships as UI with an empty state and is logged |
| Streaming interviewer text needs an endpoint change | Candidate sees a spinner | The ai-service already exposes `/chat/stream`; fall back to a typing indicator if the portal can't use it |

**Open decisions**

- [ ] Should a RECRUITER be able to open the review screen? Today it returns 403 because the role lacks `interview:evaluate` (see [walkthrough.md](walkthrough.md)). The review screen design assumes yes.
- [ ] Brand name, logo and wordmark: keep "Intervue AI" with a new wordmark, or rebrand?
- [ ] Pricing content on the marketing page: real tiers, or placeholder?
- [ ] Is mobile support required for the HR dashboard, or desktop-first with a read-only mobile view?
