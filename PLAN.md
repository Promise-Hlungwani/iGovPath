# iGovPath — Implementation Plan

> Source: *iGovPath – Final Proposal* (SPH.NC, revised 21 Nov 2026).
> Target: working demo for the hackathon on **26–27 November 2026**.
> Principle carried through every part of the build: **AI proposes, a named official approves.** The system never invents a deadline, office, salary or document. If the source does not say it, the answer is "not stated in the advert".

---

## 1. What we are building (hackathon scope)

The proposal's build plan (section 7) fixes the demo scope. Everything below is sized to fit it.

| # | Deliverable (from proposal) | Demo "done" means |
|---|---|---|
| D1 | Applicant search + checklist over 10–20 real public adverts/learnerships, labelled **"sample"** | Search by keyword/province/qualification, open a post, see closing date, reference, route, latest amendment, and a generated checklist |
| D2 | Officer portal: upload → review AI record next to source → approve → publish | Officer uploads a PDF, sees extracted fields with evidence quotes highlighted in the source, edits, approves; post goes live |
| D3 | Applicant view updates when an amendment is published | Use the real **PSVC 42 amendment** to a circular 39 post (Eastern Cape Social Development); the saved post shows "Amended" and the changed fields |
| D4 | Plain-language explainer in English + one more language | Side-by-side: original wording vs grade-8 explanation; second language flagged "needs native-speaker review" |
| D5 | One-page accuracy result from a test set | Field-level extraction accuracy on hand-labelled adverts, reported honestly |

**Out of scope for the hackathon** (stated in the pitch as "next"): real applicant data, ID numbers, e-Recruitment integration, form pre-fill onto official forms, voice input, production hosting, POPIA sign-off.

---

## 2. Architecture

```
                ┌────────────────────────── Next.js web app ──────────────────────────┐
                │  Applicant app (/)            Officer portal (/portal)               │
                │  search · post · checklist    upload · review · approve · forms lib  │
                │  explainer · saved · remind   dashboard · audit log                  │
                └──────────────┬───────────────────────────────┬──────────────────────┘
                               │ server actions / route handlers│
                       ┌───────▼────────┐              ┌────────▼─────────┐
                       │ Neon (hosted)  │◄────────────►│ ai-service       │
                       │ Postgres +     │   records    │ (Python FastAPI) │
                       │ pgvector       │              │ PyMuPDF/Tesseract│
                       │ + Better Auth  │              │ Pydantic guards  │
                       │   users/roles  │              └────────┬─────────┘
                       └────────────────┘                       │ OpenAI-compatible API
                                                       ┌────────▼─────────┐
                                                       │ Groq (hosted)    │
                                                       │ gpt-oss-120b     │
                                                       │ fallback: Open-  │
                                                       │ Router / Ollama  │
                                                       └──────────────────┘
```

### Stack decisions (from the proposal's open-source table, narrowed to one choice each)

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 15 (App Router) + React + Tailwind + shadcn/ui** | Proposal names it; one app serves both applicant and officer sides |
| DB | **Neon** (hosted Postgres + pgvector, free tier: 1 GB), Drizzle ORM | Proposal names Postgres; nothing to run locally |
| Document intake | **PyMuPDF** (digital PDFs, keeps page + bbox), **Tesseract** fallback for scans | PSVC annexures are digital PDFs; OCR only as fallback |
| LLM | **Groq** free tier (gpt-oss-120b, Apache 2.0; ~1,000 req/day, ~6–12K tokens/min); backup **OpenRouter** `:free`; offline fallback **Qwen 2.5 7B via Ollama** | Hosted, no GPU needed; sample data only (proposal 5c). Alternative on Groq: qwen/qwen3.8-27b |
| Search | Postgres full-text search + rule matching; **bge-m3** embeddings via Ollama only if time allows | Hugging Face free inference credits were removed in Oct 2026 |
| Guardrails | **Pydantic** schemas + rule checks + evidence-substring check + human approval queue | Proposal section 5 |
| Accounts and login | **Better Auth** (open source, **email + password**; no email verification or password reset for the hackathon — add Resend later), users and sessions stored in Neon; roles: applicant / officer / admin | "A named official approves" and "who and when" in the audit log need real accounts, not a shared password |
| Runtime | `pnpm dev` (web) + `uvicorn` (ai-service); database and LLM are hosted | Nothing heavy to install; works on any laptop |

