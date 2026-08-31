# Agentic Email Generator

**Part of [AylinOS](https://github.com/aylineuyar-arch/aylinos)** — six live agents, one router.
**Live demos & case studies:** [aylin-uyar-portfolio.lovable.app](https://aylin-uyar-portfolio.lovable.app)

Daily job-hunting agent for AI Deployment / AI Strategy roles in NYC, SF, and London. Queries **JSearch** (RapidAPI → LinkedIn, Indeed, Glassdoor, ZipRecruiter) and **Firecrawl** (Built In, Wellfound, Ashby, LinkedIn, Jack & Jill), filters by title keywords, dedupes against a Postgres `seen_jobs` table, and emails an HTML digest via **Resend** at 8am ET.

Ships with two interchangeable implementations — pick one as the active source:

- **`lovable-version/`** — Lovable/Supabase `pg_cron` version (`cron-job-search.ts`, a TanStack Router server route)
- **`n8n/`** — n8n workflow for Railway (`ai-job-digest.workflow.json`)

See `n8n/README.md` for n8n/Railway setup details.

## What it does

1. Queries JSearch for target roles (`AI Deployment Strategist`, `AI Strategy Lead`, `AI Deployment Lead`) across NYC, SF, London
2. Queries Firecrawl across Built In, Wellfound, Ashby, LinkedIn, Jack & Jill
3. Filters results by title keyword match
4. Dedupes against a `seen_jobs` Postgres table so the same posting never gets sent twice
5. Sends a single HTML digest via Resend

## Stack

JSearch (RapidAPI) · Firecrawl · Postgres / Supabase · Resend · TanStack Router (Lovable) or n8n (Railway)
