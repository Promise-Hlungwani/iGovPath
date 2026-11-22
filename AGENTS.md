# AGENTS.md: rules for AI coding assistants working on iGovPath

This is the single source of rules for every AI assistant on this repo (Claude Code, Codex, Cursor, Copilot, Gemini and others). Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/igovpath.mdc`) point here. **If they disagree, this file wins.** Change rules here first.

## What we are building

iGovPath: one place for South African government job and learnership applications.
- **Applicant app:** search posts and learnerships, a checklist per application, plain-language explanations, saved posts and reminders.
- **Government portal:** officers upload circulars, adverts, forms and amendments; AI extracts a structured record; **a named officer approves it** before it goes live.

Hackathon demo on **26–27 November 2026**. The full plan is in [`PLAN.md`](PLAN.md); setup is in [`README.md`](README.md).

## How to work

1. **The backlog is the source of truth:** `PLAN.md` §12 lists goals G1–G20 in build order. Work on the first goal whose box is not ticked, unless a person asks for something else.
2. **Finish a goal properly:** implement the tasks, then **run** every "done when" check (start the app, call the endpoint, click through the flow). Reading the code is not verification.
3. **Tick the box** in `PLAN.md` only when every "done when" line passed. If something could not be checked, say so and leave it unticked.
4. **Never commit or push.** The project owner makes every commit and push. Leave changes uncommitted and say what changed, unless the owner explicitly asks you to commit or push. The app must still start after your changes.
5. **Ask a person** when a goal depends on a 👤 input (see the "Human inputs" table in §12) or when a decision isn't covered by `PLAN.md`. Don't invent sample data, labels or translations a person is meant to supply.
6. Keep `PLAN.md`, `README.md` and `.env.example` up to date when a decision, command or variable changes.

## Non-negotiable rules

### Privacy and data (POPIA)
- **Applications hold personal information** (Z83 answers including ID numbers, CVs, ID copies). Only the applicant and officers of that post's department (and admins) may see them; ID numbers are masked in lists; nothing from an application is ever sent to an AI model; deleting an account deletes its applications and documents. Listings and uploaded adverts remain public documents. Every record shows its source document and date and is labelled as copied from a public circular. No notice bars, and no "demo" or "hackathon" wording in the product UI (team decision, 21 Nov 2026). `SAMPLE_DATA_ONLY` still blocks non-sample data from reaching the AI.
- **AI never ranks, scores, shortlists or rejects applicants** (POPIA s71). Matching says "looks like a fit" / "you may be missing X". Never "eligible", never a numeric score shown about a person.
- Dashboards show aggregated, anonymised counts only: no names, emails or IDs.
- Never send anything to an LLM that is not sample data, with one exception: a CV the person uploaded on "What can I apply for?", only after they tick consent and `services/ai/cv.py` has removed name, ID, contact details and address. CV files are never stored and CV calls are never cached.

### AI behaviour
- **AI proposes, an officer approves.** No AI output reaches applicants without officer approval.
- **Never invent** a date, office, salary, reference number or document. If the source doesn't say it, the value is `null` and the UI says *"not stated in the advert"*.
- Every extracted field carries an **evidence quote**, and code checks that the quote exists in the source text. Failed fields are blanked and flagged; they never pass silently.
- Every LLM output is validated against a schema (Pydantic in `services/ai`, Zod in `apps/web`) before use.
- Use the prompts in `PLAN.md` §5 and the proposal as written; store them in `services/ai/prompts/`. Change them deliberately and note why.
- Standard checklist items (current Z83, CV, certified ID copy, quote the reference number) are added **in code**, not by the LLM.
- Plain-language output keeps every fact, number and date unchanged. Non-English output shows a "machine translation, needs native-speaker review" banner.

### Security and secrets
- **This repo is public.** Secrets live only in `.env`, which is git-ignored. Never commit `.env`, keys, connection strings or passwords; never print them in logs, tests or error messages.
- When adding a variable, add it to `.env.example` with a placeholder and a comment saying where to get it, and to the README variables table.
- Before every commit, check the diff for keys (`gsk_`, `sk-or-`, `npg_`, `postgresql://user:password@`).
- Role checks happen on the **server** (middleware and server actions), never only in the UI. Officers act only on their own department's records. `/admin/*` is admin only.