All three LLM options speak the same OpenAI-compatible API, so switching Groq → OpenRouter → Ollama is a change of `LLM_PROVIDER` in `.env`. Hosted models receive **sample data only** (proposal 5c).

---

## 3. Repository layout

```
iGovPath/
├── PLAN.md                     ← this file
├── .env.example                variable template (real values in git-ignored .env)
├── apps/
│   └── web/                    Next.js app
│       ├── app/(applicant)/    /, /search, /posts/[id], /saved, /explain/[id]
│       ├── app/(auth)/         /sign-up, /sign-in, /request-officer-access
│       ├── app/portal/         /portal, /portal/upload, /portal/review/[id],
│       │                       /portal/forms, /portal/dashboard, /portal/audit
│       ├── app/admin/          /admin/users (approve officers, assign departments)
│       ├── lib/auth.ts         Better Auth config + role checks (middleware)
│       ├── db/schema.ts        Drizzle schema
│       ├── db/seed.ts          loads data/sample/*
│       └── lib/                ai client, checklist, matching, audit helpers
├── services/
│   └── ai/                     FastAPI
│       ├── intake.py           PDF → text blocks with page/bbox
│       ├── extract.py          Prompt 1 + Pydantic validation
│       ├── explain.py          Prompt 2
│       ├── checklist.py        Prompt 3
│       ├── draft_check.py      Prompt 4 (optional)
│       ├── rules.py            date / reference / evidence checks
│       └── prompts/*.txt       prompts verbatim from proposal §5
├── data/
│   ├── sources/                original public PDFs (PSVC 41, 42, annexures, Z83)
│   ├── sample/                 approved sample records (JSON) for seeding
│   └── eval/                   gold-labelled adverts + expected JSON
└── scripts/
    ├── eval_extraction.py      produces the D5 accuracy page
    └── split_psvc.py           splits a circular into one text chunk per advert
```

---

## 4. Data model (Postgres)

| Table | Key fields | Notes |
|---|---|---|
| `departments` | id, name, sphere (national/provincial), province, contact | Seed SITA + departments appearing in sample adverts |
| `user`, `session`, `account`, `verification` | Better Auth's own tables (name, email, password hash, sessions) | Created by Better Auth's migration |
| `user_roles` | user_id, role (applicant/officer/admin), department_id (officers only), status (active/pending/rejected/deactivated), approved_by, approved_at | Sign-up gives `applicant/active`; officer access starts `pending` until an admin approves. The `ADMIN_EMAIL` account becomes `admin` on first sign-up |
| `source_documents` | id, department_id, kind (circular/advert/form/amendment), file_path, sha256, uploaded_by, uploaded_at, page_count | Originals are never altered |
| `extractions` | id, source_document_id, chunk_ref, raw_json, validation_errors, evidence, status (draft/needs_fix/approved/rejected), reviewed_by, reviewed_at | AI output lives here until approved |
| `opportunities` | id, type (post/learnership/internship), department_id, post_title, reference_number, closing_date, salary, location, province, minimum_requirements[], documents_required[], form_required, apply_route{}, contact{}, conditional_items[], status (open/amended/extended/withdrawn/closed), is_sample, current_version, embedding vector(1024) | Only approved records reach here |
| `opportunity_versions` | opportunity_id, version, record_json, changed_fields[], amendment_source_id, approved_by, approved_at | Powers "Amended" badge + diff (D3) |
| `forms` | id, name, version, effective_date, owner (department_id or `CENTRAL`), official_url, status (current/superseded), superseded_by | Z83 = owner CENTRAL, read-only link to DPSA |
| `applicant_profiles` | id, user_id, qualifications[], licences[], province, languages[], is_sample | **No ID number** in the hackathon |
| `saved_opportunities` | profile_id, opportunity_id, checklist_state{}, reminder_at, status | Tracking + checklist ticks |
| `notifications` | profile_id, opportunity_id, kind (amended/closing_soon/form_superseded), created_at, read | In-app only for the demo |
| `audit_log` | id, actor_user_id, actor_department_id, action, entity, entity_id, before, after, at | Every change, who and when, including role approvals |
| `funnel_events` | anonymised session hash, opportunity_id, step, at | Dashboard drop-off (aggregated only) |

