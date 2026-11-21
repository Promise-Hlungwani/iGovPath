# iGovPath demo guide

Five-minute pitch flow from PLAN.md §8, with the exact clicks. Everything shown is **sample public data** from DPSA Public Service Vacancy Circulars 39 and 42 of 2026.

## Before the pitch (30 minutes before)

1. In `.env`, set the demo accounts (real team names, not "test"):
   `DEMO_PASSWORD`, `DEMO_OFFICER_NAME`, `DEMO_OFFICER_EMAIL`, `DEMO_APPLICANT_NAME`, `DEMO_APPLICANT_EMAIL`.
2. Start both services in two terminals:
   ```bash
   pnpm ai     # AI service on http://localhost:8000
   pnpm dev    # web app on http://localhost:3000
   ```
3. Reset to a clean demo state and create the demo accounts:
   ```bash
   pnpm demo:reset
   ```
   - Officer: Eastern Cape Department of Social Development (owns the amended post).
   - Applicant: has saved the two posts that the amendment notice changes.
4. Warm the AI cache so nothing waits on stage: open, signed in as the applicant, the saved Social Development post → **Application checklist** and **Explain in plain language** (English and isiZulu).
5. Open two browser windows: one signed in as the **officer**, one (private window) as the **applicant**.
6. Have `data/sources/psvc-42-2026-amendments.pdf` ready to upload (the real amendments section of PSVC 42).
7. Check `http://localhost:8000/health` says `"llm_key_set": true`. Backup: the recorded video.

## The pitch

| Time | Show | Say |
|---|---|---|
| 0:00–0:30 | Applicant window: *Saved* → "Deputy Director: Employee Relations" (Eastern Cape Social Development, from Circular 39) | "This post was advertised on 30 October. On 20 November Circular 42 changed its requirements. If you read Circular 39 alone, you apply with the wrong qualification." |
| 0:30–1:30 | Officer window: **Upload** → choose the amendments PDF, *An amendment notice*, tick "public document" → **Upload and read** | "The department uploads the notice once. AI reads it and finds three amendments." |
| 1:30–2:00 | Click **Review** on `DSD 02/11/2026`: before/after diff, evidence quote highlighted in the source | "Every change carries the exact sentence it came from. AI proposes; a named official approves." |
| 2:00–2:15 | **Confirm and apply amendment** | "Approved by a named officer, recorded in the audit log." |
| 2:15–2:45 | Applicant window: refresh → **Notifications** (1) → open the post: *Amended*, version history with before/after | "Everyone who saved the post is told immediately." |
| 2:45–3:15 | **Application checklist** (rebuilt for version 2) → **Explain in plain language** → switch to isiZulu | "The checklist adds the standard rules in code: current Z83, CV, certified ID, the reference number. Plain language in their own language, original wording beside it." |
| 3:15–3:30 | Officer: show the Government Printing Works amendment → open it: refused, belongs to another department | "Departments can only change their own posts." |
| 3:30–4:00 | Officer: open any advert in the review queue (or Upload → `sample-advert-dws-42-282.pdf`) and point at a field the AI left empty: "Not stated in the advert" | "If the advert doesn't say it, we don't invent it." |
| 4:00–4:30 | `/accuracy` and `/portal/dashboard` | "Honest numbers from a hand-labelled test set; anonymous drop-off counts, no names. No AI scoring of people (POPIA s71). Self-hosted models with SITA for production." |
| 4:30–5:00 | — | The ask: SITA as first partner, then the national departments. |

## If something breaks

- **AI service down / Groq rate limit:** set `LLM_PROVIDER=openrouter` (needs `OPENROUTER_API_KEY`) or `ollama` in `.env`, restart `pnpm ai`. Cached answers keep working.
- **Amendment already applied (rehearsal ran it):** `pnpm demo:reset`.
- **No internet:** phone hotspot, or play the backup video.

## Other things worth showing if asked

- `/match`: "What can I apply for?" with matric + driver's licence in Limpopo (the proposal's example).
- `/assistant`: ask about a post that isn't listed; it says it doesn't know.
- `/portal/forms`: Z83 is read-only (prescribed centrally); department forms are versioned.
- `/admin/users`: approve an officer's access request.
- `/portal/audit`: every approval, with who and when.
