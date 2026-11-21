# iGovPath — Implementation Plan

> Source: *iGovPath – Final Proposal* (Elime, revised 21 Nov 2026).
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
                       │ Postgres 16    │◄────────────►│ ai-service       │
                       │ + pgvector     │   records,   │ (Python FastAPI) │
                       │ (Drizzle ORM)  │   embeddings │ PyMuPDF/Tesseract│
                       └────────────────┘              │ Pydantic guards  │
                                                       └────────┬─────────┘
                                                                │ OpenAI-compatible API
                                                       ┌────────▼─────────┐
                                                       │ Ollama (local)   │
                                                       │ Qwen 2.5 7B/14B  │
                                                       │ bge-m3 embeddings│
                                                       └──────────────────┘
```

### Stack decisions (from the proposal's open-source table, narrowed to one choice each)

| Layer | Choice | Why |
|---|---|---|
| Web | **Next.js 15 (App Router) + React + Tailwind + shadcn/ui** | Proposal names it; one app serves both applicant and officer sides |
| DB | **Postgres 16 + pgvector**, Drizzle ORM | Proposal names it; vectors and records in one place |
| Document intake | **PyMuPDF** (digital PDFs, keeps page + bbox), **Tesseract** fallback for scans | PSVC annexures are digital PDFs; OCR only as fallback |
| LLM | **Qwen 2.5 (Apache 2.0) via Ollama**, 7B on a laptop, 14B if GPU available | Apache 2.0 is the safest licence for government (proposal 5a). Verify the exact model card before demo |
| Embeddings | **bge-m3** via Ollama | Multilingual, proposal names it |
| Guardrails | **Pydantic** schemas + rule checks + evidence-substring check + human approval queue | Proposal section 5 |
| Runtime | `docker compose` (postgres, ai-service, ollama) + `next dev` | One command to bring the demo up |

Using an OpenAI-compatible client against Ollama means we can swap to a hosted open model on demo day if the laptop is too slow — **sample data only** (proposal 5c).

---

## 3. Repository layout

```
iGovPath/
├── PLAN.md                     ← this file
├── docker-compose.yml          postgres+pgvector, ollama, ai-service
├── .env.example
├── apps/
│   └── web/                    Next.js app
│       ├── app/(applicant)/    /, /search, /posts/[id], /saved, /explain/[id]
│       ├── app/portal/         /portal, /portal/upload, /portal/review/[id],
│       │                       /portal/forms, /portal/dashboard, /portal/audit
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
| `officers` | id, name, department_id, role | Named official — shown on every approval |
| `source_documents` | id, department_id, kind (circular/advert/form/amendment), file_path, sha256, uploaded_by, uploaded_at, page_count | Originals are never altered |
| `extractions` | id, source_document_id, chunk_ref, raw_json, validation_errors, evidence, status (draft/needs_fix/approved/rejected), reviewed_by, reviewed_at | AI output lives here until approved |
| `opportunities` | id, type (post/learnership/internship), department_id, post_title, reference_number, closing_date, salary, location, province, minimum_requirements[], documents_required[], form_required, apply_route{}, contact{}, conditional_items[], status (open/amended/extended/withdrawn/closed), is_sample, current_version, embedding vector(1024) | Only approved records reach here |
| `opportunity_versions` | opportunity_id, version, record_json, changed_fields[], amendment_source_id, approved_by, approved_at | Powers "Amended" badge + diff (D3) |
| `forms` | id, name, version, effective_date, owner (department_id or `CENTRAL`), official_url, status (current/superseded), superseded_by | Z83 = owner CENTRAL, read-only link to DPSA |
| `applicant_profiles` | id, qualifications[], licences[], province, languages[], is_sample | **No ID number** in the hackathon |
| `saved_opportunities` | profile_id, opportunity_id, checklist_state{}, reminder_at, status | Tracking + checklist ticks |
| `notifications` | profile_id, opportunity_id, kind (amended/closing_soon/form_superseded), created_at, read | In-app only for the demo |
| `audit_log` | id, actor, action, entity, entity_id, before, after, at | Every change, who and when |
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
3. Review screen — PDF on the left with evidence highlights, editable fields on the right, Approve / Reject with officer name.
4. Forms library — versioned forms; Z83 shown as central/read-only.
5. Dashboard — aggregated funnel (viewed → checklist started → checklist complete) per post, flagged conflicting records.
6. Audit log.

---

## 7. Timeline

Today is **Sat 21 Nov**; the event is **Thu 26 – Fri 27 Nov**. ⚠️ Whether code may be written before the event depends on the hackathon rules (see §9). The plan below assumes prep (data, prompts, eval set) is allowed beforehand and coding happens at the event; if pre-building is allowed, Phases 1–3 move earlier.

