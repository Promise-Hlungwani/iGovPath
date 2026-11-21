# Deploying iGovPath to Vercel

iGovPath is **two Vercel projects made from the same GitHub repo**:

| Vercel project | Root Directory | What it is |
|---|---|---|
| `igovpath-ai` | `services/ai` | The AI helper (Python). Reads PDFs and CVs, talks to Groq. |
| `igovpath` | `apps/web` | The website people use. |

Deploy the **AI helper first**, because the website needs its address.

> Vercel deploys what is on GitHub. Commit and push your latest changes before you start.

---

## Step 1: the AI helper

1. Go to **vercel.com → Add New… → Project** and pick the **iGovPath** GitHub repo.
2. **Project Name:** `igovpath-ai`
3. **Root Directory:** click **Edit** and choose `services/ai`.
4. **Framework Preset:** `Other`. Leave the build and output settings empty.
5. Open **Environment Variables** and add these (copy the values from your `.env`):

   | Name | Value |
   |---|---|
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | your Groq key (starts with `gsk_`) |
   | `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `AI_SERVICE_KEY` | the long random value from your `.env` |
   | `SAMPLE_DATA_ONLY` | `true` |

6. Click **Deploy**.
7. When it finishes, copy its address, for example `https://igovpath-ai.vercel.app`.
8. Check it: open `https://igovpath-ai.vercel.app/health`. You should see `"status":"ok"` and `"llm_key_set":true`.

## Step 2: the website

1. **Add New… → Project** again, and pick the **same** iGovPath repo.
2. **Project Name:** `igovpath`
3. **Root Directory:** `apps/web`. Vercel detects **Next.js** by itself.
4. **Environment Variables** (values from your `.env` unless shown):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon direct connection string |
   | `DATABASE_URL_POOLED` | your Neon pooled connection string (has `-pooler`) |
   | `BETTER_AUTH_SECRET` | from `.env` |
   | `BETTER_AUTH_URL` | `https://igovpath.vercel.app` (your website's address) |
   | `APP_URL` | the same address as above |
   | `ADMIN_EMAIL` | your email (becomes the admin when it signs up) |
   | `OFFICER_CODE` | from `.env` |
   | `AI_SERVICE_URL` | the AI helper's address from Step 1, e.g. `https://igovpath-ai.vercel.app` |
   | `AI_SERVICE_KEY` | the **same** value you gave the AI helper |
   | `SAMPLE_DATA_ONLY` | `true` |

   Don't know the website's address yet? Vercel shows it after the first deploy. Put it into `BETTER_AUTH_URL` and `APP_URL`, then use **Deployments → ⋯ → Redeploy**.

5. Click **Deploy**.

## Step 3: check it works

1. Open your website address. The home page and **Find opportunities** should show the jobs.
2. **Sign up** with your `ADMIN_EMAIL`. You are the admin.
3. Open a job and press **Application checklist**. If the checklist appears, the website is talking to the AI helper.
4. In a private window, sign up as a test officer, go to **Account → Government officer?**, and enter the officer code.

## Good to know

- **Same database:** the live site uses the same Neon database as your laptop, so the jobs and accounts you see locally are the same ones online.
- **Database changes:** when the code adds new tables, run `pnpm db:migrate` on your laptop once. The live site picks them up straight away.
- **Upload size:** PDFs and CVs must be under 4 MB on Vercel. For a whole vacancy circular, upload only your department's annexure pages.
- **Time limit:** AI steps are allowed up to 60 seconds each.
- **Keys:** keep them only in Vercel's settings and your own `.env`. Never put them in GitHub.
- **Changing a key later:** edit it in Vercel, then **Redeploy** that project.