---

## 5. AI pipeline

### 5.1 Intake
1. Officer uploads PDF → stored in `data/uploads`, sha256 recorded.
2. PyMuPDF extracts text blocks with page number and bounding box. If a page has no text layer → Tesseract.
3. For a full PSVC, `split_psvc.py` segments by department annexure and by post (pattern: `POST xx/yy`, `REFERENCE`, `CLOSING DATE`). For a single advert, the whole text is one chunk.

### 5.2 Extraction (Prompt 1, verbatim from proposal)
- One LLM call per advert chunk, `temperature=0`, JSON mode.
- **Guardrails, in order** — failure moves the record to `needs_fix`, never silently passes:
  1. Pydantic schema validation (types, required keys, nulls allowed).
  2. **Evidence check:** every non-null field must have an `evidence` quote that is a (normalised-whitespace) substring of the source chunk. Fields whose quote isn't found are blanked and flagged.
  3. Rules: `closing_date` is ISO and on/after the circular date; reference number matches known patterns; email/URL well-formed; `form_required` mentioning Z83 is mapped to the central Z83 form record.
  4. Retry once with the validation errors fed back; then hand to the officer as-is with flags.
- Officer review screen shows each field, its evidence quote, and the quote highlighted on the rendered PDF page.

### 5.3 Amendments (D3)
- Upload of an amendment notice → extraction in "amendment mode": identify target post by reference number / title + department, and output only changed fields with evidence.
- Officer confirms the match and the diff → new `opportunity_versions` row → status `amended`/`extended`/`withdrawn` → `notifications` for everyone who saved the post.

### 5.4 Checklist (Prompt 3)
- Input: approved record only + applicant answers. Output validated as `[{group, item, source}]`.
- Deterministic "standard rules" (current Z83, CV, certified ID copy, quote the reference number) are added in code, not by the LLM, so they can never be missed.
- SAQA rule: if the record has a foreign-qualification condition, show "at application" vs "only if shortlisted" exactly as the advert says, else "check the advert".

### 5.5 Plain language + translation (Prompt 2, D4)
- English explainer + **one** additional language (human to choose — see §9). Original text always beside it; non-English output carries a "machine translation — needs native-speaker review" banner.

### 5.6 Matching
- Hybrid: hard filters (province, open status, closing date ≥ today) + rule match on qualifications/licences against `minimum_requirements` + pgvector similarity on bge-m3 embeddings.
- Output is "looks like a fit / you may be missing X", with links to source text. **Never** "eligible", never a score shown as a ranking of the person (POPIA s71).

### 5.7 Assistant (stretch)
- Answers only from approved records (retrieval over `opportunities`); anything else → "I don't know — contact {department contact}".

### 5.8 Drafting check (Prompt 4, optional)
- Officer pastes a draft advert → list of missing mandatory items + suggested plain wording. No values invented.

---

## 6. Screens

**Access rules**
- Anyone can search and read posts without an account.
- Saving posts, checklists, reminders and notifications need an applicant account.
- `/portal/*` needs an **active officer** account, and an officer only sees and approves records for their own department.
- `/admin/*` needs an admin account.

**Accounts**
1. Sign up / sign in (email + password).
2. Request officer access: choose department, give job title; status shows "pending" until approved.
3. Admin → Users: list of pending officer requests (approve / reject), all users with role and department, deactivate.

