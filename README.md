# iGovPath
iGovPath is a single platform that helps South Africans find government jobs and learnerships, understand requirements in plain language, and manage applications in one place. AI transforms government vacancy documents into structured information, application checklists, and easy-to-understand guidance while departments publish and update opportunities through a central portal.

- **Applicant app**: one search across national and provincial posts and learnerships, a checklist per application, plain-language explanations, deadlines and reminders.
- **Government portal**: departments upload circulars, adverts, forms and amendments once; AI extracts a structured record; **a named official approves it** before it goes live.

> **Principle:** AI proposes, a responsible official approves. The system never invents a deadline, office or document. If the source does not say it, the answer is *"not stated in the advert"*.

Hackathon: **26–27 November 2026**. Prepared by SPH.NC. Full implementation plan: [`PLAN.md`](PLAN.md).

> ⚠️ **Sample data only.** Every record in the demo comes from public circulars (DPSA PSVC) and is labelled *sample*. No real applicant data is used or sent to any AI service.

---

## Tech stack (all free tiers)

| Layer | Choice | Free limits (checked 21 Nov 2026) |
|---|---|---|
| Web app (applicant + officer portal) | Next.js, React, Tailwind | — |
| Database | **Neon**: hosted Postgres + pgvector | 1 GB storage/project, 100 compute-hours/month, no inactivity pause |
| LLM (primary) | **Groq**: hosted open models (gpt-oss-120b, Apache 2.0) | ~30 req/min, ~1,000 req/day, ~6–12K tokens/min on large models; resets 00:00 UTC |
| LLM (backup, optional) | **OpenRouter** `:free` models | 20 req/min, 50 req/day (1,000/day after a one-off $10 credit) |
| LLM (offline fallback, optional) | **Ollama** on a laptop, Qwen 2.5 7B (Apache 2.0) | No limits; needs ~16 GB RAM |
| Document intake | PyMuPDF (+ Tesseract for scans), Python FastAPI | — |
| Guardrails | Pydantic schema + rule checks + evidence check + officer approval | — |
| Accounts and login | **Better Auth** (open source), users stored in Neon | Free; no extra service |

### Who can do what

| Role | How they get in | Can do |
|---|---|---|
| **Applicant** | Signs up, gets access straight away | Search, save posts, checklists, reminders |
| **Officer** | Signs up and requests officer access for a department; **pending** until an admin approves | Upload, review and approve records for their own department only |
| **Admin** | The account whose email matches `ADMIN_EMAIL` | Approve or reject officers, assign departments, deactivate users (`/admin/users`) |

Every approval is recorded in the audit log with the officer's real name and department.

Groq's tokens-per-minute cap is the tightest limit, so the 10–20 sample adverts are **pre-extracted and saved**; only the amendment is extracted live in the demo.

---

## Accounts and environment setup

### Accounts to create

| # | Account | Required? | Who | Used for |
|---|---|---|---|---|
| 1 | **GitHub** (access to this repo) | ✅ Required | Every team member | Code |
| 2 | **Groq**: https://console.groq.com | ✅ Required | One person (limits are per account, so one shared key) | Primary LLM |
| 3 | **Neon**: https://console.neon.tech | ✅ Required | One person, then invite the team | Database |
| 4 | **OpenRouter**: https://openrouter.ai | Optional | One person | Backup LLM if Groq limits are hit |
| 5 | **Ollama**: https://ollama.com/download | Optional (no account, just install) | Demo laptop | Offline fallback |

No Hugging Face or Cerebras account is needed: their free tiers were removed in 2026.

### Step 1: create your `.env`

```bash
cp .env.example .env          # .env is git-ignored; never commit it
openssl rand -base64 32       # paste the output into BETTER_AUTH_SECRET
```

### Step 2: fill in each value

