// Live-parse evaluation set for the Ask concierge (docs/build-book.md Part
// 3.7) — 50 real guest sentences against the deployed Edge Function, target
// >=90% passing. Complements src/lib/__tests__/concierge.test.ts, which tests
// the deterministic adapter/guardrail layer with no network. This layer tests
// the one non-deterministic step: does the model actually parse intent into
// the fixed ConciergeRequest shape.
//
// Requires the function to be deployed (npm run functions:deploy) and:
//   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//
// Run: npm run eval:concierge
import { conciergeDeclined, parseConciergeRequest } from '../src/lib/concierge/request';
import type { ConciergeIntentKind } from '../src/lib/concierge/enums';
import type { ConciergeRequest } from '../src/lib/concierge/types';
import { tasteVocabulary } from '../src/lib/taste';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to run the concierge eval.');
  process.exit(1);
}

// The four gates from the design doc. Intent is separated out because a wrong
// intent sends a guest to the wrong page — far more visible than a slightly-off
// budget guess — and exclusions have no tolerance at all: telling someone
// "Not Thai" was applied when it wasn't is the kind of thing that ends trust.
const PASS_RATE_TARGET = 0.95;
const INTENT_ACCURACY_TARGET = 0.95;
const EXCLUSION_TARGET = 1;
const DECLINE_TARGET = 0.98;
const MAX_TOKENS_PER_ASK = 400;

// A modest gap between calls plus retry-with-backoff on 429 — cheap insurance
// against whatever the configured provider's rate limit turns out to be,
// without tuning the eval around one provider's specific ceiling.
const DELAY_BETWEEN_CALLS_MS = 150;
const RATE_LIMIT_RETRIES = 3;

type Outcome = string;

interface CallResult {
  request: ConciergeRequest | null;
  outcome: Outcome;
  /** From x-concierge-total-tokens — null when the provider didn't report it. */
  totalTokens: number | null;
}

/** Raw fetch rather than supabase-js: the client swallows response headers on a
 * 204, and the x-concierge-outcome header is the only thing that distinguishes
 * "the model declined" from "we ran out of tokens this minute". */