**Applicant**
1. Home/search — keyword, province, type filters; "SAMPLE DATA" banner on every page.
2. Post detail — key facts, apply route, status badge (Open / Amended / Extended / Withdrawn), version history, source link + date.
3. Checklist — grouped, tickable, each item tagged "from advert" / "standard rule".
4. Explain — original vs plain language, language switcher.
5. Saved & reminders — list of saved posts, closing countdown, notification on amendment.
6. "What can I apply for?" — tiny profile form (matric, licence, province) → matches with reasons (proposal's Limpopo example).

**Officer portal**
1. Upload — drag PDF, choose kind, department.
2. Review queue — drafts with validation flags.
3. Review screen — PDF on the left with evidence highlights, editable fields on the right, Approve / Reject; the signed-in officer's name and department are recorded automatically.
4. Forms library — versioned forms; Z83 shown as central/read-only.
5. Dashboard — aggregated funnel (viewed → checklist started → checklist complete) per post, flagged conflicting records.
6. Audit log.

---

## 7. Timeline

Today is **Sat 21 Nov**; the event is **Thu 26 – Fri 27 Nov**. ✅ The rules allow building before the event, so the whole product is built **21–25 Nov** and the event days are for hardening, rehearsal and the pitch.

| When | Phase | Output |
|---|---|---|
| Sat 21 Nov | **0. Setup** ✅ | Plan, README, env template; Groq + Neon accounts created and tested |
| Sat 21 – Sun 22 Nov | **1. Foundations** | Next.js app, database tables, Better Auth sign-up/sign-in, roles, officer request + admin approval page, seed sample records, search + post detail |
| Sun 22 – Mon 23 Nov | **2. AI extraction + officer review** | intake → extract → guardrails → review screen with evidence → approve → publish (D2); pre-extract the sample adverts through Groq and save them |
| Mon 23 – Tue 24 Nov | **3. Checklist + explain** | Prompt 3 + standard rules; Prompt 2 English + 1 language (D1, D4); saved posts + reminders |
| Tue 24 Nov | **4. Amendment story** | Amendment upload, diff, version history, notification on saved post (D3) |
| Wed 25 Nov | **5. Eval + extras** | Run `eval_extraction.py`, accuracy page (D5); matching with reasons; dashboard + audit log; forms library |
| Thu 26 Nov (event day 1) | **6. Harden** | Bug fixes, full demo run-throughs, create demo accounts, native-speaker check of the second language |
| Fri 27 Nov (event day 2) | **7. Pitch** | Freeze code, rehearse the 5-min flow ×3, record a backup demo video, pitch |

Human prep runs in parallel from today: source PDFs, sample adverts and the hand-labelled eval set are needed by **Mon 23 Nov** (phase 2) and **Wed 25 Nov** (phase 5).

Cut order if time runs short: assistant → drafting check → dashboard → matching (keep search) → second language (keep English). **Never cut**: officer approval, evidence quotes, amendment story, accuracy page, sign-in with roles (the admin users page can shrink to a plain approve/reject list).

---

## 8. Demo script (maps to the proposal's 5-minute pitch)

1. **30 s – problem:** the real PSVC 42 amendment to a circular 39 post — "if you read circular 39 alone, you apply with the wrong requirements."
2. **2 min – live demo:**
   signed-in officer (pre-made, already approved account) uploads the amendment PDF → AI extracts the changed fields with evidence quotes → officer approves, and their name appears in the audit log →
   switch to applicant who saved that post → "Amended" notification → updated checklist → plain-language explanation in English and the second language.
3. **1 min – AI + human:** show a field the AI left null ("not stated in the advert"), and a guardrail catching a bad date.
4. **1 min – privacy & limits:** no real data, self-hosted model, no ranking/scoring (POPIA s71), accuracy page with honest numbers, language quality caveat.
5. **30 s – the ask:** SITA as first partner, then national departments in gov.za order.

---

## 9. What is needed from humans

### 9.1 Decisions (blocking — please answer before Day 1)

| # | Decision | Default if no answer |
|---|---|---|
| H1 | ~~Product name~~ | ✅ Decided: iGovPath |
| H2 | ~~Hackathon rules~~ | ✅ Decided: building before the event is allowed |
| H3 | **Second demo language** (needs at least one native speaker to sanity-check output on the day) | isiZulu |
| H4 | ~~Hardware / LLM hosting~~ | ✅ Decided: hosted Groq (gpt-oss-120b) + Neon; any laptop works |
| H5 | **Team split:** who owns frontend, AI service, data/eval, pitch | — |
| H6 | Confirm Next.js + Python FastAPI + Postgres stack (vs. all-TypeScript) | As in §2 |
| H7 | ~~Login method~~ | ✅ Decided: email + password via Better Auth, no email verification for now |
| H8 | **Optional $10 OpenRouter credit** as LLM backup (1,000 req/day instead of 50) | No; Ollama on a laptop as offline backup |

### 9.2 Tasks only a human can do

- [ ] **Collect source documents** (public, from links in the proposal's references): PSVC 41 and 42 of 2026 + annexures, PSVC 39 (the post the amendment changes), DPSA Circular 55 of 2026, Z83 PDF, the 2026 annexure E with the SAQA "when shortlisted" wording, 3–5 learnership adverts from SETA/department pages.
- [ ] **Choose the 10–20 sample opportunities**, covering: national + provincial, one learnership with matric + driver's licence in Limpopo (for the proposal's example), one with a SAQA condition, one with hand-delivery route, the amended post.
- [ ] **Hand-label the eval set:** for ~15 adverts, fill in the correct JSON per Prompt 1's schema (template will be provided in `data/eval/`). This is the ground truth for the accuracy page — it must be done by a person, not the model.
- [ ] **Native-speaker review** of the second-language explanations (at least 3 posts) before the pitch.
- [ ] **Verify model licences** on the exact model card being demoed (gpt-oss-120b on Groq; Qwen if used) — proposal 5a flags this as not re-verified.
- [ ] **Re-check learnership details** the day before the pitch (proposal: they change often).
- [ ] **Set `ADMIN_EMAIL`** in `.env` and sign up with it first, so that account becomes admin.
- [ ] **Create the demo accounts** before the pitch: one officer (sign up, request access for the demo department, approve it as admin) and one applicant with a saved post. Use real team names, not "test".
- [ ] **Play the "officer"** in the demo and approve records; the audit log shows their real name.
- [ ] **Pitch prep:** slides, rehearsal, a recorded backup video in case Wi-Fi/laptop fails.

### 9.3 Open items to raise with SITA / after the hackathon (proposal §8)

- How iGovPath relates to e-Recruitment: integrate, feed it, or run alongside.
- Which forms may be pre-filled vs must be completed on the official form.
- Launch languages and native-speaker testers.
- Who owns POPIA review/sign-off; who is the registered Information Officer.
- Production hosting with SITA; s72 cross-border position.
- Confirm with DPSA the "form is prescribed centrally" wording for the Z83.
- Event name (still TBD).

### 9.4 Accounts / access

- ✅ **Groq** (LLM) and ✅ **Neon** (database): created and tested 21 Nov 2026.
- **GitHub** repo access for every team member.
- Optional: **OpenRouter** (backup LLM), **Ollama** installed on one laptop (offline backup), **Resend** (only if email verification is added later).
- Keys are shared privately (password manager), never committed; the repo is public. Turn on GitHub secret scanning + push protection.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Groq rate limit hit or model removed | Pre-extract the seed set; live-extract only the one amendment; switch `LLM_PROVIDER` to OpenRouter or Ollama; keep `qwen/qwen3.8-27b` as second Groq model |
| No internet at the venue | Phone hotspot; Ollama offline fallback; recorded backup video |
| PSVC layout varies, splitting fails | Manually cut the 10–20 chunks in prep; splitter is a nice-to-have |
| Model hallucinates a field | Evidence-substring check blanks it; officer review; demo shows this happening |
| Weak isiZulu/other-language output | Banner + native-speaker review; keep English as the guaranteed path |
| Stale learnership data | "Sample — as of <date>" on every record; re-check day before |
| Demo failure on stage | Recorded backup video; seeded DB snapshot |
| Login breaks or is slow on stage | Demo accounts created and signed in beforehand; seed script can also create them |
| Someone signs up and claims to be an officer | Officer access is pending until an admin approves it; applicants can never reach `/portal` |

---

## 11. Definition of done for the hackathon

- [ ] From a clean checkout, `cp .env.example .env` + filling the keys + `pnpm dev` and `uvicorn` brings the whole demo up.
- [ ] 10–20 sample opportunities searchable, each labelled "sample" with source + date.
- [ ] Users can sign up; officer access is pending until an admin approves it; officers only act on their own department.
- [ ] Officer can upload → review with evidence → approve → publish, and the approval is in the audit log with their name.
- [ ] PSVC 42 amendment flows through to a saved post with notification and diff.
- [ ] Checklist and plain-language explainer work in English + one language.
- [ ] Accuracy page generated from the hand-labelled eval set.
- [ ] No real personal data anywhere; no AI scoring/ranking of applicants.

---

## 12. Implementation backlog (goals to build, in order)

How to use this section: work top to bottom. Each goal has an **owner**, the **tasks**, and a **done when** test. A goal is finished only when every "done when" line is true and checked by running it, not by reading the code. Tick the box when done.

**Owners:** 🤖 = Claude builds it · 👤 = a person on the team · 🤝 = Claude prepares, a person checks or decides.

**Ground rules for every goal**
- Sample public data only; never real applicant data or ID numbers.
- AI never ranks, scores or rejects applicants. Every AI output goes through validation and officer approval.
- Secrets only in `.env`; never commit it. Update `.env.example` when a variable is added.
- Every change to a record writes an `audit_log` row (who, what, when).
- Small commits per goal; the app must still start after each commit.

### Phase 1: Foundations

- [x] **G1. Project scaffold** 🤖
  - Tasks: Next.js (App Router, TypeScript) in `apps/web` with Tailwind + shadcn/ui; pnpm workspace; Python FastAPI skeleton in `services/ai` with `requirements.txt`; shared env loading; `pnpm dev` and `uvicorn` scripts; lint + typecheck.
  - Also: read `SAMPLE_DATA_ONLY` from env; while `true`, show the "SAMPLE DATA" banner on every page, label every record *sample*, and hide any ID-number or other real-personal-data fields.
  - Change (21 Nov, team decision): the banner was removed from the UI; records are labelled "From public circular". `SAMPLE_DATA_ONLY` still gates the AI and the upload form.
  - Done when: `pnpm dev` serves a home page with the "SAMPLE DATA" banner; `GET localhost:8000/health` returns ok; `pnpm lint` and `pnpm typecheck` pass. With `SAMPLE_DATA_ONLY=true` no form asks for an ID number.

- [x] **G2. Database schema and migrations** 🤖
  - Tasks: Drizzle schema for every table in §4; migrations run against Neon using `DATABASE_URL`; app uses `DATABASE_URL_POOLED`; pgvector enabled; Postgres full-text index on opportunities.
  - Done when: `pnpm db:migrate` creates all tables on a fresh Neon branch; running it twice changes nothing.

- [x] **G3. Accounts, roles and user management** 🤖
  - Tasks: Better Auth email + password (no verification); `user_roles` table; sign-up → applicant/active; "request officer access" (department + job title) → officer/pending; first sign-up with `ADMIN_EMAIL` → admin; `/admin/users` approve / reject / deactivate / assign department; middleware guarding `/portal/*` (active officer) and `/admin/*` (admin); officers limited to their own department's records; role changes written to `audit_log`.
  - Done when: an applicant cannot open `/portal` (redirected); a pending officer sees "awaiting approval"; after admin approval the officer can open `/portal`; an officer from department A cannot see or approve department B's records; the admin's approval appears in the audit log with names.

- [x] **G4. Seed data and search** 🤝
  - Tasks: 🤖 `pnpm db:seed` loads departments (SITA + those in the sample), the central Z83 form record, and approved sample opportunities from `data/sample/*.json`; search page (keyword, province, type, open only); post detail page (facts, apply route, status badge, source link + date, "sample" label). 👤 supplies or approves the sample list (see §9.2).
  - Done when: seeding a fresh database gives 10–20 searchable opportunities; searching "clerk" + a province returns the expected posts; every post shows its source document and date.

### Phase 2: AI extraction and officer review

- [x] **G5. LLM client with provider switch** 🤖
  - Tasks: one OpenAI-compatible client in `services/ai` reading `LLM_PROVIDER` (groq / openrouter / ollama); retries with backoff on rate limits (HTTP 429); logs token usage; never sends anything not marked sample.
  - Also: while `SAMPLE_DATA_ONLY=true`, the client refuses (with a clear error) any payload not marked sample, before it leaves the server.
  - Done when: a non-sample payload is refused while the switch is on; the same test prompt succeeds with `LLM_PROVIDER=groq`; changing the variable switches provider with no code change; a forced 429 is retried and then reported clearly.

- [x] **G6. Document intake** 🤖
  - Tasks: upload endpoint stores the PDF, records sha256 and page count; PyMuPDF text blocks with page + position; Tesseract fallback for pages with no text; `split_psvc.py` splits a circular into per-post chunks.
  - Done when: uploading PSVC 42 produces text blocks with page numbers; the splitter finds the posts in at least one annexure, matched against a manual count.

- [x] **G7. Extraction with guardrails** 🤖
  - Tasks: Prompt 1 verbatim; Pydantic schema; evidence check (each quote must exist in the source text, otherwise the field is blanked and flagged); rule checks (ISO dates, closing date after circular date, reference format, URLs/emails, Z83 mapped to the central form); one retry with errors fed back; result stored as an `extractions` row with status.
  - Done when: on 3 real adverts every non-null field has a quote that exists in the source; a deliberately wrong quote is caught and blanked; a missing salary comes back null ("not stated in the advert").

- [x] **G8. Officer review and publish** 🤖
  - Tasks: review queue (drafts with flags); review screen with the PDF page on the left, evidence highlighted, editable fields on the right; Approve / Reject recorded with the signed-in officer; approval creates or updates the `opportunities` row and an `opportunity_versions` row; audit log entry.
  - Done when: an officer uploads an advert, edits one field, approves it, and it appears in applicant search within seconds; the audit log shows the officer's name, department and the change.

- [x] **G9. Pre-extract the sample set** 🤝
  - Tasks: 🤖 batch script runs G7 over all sample adverts, paced under Groq's tokens-per-minute limit, saves results to `data/sample/`; 👤 reviews and approves them in the portal like a real officer.
  - Done when: all sample adverts exist as approved records extracted by the pipeline, not typed by hand.
  - Status (21 Nov): ✅ 18 adverts extracted by the pipeline (`scripts/build_samples.py`, 0 guardrail errors, 182/182 filled fields have an exact source quote) and approved by the seed script. ⏳ 👤 Still to do: a team member reviews each one in the portal.

### Phase 3: Applicant features

- [x] **G10. Checklist per post** 🤖
  - Tasks: Prompt 3 from the approved record only; standard rules added in code (current Z83, CV, certified ID copy, quote the reference number); SAQA wording "at application" / "only if shortlisted" / "check the advert"; each item tagged "from advert" or "standard rule"; tickable and saved for signed-in applicants.
  - Done when: every checklist contains the 4 standard items; the SAQA sample post shows the right timing; ticks persist after sign-out and sign-in.

- [ ] **G11. Plain-language explainer** 🤝
  - Tasks: 🤖 Prompt 2 in English and one other language; original wording beside it; "machine translation, needs native-speaker review" banner on non-English; facts, numbers and dates checked unchanged against the record. 👤 chooses the language (default isiZulu) and a native speaker reviews 3 posts.
  - Done when: explanations keep every date and number from the record (automatic check); the banner appears on non-English; the native speaker has signed off or listed fixes.
  - Status (21 Nov): ✅ 🤖 English + isiZulu built; automatic fact check passed on 5 posts × 2 languages; banner shows on isiZulu. ⏳ 👤 Native-speaker review still needed (default language isiZulu; change `LANGUAGES` in `apps/web/src/lib/generated.ts` if the team picks another).

- [x] **G12. Saved posts, reminders and notifications** 🤖
  - Tasks: save / unsave; list of saved posts with closing countdown; in-app reminder 3 days before closing; notification when a saved post is amended, extended or withdrawn, or its form is superseded.
  - Done when: saving a post that closes in 2 days shows a reminder; publishing an amendment to it creates a notification for that applicant.

- [x] **G13. "What can I apply for?" matching** 🤖
  - Change (21 Nov, team decision): replaced the rule-based form with **CV upload + AI matching** (simpler, AI-first). Personal details are removed in code before the AI reads the CV; the file is not stored; consent required; summary deletable. Tested in `e2e/cv-match.spec.ts`.
  - Tasks: small profile form (qualifications, licences, province); filters + rule match against minimum requirements; text search ranking (embeddings optional); output "looks like a fit" / "you may be missing X" with links to the source text; never says "eligible", never shows a score.
  - Done when: the proposal's example (matric + driver's licence, Limpopo) returns the expected sample posts with reasons; no screen contains the word "eligible" or a numeric score.