| Variable | Where to get it | Command / action |
|---|---|---|
| `DATABASE_URL` | Neon console → **New project** (name `igovpath`, region closest to SA, e.g. AWS Frankfurt `eu-central-1`) → **Connect** → **Connection pooling OFF** → copy | Paste into `.env` |
| `DATABASE_URL_POOLED` | Same **Connect** dialog → **Connection pooling ON** → copy (host contains `-pooler`) | Paste into `.env` |
| `GROQ_API_KEY` | https://console.groq.com/keys → **Create API Key** (starts `gsk_`). It is shown only once | Paste into `.env` |
| `GROQ_MODEL` | https://console.groq.com/docs/models: confirm the model id still exists | Default `openai/gpt-oss-120b` (Apache 2.0); alternative `qwen/qwen3.8-27b` |
| `OPENROUTER_API_KEY` *(optional)* | https://openrouter.ai/settings/keys → **Create Key** (starts `sk-or-`) | Paste into `.env` |
| `OPENROUTER_MODEL` *(optional)* | https://openrouter.ai/models?q=free: pick a current `:free` model | Paste the id |
| `OLLAMA_*` *(optional)* | Install Ollama, then pull the models | `ollama pull qwen2.5:7b-instruct` and `ollama pull bge-m3` |
| `BETTER_AUTH_SECRET` | Generate locally; it signs login sessions | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The app's address | `http://localhost:3000` locally; the live URL when deployed |
| `ADMIN_EMAIL` | The email of the person who will manage users (approve officers) | Type it into `.env`, then sign up with that email |
| `APP_URL`, `AI_SERVICE_URL`, `SAMPLE_DATA_ONLY`, `LLM_PROVIDER` | Defaults are fine | Leave as is |

**Sharing keys with the team:** send them privately (password manager or direct message), never in the repo, issues or public group chats.

### Step 3: check everything works

Load the variables into your shell first:

```bash
set -a; source .env; set +a
```

**Groq key works and the model exists:**
```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | grep -o '"id":"[^"]*"'
```

**Groq can answer:**
```bash
curl -s https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" \
  -d "{\"model\":\"$GROQ_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}]}"
```

**Neon connects and pgvector is enabled** (needs `psql`: `brew install libpq && brew link --force libpq`):
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$DATABASE_URL" -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

**OpenRouter (optional):**
```bash
curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

**Ollama (optional):**
```bash
curl -s http://localhost:11434/api/tags
```

**See your real rate limits** after signing up: https://console.groq.com/settings/limits

---

## Running the project

First time (needs Node 20+, pnpm and Python 3.12):

```bash
pnpm install && pnpm bootstrap   # dependencies, Python venv, database tables and sample data
```

On Windows, install Python 3.12 and reopen your terminal before running `pnpm bootstrap`.

Every time, one command starts everything (AI service + web app; Ctrl+C stops both):

```bash
pnpm dev                     # web app http://localhost:3000 (applicant) · /portal (officer) · /admin/users (admin)
                             # AI service http://localhost:8000/health
```

To run only one part: `pnpm dev:web` or `pnpm ai`.

For a fast, production-like run (pages are pre-built, so clicks are much quicker than in `pnpm dev`): `pnpm prod`.

Sign up with the `ADMIN_EMAIL` address first to become admin. Officers sign up, request access on their account page, and an admin approves them.

### Useful commands

| Command | What it does |
|---|---|
| `pnpm demo:reset` | Clean demo state + demo accounts (see `docs/DEMO.md`) |
| `pnpm db:reset` | Clear content (keeps users and the audit log) and re-seed |
| `pnpm test:ai` | AI service unit tests (no live AI calls) |
| `pnpm test:e2e` | Browser tests for every goal (needs both services running; uses the live Groq key) |
| `pnpm lint` / `pnpm typecheck` | Code checks |
| `services/ai/.venv/bin/python -I scripts/build_samples.py` | Re-extract the sample adverts through the AI pipeline |
| `services/ai/.venv/bin/python -I scripts/eval_extraction.py` | Accuracy against the hand-labelled set in `data/eval/` |

### What's where

| Path | Contents |
|---|---|
| `apps/web` | Next.js app: applicant pages, officer portal, admin, server actions, Drizzle schema (`src/db`) |
| `services/ai` | FastAPI: PDF intake, circular splitter, extraction guardrails, checklist, explainer, draft check, assistant; prompts in `prompts/` |
| `data/sources` | Public source PDFs (PSVC 39 and 42 of 2026, Z83) and small demo excerpts |
| `data/sample` | The 18 sample opportunities chosen for the demo and their pipeline extractions |
| `data/eval` | Accuracy test set to be labelled by people |
| `docs/DEMO.md` | The pitch script with exact clicks |

## Privacy and limits

- Sample public data only during the hackathon; no ID numbers, no real applicant data.
- AI never ranks, scores or rejects applicants (POPIA s71). Officers decide on every record.
- Every record shows its source document and date.
- Production would use self-hosted models and hosting agreed with **SITA** (first partner).
- Non-English explanations are machine-generated and need native-speaker review.
