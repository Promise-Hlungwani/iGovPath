# Copilot instructions for iGovPath

The full rules are in `AGENTS.md` at the repo root, and it wins over this file. The build plan and goals (G1–G20) are in `PLAN.md` §12.

The non-negotiable rules, repeated here:
- **Sample public data only.** No real applicant data or ID numbers. Never send non-sample data to an LLM.
- **AI never ranks, scores, shortlists or rejects applicants** (POPIA s71). Never show "eligible" or a numeric score about a person.
- **AI proposes, an officer approves.** No AI output reaches applicants without approval.
- **Never invent** dates, offices, salaries, reference numbers or documents: use `null` and show "not stated in the advert". Every extracted field has an evidence quote that code checks against the source.
- Validate every LLM output against a schema (Pydantic / Zod).
- **The repo is public:** secrets only in `.env` (git-ignored). Add new variables to `.env.example` with a placeholder.
- Role checks on the server; officers act only on their own department; `/admin` is admin only.
- Every change writes an `audit_log` row (who, what, when).

Stack: Next.js (App Router, TypeScript strict) + Tailwind + shadcn/ui in `apps/web`; Drizzle + Neon Postgres + pgvector; Better Auth (email + password); Python FastAPI + PyMuPDF + Pydantic in `services/ai`; OpenAI-compatible LLM client selected by `LLM_PROVIDER` (default Groq `openai/gpt-oss-120b`).