### Phase 4: Amendments

- [x] **G14. Amendment flow (the demo story)** 🤖
  - Tasks: upload an amendment notice → "amendment mode" extraction finds the target post (reference number or title + department) and only the changed fields, with evidence; officer confirms the match and the diff; new version; status becomes amended / extended / withdrawn; notifications sent (G12); post page shows "Amended" with a before/after diff and version history.
  - Done when: the real PSVC 42 amendment to the circular 39 post (Eastern Cape Social Development) updates that sample post end to end, and an applicant who saved it sees the notification and the new requirements.

### Phase 5: Evaluation and extras

- [ ] **G15. Accuracy page** 🤝
  - Tasks: 👤 hand-labels ~15 adverts in `data/eval/` (template provided by 🤖); 🤖 `scripts/eval_extraction.py` compares pipeline output with the labels per field and writes a one-page result shown at `/accuracy`.
  - Done when: the page shows per-field accuracy, how many fields were left null correctly, and how many evidence quotes failed, with the date of the run. Numbers are reported as they are, not adjusted.
  - Status (21 Nov): ✅ 🤖 15 templates in `data/eval/labels/` (PSVC 42 posts not in the demo sample), instructions in `data/eval/README.md`, `scripts/eval_extraction.py`, `/accuracy` page (shows "no result yet" until labels exist). Scoring checked with a temporary planted label, then removed. ⏳ 👤 Hand-label the 15 adverts, then run the script.

