# n8n / Railway Alternative — AI Job Digest

This folder contains an **alternative implementation** of the daily AI job-hunting agent that lives in `src/routes/api/public/cron-job-search.ts`. Same behavior, but runs entirely inside n8n on Railway — no Lovable deployment required.

Both versions ship together. Pick one as your active digest source (running both will send duplicate emails).

## What it does

Every day at **8 AM ET** it:

1. Queries **JSearch** (RapidAPI) for `AI Deployment Strategist`, `AI Strategy Lead`, `AI Deployment Lead` in NYC / SF / London
2. Queries **Firecrawl** across Built In, Wellfound, Ashby, LinkedIn
3. Filters results by title keywords
4. Dedupes against a Postgres `seen_jobs` table
5. Sends an HTML digest to `aylin.e.uyar@gmail.com` via **Resend**

## Setup on your Railway n8n

### 1. Import the workflow
- Open n8n → **Workflows → Import from File** → select `ai-job-digest.workflow.json`

### 2. Add environment variables in Railway
Set these on the n8n service:
- `RAPIDAPI_JSEARCH_KEY` — your RapidAPI JSearch key
- `FIRECRAWL_API_KEY` — your Firecrawl API key
- `RESEND_API_KEY` — your Resend API key

Restart the n8n container after adding them.

### 3. Configure Postgres credentials
The two Postgres nodes (`Check Seen Jobs`, `Insert seen_jobs`) need a credential. Two options:

**Option A — Use Railway Postgres** (fully independent)
Create a Postgres service on Railway, then run:
```sql
CREATE TABLE seen_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL UNIQUE,
  title text NOT NULL,
  company text,
  location text,
  source text NOT NULL,
  url text,
  posted_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now()
);
```

**Option B — Reuse the Lovable Cloud DB**
Connect to the same Postgres the Lovable version uses. The `seen_jobs` table already exists. Get the connection string from Lovable → Cloud → Database.

### 4. Activate the workflow
Toggle the workflow to **Active** in n8n. First run executes at the next 12:00 UTC (8 AM ET).

## Schedule

The cron expression `0 12 * * *` is UTC and corresponds to 8 AM Eastern Time (EST). During daylight saving (EDT) the email arrives at 7 AM local. Adjust to `0 13 * * *` if you want to lock 8 AM EDT instead.

## Switching between the two

- **Use Lovable version**: keep `pg_cron` schedule active (it already is). Disable the n8n workflow.
- **Use n8n version**: activate this workflow and unschedule the pg_cron job:
  ```sql
  SELECT cron.unschedule('daily-ai-job-search');
  ```
