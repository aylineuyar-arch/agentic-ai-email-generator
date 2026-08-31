import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// ---------- Configuration ----------
const TITLE_KEYWORDS = [
  'ai deployment strategist',
  'ai deployment lead',
  'ai strategy',
  'ai strategist',
  'deployment strategist',
];
const LOCATIONS = ['New York', 'San Francisco', 'London'];
const RECIPIENT_EMAIL = 'aylin.e.uyar@gmail.com';

// ---------- Types ----------
interface Job {
  job_key: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string | null;
  posted_at: string | null;
  snippet?: string;
}

function titleMatches(title: string): boolean {
  const t = title.toLowerCase();
  return TITLE_KEYWORDS.some((k) => t.includes(k));
}

function makeKey(source: string, url: string | null, title: string, company: string | null) {
  return `${source}::${url || `${company || ''}::${title}`}`.toLowerCase().slice(0, 500);
}

// ---------- JSearch (RapidAPI) ----------
async function searchJSearch(): Promise<Job[]> {
  const key = process.env.RAPIDAPI_JSEARCH_KEY;
  if (!key) return [];
  const out: Job[] = [];
  for (const kw of ['AI Deployment Strategist', 'AI Strategy Lead', 'AI Deployment Lead']) {
    for (const loc of LOCATIONS) {
      try {
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(`${kw} in ${loc}`)}&page=1&num_pages=1&date_posted=week`;
        const res = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': key,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
        });
        if (!res.ok) {
          console.error('JSearch error', res.status, await res.text());
          continue;
        }
        const json: any = await res.json();
        for (const j of json.data || []) {
          if (!titleMatches(j.job_title || '')) continue;
          out.push({
            job_key: makeKey('jsearch', j.job_apply_link, j.job_title, j.employer_name),
            title: j.job_title,
            company: j.employer_name,
            location: [j.job_city, j.job_country].filter(Boolean).join(', '),
            source: j.job_publisher || 'JSearch',
            url: j.job_apply_link,
            posted_at: j.job_posted_at_datetime_utc,
          });
        }
      } catch (e) {
        console.error('JSearch fetch failed', e);
      }
    }
  }
  return out;
}

// ---------- Firecrawl search across job boards ----------
async function searchFirecrawl(): Promise<Job[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  const out: Job[] = [];
  const sites = [
    { source: 'Built In', site: 'builtin.com' },
    { source: 'Wellfound', site: 'wellfound.com' },
    { source: 'Jack & Jill', site: 'jackandjill.ai' },
    { source: 'Ashby', site: 'jobs.ashbyhq.com' },
    { source: 'LinkedIn', site: 'linkedin.com/jobs' },
  ];
  for (const { source, site } of sites) {
    for (const kw of ['"AI Deployment Strategist"', '"AI Strategy Lead"', '"AI Deployment Lead"']) {
      try {
        const res = await fetch('https://api.firecrawl.dev/v2/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${kw} site:${site} (New York OR San Francisco OR London)`,
            limit: 10,
            tbs: 'qdr:w',
          }),
        });
        if (!res.ok) {
          console.error('Firecrawl error', source, res.status, await res.text());
          continue;
        }
        const json: any = await res.json();
        const results = json.data?.web || json.data || [];
        for (const r of results) {
          const title = r.title || '';
          if (!titleMatches(title)) continue;
          out.push({
            job_key: makeKey(source, r.url, title, null),
            title,
            company: null,
            location: LOCATIONS.find((l) => (r.description || '').toLowerCase().includes(l.toLowerCase())) || null,
            source,
            url: r.url,
            posted_at: null,
            snippet: r.description,
          });
        }
      } catch (e) {
        console.error('Firecrawl fetch failed', source, e);
      }
    }
  }
  return out;
}

// ---------- Email via Resend (through Lovable connector gateway) ----------
async function sendDigest(jobs: Job[]): Promise<void> {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const RESEND = process.env.RESEND_API_KEY;
  if (!LOVABLE || !RESEND) throw new Error('Missing LOVABLE_API_KEY or RESEND_API_KEY');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const subject = jobs.length
    ? `🎯 ${jobs.length} new AI Strategy role${jobs.length === 1 ? '' : 's'} — ${today}`
    : `No new AI Strategy roles today — ${today}`;

  const bySource = jobs.reduce<Record<string, Job[]>>((acc, j) => {
    (acc[j.source] ||= []).push(j);
    return acc;
  }, {});

  const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 8px">Your daily AI Strategy job digest</h1>
  <p style="color:#666;margin:0 0 24px">${today} · ${jobs.length} new role${jobs.length === 1 ? '' : 's'} across NYC, SF, London</p>
  ${jobs.length === 0
    ? '<p style="padding:16px;background:#f5f5f5;border-radius:8px">No new matches today. Check back tomorrow.</p>'
    : Object.entries(bySource).map(([source, list]) => `
      <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:24px 0 8px">${source} (${list.length})</h2>
      ${list.map((j) => `
        <div style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;margin-bottom:10px">
          <a href="${j.url || '#'}" style="color:#111;text-decoration:none;font-weight:600;font-size:15px">${j.title}</a>
          <div style="color:#666;font-size:13px;margin-top:4px">${[j.company, j.location].filter(Boolean).join(' · ') || '—'}</div>
          ${j.snippet ? `<div style="color:#444;font-size:13px;margin-top:8px;line-height:1.4">${j.snippet.slice(0, 200)}…</div>` : ''}
        </div>
      `).join('')}
    `).join('')}
  <p style="color:#999;font-size:12px;margin-top:32px">Searched: JSearch (LinkedIn/Indeed/Glassdoor/ZipRecruiter), Built In, Wellfound, Jack&amp;Jill, Ashby, LinkedIn.</p>
</body></html>`;

  const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE}`,
      'X-Connection-Api-Key': RESEND,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'AI Job Agent <onboarding@resend.dev>',
      to: [RECIPIENT_EMAIL],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed [${res.status}]: ${await res.text()}`);
}

// ---------- Route ----------
async function runAgent() {
  const [jsearchJobs, firecrawlJobs] = await Promise.all([searchJSearch(), searchFirecrawl()]);
  const all = [...jsearchJobs, ...firecrawlJobs];

  // Dedupe within batch
  const uniq = new Map<string, Job>();
  for (const j of all) if (!uniq.has(j.job_key)) uniq.set(j.job_key, j);

  // Filter against DB
  const keys = [...uniq.keys()];
  let seen = new Set<string>();
  if (keys.length) {
    const { data } = await supabaseAdmin.from('seen_jobs').select('job_key').in('job_key', keys);
    seen = new Set((data || []).map((r) => r.job_key));
  }
  const fresh = [...uniq.values()].filter((j) => !seen.has(j.job_key));

  if (fresh.length) {
    await supabaseAdmin.from('seen_jobs').insert(
      fresh.map((j) => ({
        job_key: j.job_key,
        title: j.title,
        company: j.company,
        location: j.location,
        source: j.source,
        url: j.url,
        posted_at: j.posted_at,
      })),
    );
  }

  await sendDigest(fresh);
  return { total_found: all.length, unique: uniq.size, new: fresh.length };
}

export const Route = createFileRoute('/api/public/cron-job-search')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await runAgent();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          console.error('cron-job-search failed', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
      POST: async () => {
        try {
          const result = await runAgent();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e: any) {
          console.error('cron-job-search failed', e);
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
