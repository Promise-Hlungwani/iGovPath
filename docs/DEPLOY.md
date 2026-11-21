# Deploying iGovPath to Vercel

iGovPath deploys as **one Vercel project with two services**, set up by `vercel.json` at the repo root:

| Service | Folder | What it is |
|---|---|---|
| `web` | `apps/web` | The website people use. All public traffic goes here. |
| `ai` | `services/ai` | The AI helper (Python): reads PDFs and CVs, talks to Groq. **It has no public address.** Only the website can reach it, through a private link (a "binding") that Vercel sets up. |

> Vercel deploys what is on GitHub. Commit and push your latest changes before you start.

---

## Step 1: import the repo

1. Go to **vercel.com → Add New… → Project** and pick the **iGovPath** GitHub repo.
2. Vercel reads `vercel.json` and shows the two services, **web** and **ai**. Don't change the Root Directory; leave it at the repo root.

## Step 2: add the keys

Open **Environment Variables** and add these. Copy the values from your `.env` unless shown otherwise. Both services share them.

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon direct connection string |
| `DATABASE_URL_POOLED` | your Neon pooled connection string (has `-pooler`) |
| `BETTER_AUTH_SECRET` | from `.env` |
| `BETTER_AUTH_URL` | your website's address, e.g. `https://igovpath.vercel.app` |
| `APP_URL` | the same address as above |
| `ADMIN_EMAIL` | your email (becomes the admin when it signs up) |
| `OFFICER_CODE` | from `.env` |
| `AI_SERVICE_KEY` | from `.env` (the password between the website and the AI helper) |
| `LLM_PROVIDER` | `groq` |
| `GROQ_API_KEY` | your Groq key (starts with `gsk_`) |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `SAMPLE_DATA_ONLY` | `true` |

**Don't add `AI_SERVICE_URL`.** Vercel fills it in automatically for the website.

Don't know the website's address yet? Vercel shows it after the first deploy. Put it into `BETTER_AUTH_URL` and `APP_URL`, then use **Deployments → ⋯ → Redeploy**.

## Step 3: deploy and check

1. Click **Deploy** and wait for both services to finish.
2. Open your website address. The home page and **Find opportunities** should show the jobs.
3. **Sign up** with your `ADMIN_EMAIL`. You are the admin.
4. Open a job and press **Application checklist**. If the checklist appears, the website is talking to the AI helper.
5. In a private window, sign up as a test officer, go to **Account → Government officer?**, and enter the officer code.

## Good to know

- **Same database:** the live site uses the same Neon database as your laptop, so jobs and accounts are shared.
- **Database changes:** when the code adds new tables, run `pnpm db:migrate` on your laptop once. The live site picks them up straight away.
- **Upload size:** PDFs and CVs must be under 4 MB. For a whole vacancy circular, upload only your department's annexure pages.
- **Keys:** keep them only in Vercel's settings and your own `.env`. Never put them in GitHub.
- **Changing a key later:** edit it in Vercel, then **Redeploy**.
- **If the build fails**, open the failed deployment's **Build Logs** and send me the error.