| When | Phase | Output |
|---|---|---|
| 21–23 Nov | **0. Prep** | Download PSVC 41/42 + annexures + Z83 into `data/sources`; pick 10–20 adverts/learnerships; hand-label 15 for the eval set; pull Qwen 2.5 + bge-m3 in Ollama and test Prompt 1 on 3 adverts |
| 24–25 Nov | **0b. Dry run** (if allowed) | Scaffold repo, docker-compose, schema, seed; confirm laptop can run the model at acceptable speed, else arrange hosted fallback |
| Day 1 AM | **1. Foundations** | Next.js app, Postgres schema, seed sample records, search + post detail |
| Day 1 PM | **2. AI extraction + officer review** | intake → extract → guardrails → review screen → approve → publish (D2) |
| Day 1 eve | **3. Checklist + explain** | Prompt 3 + standard rules; Prompt 2 English + 1 language (D1, D4) |
| Day 2 AM | **4. Amendment story** | Amendment upload, diff, version history, notification on saved post (D3) |
| Day 2 midday | **5. Eval + polish** | Run `eval_extraction.py`, build the accuracy page (D5); matching with reasons; dashboard + audit log |
| Day 2 PM | **6. Pitch** | Freeze code, rehearse 5-min flow ×3, record a backup demo video |

Cut order if time runs short: assistant → drafting check → dashboard → matching (keep search) → second language (keep English). **Never cut**: officer approval, evidence quotes, amendment story, accuracy page.

---

## 8. Demo script (maps to the proposal's 5-minute pitch)

1. **30 s – problem:** the real PSVC 42 amendment to a circular 39 post — "if you read circular 39 alone, you apply with the wrong requirements."
2. **2 min – live demo:**
   officer uploads the amendment PDF → AI extracts the changed fields with evidence quotes → officer (named) approves →
   switch to applicant who saved that post → "Amended" notification → updated checklist → plain-language explanation in English and the second language.
3. **1 min – AI + human:** show a field the AI left null ("not stated in the advert"), and a guardrail catching a bad date.
4. **1 min – privacy & limits:** no real data, self-hosted model, no ranking/scoring (POPIA s71), accuracy page with honest numbers, language quality caveat.
5. **30 s – the ask:** SITA as first partner, then national departments in gov.za order.

---

## 9. What is needed from humans

### 9.1 Decisions (blocking — please answer before Day 1)

| # | Decision | Default if no answer |
|---|---|---|
| H1 | **Product name:** README says *Mzansi Connect*, proposal says *iGovPath*. Which one goes on screen? | iGovPath |
| H2 | **Hackathon rules:** may we write code before 26 Nov, or only prep data/prompts? | Prep only; code at event |
| H3 | **Second demo language** (needs at least one native speaker to sanity-check output on the day) | isiZulu |
| H4 | **Hardware:** which laptop runs the demo? GPU / RAM? Or approve a hosted open-model endpoint (sample data only) | Qwen 2.5 7B on laptop, hosted fallback |
| H5 | **Team split:** who owns frontend, AI service, data/eval, pitch | — |
| H6 | Confirm Next.js + Python FastAPI + Postgres stack (vs. all-TypeScript) | As in §2 |

### 9.2 Tasks only a human can do

- [ ] **Collect source documents** (public, from links in the proposal's references): PSVC 41 and 42 of 2026 + annexures, PSVC 39 (the post the amendment changes), DPSA Circular 55 of 2026, Z83 PDF, the 2026 annexure E with the SAQA "when shortlisted" wording, 3–5 learnership adverts from SETA/department pages.
- [ ] **Choose the 10–20 sample opportunities**, covering: national + provincial, one learnership with matric + driver's licence in Limpopo (for the proposal's example), one with a SAQA condition, one with hand-delivery route, the amended post.
- [ ] **Hand-label the eval set:** for ~15 adverts, fill in the correct JSON per Prompt 1's schema (template will be provided in `data/eval/`). This is the ground truth for the accuracy page — it must be done by a person, not the model.
- [ ] **Native-speaker review** of the second-language explanations (at least 3 posts) before the pitch.
- [ ] **Verify model licences** on the exact model card being demoed (Qwen 2.5 size chosen; bge-m3) — proposal 5a flags this as not re-verified.
- [ ] **Re-check learnership details** the day before the pitch (proposal: they change often).
- [ ] **Play the "officer"** in the demo and approve records — and the review screen should show their real name.
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

- None required for the core demo (everything runs locally).
- Optional: GitHub repo access for all team members; a hosted GPU/open-model endpoint if H4 needs a fallback.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Local model too slow / poor JSON | Pre-extract the seed set offline; live-extract only the one amendment in the demo; hosted open-model fallback |
| PSVC layout varies, splitting fails | Manually cut the 10–20 chunks in prep; splitter is a nice-to-have |
| Model hallucinates a field | Evidence-substring check blanks it; officer review; demo shows this happening |
| Weak isiZulu/other-language output | Banner + native-speaker review; keep English as the guaranteed path |
| Stale learnership data | "Sample — as of <date>" on every record; re-check day before |
| Demo failure on stage | Recorded backup video; seeded DB snapshot |

---

## 11. Definition of done for the hackathon

- [ ] `docker compose up` + `pnpm dev` brings the whole demo up from a clean checkout.
- [ ] 10–20 sample opportunities searchable, each labelled "sample" with source + date.
- [ ] Officer can upload → review with evidence → approve → publish, and the approval is in the audit log with their name.
- [ ] PSVC 42 amendment flows through to a saved post with notification and diff.
- [ ] Checklist and plain-language explainer work in English + one language.
- [ ] Accuracy page generated from the hand-labelled eval set.
- [ ] No real personal data anywhere; no AI scoring/ranking of applicants.
