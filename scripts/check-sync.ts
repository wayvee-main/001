// Backend freshness check: is every scheduled sync still actually running?
//
// Reads public.sync_status (latest run per job — see
// supabase/migrations/20260725030000_citycue_sync_runs.sql) and fails when a
// job's last run failed or is older than the cadence its workflow promises.
// Exits non-zero so it can be wired to CI or run by hand before a release.
//
// Deliberately uses the publishable key, not the service role: sync_status is
// world-readable so checking on the pipeline never requires handling a secret.
//
// Run: npm run backend:health
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to check backend health.');
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

/** Hours after which a job's last successful run is too old to trust. Each
 * budget is its workflow's cadence plus room for one missed run — a single
 * skipped nightly sync is a blip, two in a row is a broken pipeline. */
const MAX_AGE_HOURS: Record<string, number> = {
  weather: 3, // hourly
  events: 50, // daily
  ticketmaster: 50, // daily
  places: 15 * 24, // weekly
  viator: 15 * 24, // weekly
};

interface StatusRow {
  job: string;
  status: string;
  rows_written: number;
  rows_pruned: number;
  duration_ms: number;
  finished_at: string;
}

function ageHours(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 3_600_000;
}

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function main() {
  const { data, error } = await client.from('sync_status').select('*');
  if (error) {
    console.error('could not read sync_status:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as StatusRow[];
  const byJob = new Map(rows.map((row) => [row.job, row]));
  let problems = 0;

  for (const job of Object.keys(MAX_AGE_HOURS)) {
    const row = byJob.get(job);
    if (!row) {
      // A job that has never run at all is the loudest possible signal — either
      // the workflow has never fired or its secrets were never set.
      console.error(`FAIL  ${job.padEnd(13)} no run recorded`);
      problems += 1;
      continue;
    }

    const hours = ageHours(row.finished_at);
    const stale = hours > MAX_AGE_HOURS[job];
    const failed = row.status === 'failed';
    const line = `${job.padEnd(13)} ${row.status.padEnd(8)} ${String(row.rows_written).padStart(4)} rows  ${ageLabel(hours)}`;

    if (failed || stale) {
      console.error(`FAIL  ${line}${stale ? `  (budget ${MAX_AGE_HOURS[job]}h)` : ''}`);
      problems += 1;
    } else {
      // A `partial` run wrote real rows but knew it fell short — worth seeing,
      // not worth failing a check over.
      console.log(`${row.status === 'partial' ? 'WARN' : 'ok  '}  ${line}`);
    }
  }

  // Concierge cost/latency — informational only, never fails this check.
  // Answers TODO.md's "track cost-per-plan weekly" and "measure real Edge
  // Function response latency" from the durable log
  // supabase/functions/concierge/index.ts writes to concierge_runs, instead
  // of those staying one-off things someone has to remember to check.
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data: runs } = await client.from('concierge_runs').select('outcome, duration_ms, total_tokens').gte('created_at', since);
  if (runs?.length) {
    const ok = (runs as { outcome: string; duration_ms: number; total_tokens: number | null }[]).filter((r) => r.outcome === 'ok');
    const avgMs = ok.length ? Math.round(ok.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / ok.length) : 0;
    const avgTokens = ok.length ? Math.round(ok.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0) / ok.length) : 0;
    console.log(`\nconcierge (last 7d): ${runs.length} calls, ${ok.length} ok, avg ${avgMs}ms, avg ${avgTokens} tokens/plan`);
  } else {
    console.log('\nconcierge (last 7d): no runs recorded yet.');
  }

  if (problems) {
    console.error(`\n${problems} sync job(s) need attention.`);
    process.exit(1);
  }
  console.log('\nall sync jobs fresh.');
}

void main();