- [x] **G16. Forms library** 🤖
  - Tasks: versioned forms; officers upload new versions of forms their department owns; Z83 shown as central and read-only, linking to the DPSA source; superseded versions archived, and applicants who saved one are warned.
  - Done when: an officer cannot edit the Z83; uploading a new version of a department form archives the old one and notifies affected applicants.

- [x] **G17. Dashboard and audit log screens** 🤖
  - Tasks: anonymised funnel per post (viewed → checklist started → checklist complete), aggregated only; flag conflicting records (same reference, different closing dates); searchable audit log.
  - Done when: the dashboard shows counts with no names or emails; the audit log lists every approval and role change from earlier goals.

- [x] **G18. Drafting check (optional)** 🤖
  - Tasks: Prompt 4; officer pastes a draft advert and gets a list of missing mandatory items and plainer wording; no values invented.
  - Done when: a draft without a closing date or reference number is flagged for both.

- [x] **G19. Assistant (optional)** 🤖
  - Tasks: answers only from approved records; anything else → "I don't know, contact {department contact}".
  - Done when: asked about a post that isn't in the data, it says it doesn't know and gives the contact.

### Phase 6: Harden and pitch

- [ ] **G20. Demo readiness** 🤝
  - Tasks: 🤖 one command that resets the database to a clean demo state (seed + demo accounts); demo checklist in `docs/DEMO.md`; full end-to-end run with no errors in the browser console or server logs. 👤 creates the demo officer and applicant accounts with real team names, records the backup video and rehearses the pitch three times.
  - Done when: from a clean checkout, someone new on the team can follow the README and run the full demo script in §8 without help.
  - Status (21 Nov): ✅ 🤖 `pnpm demo:reset` (reset + demo accounts from `.env`), `docs/DEMO.md` (pitch script with exact clicks), README run guide, smoke test over every page with no console/server errors, all 9 browser tests + 23 unit tests passing, production build passing. ⏳ 👤 Set the demo accounts in `.env`, have a new teammate follow the README, record the backup video, rehearse three times.

### Human inputs the build depends on

| Needed for | Input | Owner | Needed by |
|---|---|---|---|
| G3 | `ADMIN_EMAIL` in `.env` | 👤 | Before G3 |
| G4, G9 | Source PDFs + list of 10–20 sample opportunities (§9.2). 🤖 can download the public PSVC files; 👤 confirms the selection | 🤝 | Sun 22 Nov |
| G11 | Second language + native-speaker reviewer | 👤 | Tue 24 Nov |
| G14 | Confirm the PSVC 42 amendment and the circular 39 post to use | 👤 | Tue 24 Nov |
| G15 | ~15 hand-labelled adverts | 👤 | Wed 25 Nov |
| G20 | Demo accounts, backup video, rehearsal | 👤 | Thu 26 Nov |