async function callConcierge(rawText: string, vocabulary: string[]): Promise<CallResult> {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(`${url}/functions/v1/concierge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, moodVocabulary: vocabulary }),
    });

    const outcome = response.headers.get('x-concierge-outcome') ?? `http_${response.status}`;

    if (outcome === 'rate_limited' && attempt < RATE_LIMIT_RETRIES) {
      const retryAfter = Number(response.headers.get('x-concierge-retry-after')) || 0;
      const backoffMs = retryAfter > 0 ? retryAfter * 1000 : DELAY_BETWEEN_CALLS_MS * 2 ** (attempt + 1);
      console.log(`  rate limited, backing off ${(backoffMs / 1000).toFixed(1)}s...`);
      await sleep(backoffMs);
      continue;
    }

    const totalTokens = Number(response.headers.get('x-concierge-total-tokens')) || null;
    if (response.status !== 200) return { request: null, outcome, totalTokens };

    const data = await response.json();
    return { request: parseConciergeRequest(data, vocabulary), outcome, totalTokens };
  }

  return { request: null, outcome: 'rate_limited', totalTokens: null };
}

interface Scenario {
  rawText: string;
  /** true when the sentence deserves a real plan; false for scenario-10-style
   * nonsense that should decline (null request, or a low-confidence empty one). */
  wantsPlan: boolean;
  check: (request: ConciergeRequest | null) => string | null; // null = pass, string = failure reason
  /** Scored separately against INTENT_ACCURACY_TARGET. Several intents are
   * acceptable for some sentences — list every one that would send the guest
   * somewhere reasonable. */
  expectIntent?: ConciergeIntentKind[];
  /** Scored separately against EXCLUSION_TARGET — every listed term must appear
   * in the parsed exclusions. */
  expectExclusions?: string[];
}

const decline = (request: ConciergeRequest | null): string | null =>
  conciergeDeclined(request) ? null : `expected a decline (null, or low-confidence empty), got ${JSON.stringify(request)}`;

const wantsSomePlan = (request: ConciergeRequest | null): string | null => (request ? null : 'expected a parsed request, got null');

function timeWindowHas(request: ConciergeRequest, field: 'startsBy' | 'backBy', expected: string): string | null {
  return request.timeWindow[field] === expected ? null : `expected timeWindow.${field}=${expected}, got ${request.timeWindow[field]}`;
}

const scenarios: Scenario[] = [
  // The 10 sample scenarios from docs/build-book.md:349-364, verbatim.
  { rawText: 'Dinner and a show tonight, nothing over $$, walking distance.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$$' ? null : `expected budget $$, got ${r.budget}`) },
  { rawText: "Something quiet, I don't want a crowd, back by 9.", wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : timeWindowHas(r, 'backBy', '21:00')) },
  { rawText: "It's raining — what's a good plan that's mostly indoors?", wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'I already have Yoshi’s tickets for 7:30, what should I do before?', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Cheap eats and something free tonight.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$' ? null : `expected budget $, got ${r.budget}`) },
  { rawText: "Surprise me, I'm feeling adventurous.", wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Anything open right now?', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: "I don't want to repeat where I ate last night.", wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'What if I skip dinner and just want the show?', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'asdkj alskdj purple elephant Tuesday flavor', wantsPlan: false, check: decline },

  // 11-20 — pace
  { rawText: 'Keep it relaxed tonight, nothing rushed.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.pace === 'Relaxed' || r.pace === null ? null : `expected Relaxed or null pace, got ${r.pace}`) },
  { rawText: 'I want a packed night — dinner, a show, and a nightcap.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.wantsNightlife || r.pace === 'Packed' ? null : 'expected Packed pace or explicit nightlife') },
  { rawText: 'Just a relaxed dinner, nothing else.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Pack the night full, I want to do everything.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.pace === 'Packed' ? null : `expected Packed, got ${r.pace}`) },
  { rawText: 'Nothing specific about pace, just dinner.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'A slow, easy evening — one stop is fine.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'I have all night, show me everything walkable.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Just something chill, no rush at all.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Busy night please — dinner then straight to a show.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'One easy stop, I am tired tonight.', wantsPlan: true, check: (r) => wantsSomePlan(r) },

  // 21-30 — budget
  { rawText: 'Keep it under $10 a plate.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$' ? null : `expected $, got ${r.budget}`) },
  { rawText: 'I want a nice, upscale dinner, price is no object.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$$$' ? null : `expected $$$, got ${r.budget}`) },
  { rawText: 'Somewhere mid-range for dinner.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'No budget preference, just somewhere good.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Fancy tasting menu tonight, spare no expense.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$$$' ? null : `expected $$$, got ${r.budget}`) },
  { rawText: 'Budget eats only, I am broke tonight.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$' ? null : `expected $, got ${r.budget}`) },
  { rawText: 'Somewhere reasonably priced, not cheap not fancy.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Treat-yourself dinner, go all out.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Whatever is affordable near me.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Splurge-worthy dinner spot please.', wantsPlan: true, check: (r) => wantsSomePlan(r) },

  // 31-40 — time windows / mood
  { rawText: 'Need to be back home by 11 PM sharp.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : timeWindowHas(r, 'backBy', '23:00')) },
  { rawText: 'Nothing starting before 8 PM.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : timeWindowHas(r, 'startsBy', '20:00')) },
  { rawText: 'Something with live music tonight.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'I love the outdoors, anything outside tonight?', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Want a proper foodie experience tonight.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Back by midnight at the latest.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : timeWindowHas(r, 'backBy', '00:00')) },
  { rawText: 'No time constraints tonight, totally open.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Something with dancing or a DJ.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Want to start right after work, around 6.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'A nightcap after dinner would be nice.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.wantsNightlife ? null : 'expected wantsNightlife true') },

  // 41-50 — mixed / edge cases
  { rawText: 'Dinner only, please — no event, no bar after.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.wantsNightlife === false ? null : 'expected wantsNightlife false') },
  { rawText: 'Just want to know what shows are on tonight.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Dinner, a show, and drinks after — the whole night.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.wantsNightlife ? null : 'expected wantsNightlife true') },
  { rawText: 'Something romantic for a date night.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: 'Family-friendly plan for tonight, nothing rowdy.', wantsPlan: true, check: (r) => wantsSomePlan(r) },
  { rawText: '', wantsPlan: false, check: (r) => (r === null ? null : 'expected null for empty input') },
  { rawText: '???', wantsPlan: false, check: decline },
  { rawText: 'What is the capital of France?', wantsPlan: false, check: decline },
  { rawText: 'Cheap dinner, walking distance, back by 10, love live music.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.budget === '$' && r.timeWindow.backBy === '22:00' ? null : `expected $ + backBy 22:00, got ${JSON.stringify(r)}`) },
  { rawText: 'Packed night, upscale dinner, live music, back by midnight.', wantsPlan: true, check: (r) => (!r ? wantsSomePlan(r) : r.pace === 'Packed' && r.budget === '$$$' ? null : `expected Packed + $$$, got ${JSON.stringify(r)}`) },

  // 51-64 — intent. A wrong value here routes the guest to the wrong screen,
  // which is the most visible failure this whole harness measures.
  { rawText: 'Plan my whole evening — dinner then a show.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['plan_evening'] },
  { rawText: 'Somewhere cheap and quick to eat.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_place'] },
  { rawText: 'Find me a quiet bar nearby.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_place'] },
  { rawText: 'What is on at Yoshi’s this week?', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_event', 'answer_fact'] },
  { rawText: 'Any live music tonight?', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_event'] },
  { rawText: 'Is the Paramount open on Mondays?', wantsPlan: true, check: wantsSomePlan, expectIntent: ['answer_fact'] },
  { rawText: 'A run before dinner, somewhere flat.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_activity'] },
  { rawText: 'Something outside before it gets dark.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_activity'] },
  { rawText: 'Make that cheaper.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['refine'] },
  { rawText: 'Something closer than that.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['refine'] },
  { rawText: 'Dinner, a show and a nightcap — the full night.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['plan_evening'] },
  { rawText: 'zzz qwe flurble', wantsPlan: false, check: decline, expectIntent: ['unknown'] },
  { rawText: 'How do I renew my passport?', wantsPlan: false, check: decline, expectIntent: ['unknown'] },
  { rawText: 'ok', wantsPlan: false, check: decline, expectIntent: ['unknown'] },

  // 65-70 — exclusions. "not thai must never return thai" has no tolerance:
  // an exclusion the guest is told was applied has to actually be applied.
  { rawText: 'Somewhere cheap and quick, not thai.', wantsPlan: true, check: wantsSomePlan, expectIntent: ['find_place'], expectExclusions: ['Thai'] },
  { rawText: 'Dinner tonight but no thai food please.', wantsPlan: true, check: wantsSomePlan, expectExclusions: ['Thai'] },
  { rawText: 'Anything except thai.', wantsPlan: true, check: wantsSomePlan, expectExclusions: ['Thai'] },
  { rawText: 'I never want thai again, find me dinner.', wantsPlan: true, check: wantsSomePlan, expectExclusions: ['Thai'] },
  { rawText: 'Dinner and a show, nothing thai.', wantsPlan: true, check: wantsSomePlan, expectExclusions: ['Thai'] },
  { rawText: 'Dinner tonight, anything at all.', wantsPlan: true, check: wantsSomePlan, expectExclusions: [] },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Outcomes that mean the harness never got a verdict from the model. Scoring
 * these as quality failures is what produced the meaningless 18% first run. */
const INFRASTRUCTURE_OUTCOMES = new Set(['rate_limited', 'upstream_error', 'timeout', 'no_key', 'malformed_completion']);

async function main() {
  const vocabulary = tasteVocabulary();
  let passed = 0;
  const failures: string[] = [];
  const infrastructure: string[] = [];
  const tokenCounts: number[] = [];

  // Each gate is scored over only the scenarios that assert it, so a metric
  // can't be diluted by the ones that say nothing about it.
  const tally = {
    intent: { scored: 0, passed: 0 },
    exclusion: { scored: 0, passed: 0 },
    decline: { scored: 0, passed: 0 },
  };

  console.log(`${scenarios.length} scenarios, ${(DELAY_BETWEEN_CALLS_MS / 1000).toFixed(1)}s apart\n`);

  for (const [index, scenario] of scenarios.entries()) {
    const { request, outcome, totalTokens } = await callConcierge(scenario.rawText, vocabulary);

    // An empty sentence is rejected locally by design and never reaches the model.
    if (INFRASTRUCTURE_OUTCOMES.has(outcome) && scenario.rawText !== '') {
      infrastructure.push(`SKIP  "${scenario.rawText}" — ${outcome}`);
      continue;
    }

    if (totalTokens != null) tokenCounts.push(totalTokens);

    const failure = scenario.check(request);
    if (failure) failures.push(`FAIL  "${scenario.rawText}" — ${failure}`);
    else passed += 1;

    if (scenario.expectIntent) {
      tally.intent.scored += 1;
      if (request && scenario.expectIntent.includes(request.intent)) tally.intent.passed += 1;
      else failures.push(`INTENT  "${scenario.rawText}" — expected ${scenario.expectIntent.join('|')}, got ${request?.intent ?? 'null'}`);
    }

    if (scenario.expectExclusions) {
      tally.exclusion.scored += 1;
      const got = request?.exclusions ?? [];
      const missing = scenario.expectExclusions.filter((tag) => !got.includes(tag));
      if (!missing.length) tally.exclusion.passed += 1;
      else failures.push(`EXCLUSION  "${scenario.rawText}" — missing ${missing.join(', ')}, got [${got.join(', ')}]`);
    }

    if (!scenario.wantsPlan) {
      tally.decline.scored += 1;
      if (!failure) tally.decline.passed += 1;
    }

    if (index < scenarios.length - 1) await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  const scored = scenarios.length - infrastructure.length;
  const rate = scored > 0 ? passed / scored : 0;
  console.log(`\n${passed}/${scored} scored scenarios passed (${(rate * 100).toFixed(1)}%)`);
  if (infrastructure.length) console.log(`${infrastructure.length} not scored — infrastructure, not model quality:`);
  for (const line of infrastructure) console.log(line);
  if (failures.length) console.log('');
  for (const line of failures) console.log(line);

  // A run that couldn't reach the model isn't a pass or a fail — it's no result.
  // Saying so beats reporting a pass rate computed from a handful of scenarios.
  if (infrastructure.length > scenarios.length * 0.1) {
    console.error(`\nInconclusive: ${infrastructure.length}/${scenarios.length} calls never reached the model. Re-run when the token budget recovers.`);
    process.exit(2);
  }

  const rateOf = (metric: { scored: number; passed: number }) => (metric.scored > 0 ? metric.passed / metric.scored : 1);
  const meanTokens = tokenCounts.length ? tokenCounts.reduce((sum, n) => sum + n, 0) / tokenCounts.length : 0;

  const gates = [
    { label: 'Overall parse', value: rate, target: PASS_RATE_TARGET, format: 'rate' as const },
    { label: 'Intent accuracy', value: rateOf(tally.intent), target: INTENT_ACCURACY_TARGET, format: 'rate' as const },
    { label: 'Exclusion honoured', value: rateOf(tally.exclusion), target: EXCLUSION_TARGET, format: 'rate' as const },
    { label: 'Decline correctness', value: rateOf(tally.decline), target: DECLINE_TARGET, format: 'rate' as const },
  ];

  console.log('');
  for (const gate of gates) {
    const ok = gate.value >= gate.target;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${gate.label.padEnd(20)} ${(gate.value * 100).toFixed(1)}%  (target ${(gate.target * 100).toFixed(0)}%)`,
    );
  }
  if (tokenCounts.length) {
    const ok = meanTokens < MAX_TOKENS_PER_ASK;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${'Tokens per ask'.padEnd(20)} ${meanTokens.toFixed(0)}  (target <${MAX_TOKENS_PER_ASK})`);
    if (!ok) gates.push({ label: 'Tokens per ask', value: 0, target: 1, format: 'rate' });
  } else {
    console.log(`      ${'Tokens per ask'.padEnd(20)} not reported by this provider`);
  }

  const failed = gates.filter((gate) => gate.value < gate.target);
  if (failed.length) {
    console.error(`\n${failed.length} gate${failed.length === 1 ? '' : 's'} below target: ${failed.map((gate) => gate.label).join(', ')}.`);
    process.exit(1);
  }
  console.log('\nEvery gate at or above target.');
}

void main();