### Audit
- Every create, update, approve, reject and role change writes an `audit_log` row with who (user and department), what (before and after) and when.

## Stack and conventions

| Area | Choice |
|---|---|
| Web | Next.js (App Router, TypeScript strict) in `apps/web`, Tailwind, shadcn/ui, pnpm |
| Database | Neon Postgres + pgvector, Drizzle ORM. Migrations use `DATABASE_URL` (direct); the app uses `DATABASE_URL_POOLED` |
| Auth | Better Auth, email + password, no email verification for now. Roles in `user_roles`: applicant / officer (pending → active) / admin (`ADMIN_EMAIL`) |
| AI service | Python FastAPI in `services/ai`: PyMuPDF (+ Tesseract), Pydantic |
| LLM | OpenAI-compatible client; provider from `LLM_PROVIDER` (groq / openrouter / ollama). Default Groq `openai/gpt-oss-120b` |

Conventions:
- TypeScript: no `any` without a comment explaining why; server-only code stays out of client components.
- Python: type hints, Pydantic models for every request, response and LLM output.
- Keep it simple: no new library or service without a reason noted in the commit or `PLAN.md`. Hackathon scope: no microservices beyond the two above.
- UI text in plain English (about grade 8); dates shown as `5 December 2026`.
- One uniform style on every page (team decision, 22 Nov 2026): literal white background, black text and primary buttons, greys for secondary text, a few see-through surfaces (header, chips). The logo cyan is the interaction colour: links, active nav and filter pills, focus rings, count badges (`--interactive` #0e7490, darkened from the logo #28b8dc for readable text). Closing dates and status badges use green (open), amber (under 7 days), red (under 48 hours, withdrawn) and grey (closed). No other colours. Corners: 8px buttons and inputs, 16px cards, round only for chips and badges. Headings get their weight from extra-bold type, not size. Tokens live in `apps/web/src/app/globals.css`; use them, never raw colours. Never use the SITA logo or present the site as SITA's own.
- Every click must show feedback: links trigger the top progress bar, forms use `SubmitButton` (pending text), and each route group has a `loading.tsx` skeleton.

## LLM usage limits (free tier)

Groq's free tier is roughly 30 requests a minute, 1,000 a day and 6–12K tokens a minute, shared by the whole team.
- Don't call the LLM in loops during development without pacing; batch scripts must wait between calls.
- Cache extraction results; never re-extract the same document hash twice.
- Retry HTTP 429 with backoff, then fail with a clear message.
- Tests use recorded fixtures and mocks, not live LLM calls, except a small marked smoke test.

## Commands

```bash
cp .env.example .env              # first time only, then fill in the values
pnpm install && pnpm bootstrap    # first time only: Python venv, tables, sample data
pnpm dev                          # AI service (:8000) + web app (:3000) together
pnpm dev:web / pnpm ai            # just one of them
pnpm lint && pnpm typecheck
pnpm test:ai                      # Python unit tests (no live LLM calls)
pnpm test:e2e                     # Playwright browser tests (both services running)
pnpm demo:reset                   # clean demo state + demo accounts
```

Schema changes: edit `apps/web/src/db/schema.ts`, then `pnpm --filter web db:generate` and `pnpm db:migrate`.

## Git

- **AI assistants never run `git commit` or `git push` in this repo.** The owner does all commits and pushes. Only do it when the owner explicitly asks in the conversation. Read-only commands (`git status`, `git diff`, `git log`) are fine.
- Never commit `.env`, uploaded documents in `data/uploads/`, or generated build output.
