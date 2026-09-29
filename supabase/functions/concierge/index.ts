// Ask concierge — parses a guest's freeform sentence into a small, enum-only
// ConciergeRequest JSON object. This function is a catalog-agnostic model
// proxy: it never sees a restaurant name, never sees the catalog, and holds
// the only secret (the AI provider key) so it never ships inside the app
// bundle (docs/build-book.md Part 3.2). Everything it returns is re-validated
// client-side in src/lib/concierge/request.ts — this function is not the
// guardrail, that file is.
//
// CLAUDE.md #6 (never breaks): any failure here — missing key, timeout, rate
// limit, malformed model output — returns 204, not 500. The client treats
// "no request" as "browse instead," never as an error to surface.

const CONCIERGE_API_KEY = Deno.env.get('CONCIERGE_API_KEY');
const CONCIERGE_MODEL = Deno.env.get('CONCIERGE_MODEL') ?? 'gpt-4o-mini';
const CONCIERGE_BASE_URL = Deno.env.get('CONCIERGE_BASE_URL') ?? 'https://api.openai.com/v1';

// Auto-injected into every Supabase Edge Function's environment — never set
// by hand, and never the same secret family as CONCIERGE_API_KEY above.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const MAX_RAW_TEXT_LENGTH = 500;
const MAX_MOOD_VOCABULARY = 100;
const REQUEST_TIMEOUT_MS = 6000;
// A 5xx or dropped connection is usually a blip on the model provider's side,
// not a real failure — one retry turns a transient hiccup into an invisible
// extra 300ms instead of a guest-visible decline. 429s and 4xx errors are
// never retried: retrying a bad key or a rate limit only wastes the budget.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fire-and-forget durable log row — never awaited by the response path, so
 * a slow or unreachable database never adds latency to a guest's answer.
 * EdgeRuntime.waitUntil keeps the write alive past the response being sent;
 * without it, Deno Deploy can freeze the isolate the instant the response
 * flushes and the insert would silently never land. See
 * supabase/migrations/20260801000000_citycue_concierge_runs.sql. */
function logRun(payload: Record<string, unknown>): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const task = fetch(`${SUPABASE_URL}/rest/v1/concierge_runs`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(task);
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Without this the browser hides x-concierge-* from the web PWA, so the
  // outcome would be readable on native but invisible on web.
  'Access-Control-Expose-Headers': 'x-concierge-outcome, x-concierge-retry-after, x-concierge-upstream-status, x-concierge-total-tokens',
};

const CONCIERGE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    rawText: { type: 'string' },
    intent: {
      type: 'string',
      enum: ['plan_evening', 'find_place', 'find_event', 'find_activity', 'answer_fact', 'refine', 'unknown'],
    },
    domains: { type: 'array', items: { type: 'string', enum: ['food', 'events', 'music', 'film', 'drinks'] } },
    exclusions: { type: 'array', items: { type: 'string' } },
    hardExclusions: { type: 'array', items: { type: 'string' } },
    occasion: { anyOf: [{ type: 'string', enum: ['date_night', 'casual', 'group', 'solo'] }, { type: 'null' }] },
    pace: { anyOf: [{ type: 'string', enum: ['Relaxed', 'Packed'] }, { type: 'null' }] },
    budget: { anyOf: [{ type: 'string', enum: ['$', '$$', '$$$'] }, { type: 'null' }] },
    moodTags: { type: 'array', items: { type: 'string' } },
    timeWindow: {
      type: 'object',
      properties: {
        startsBy: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        backBy: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['startsBy', 'backBy'],
      additionalProperties: false,
    },
    wantsNightlife: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['rawText', 'intent', 'domains', 'exclusions', 'hardExclusions', 'occasion', 'pace', 'budget', 'moodTags', 'timeWindow', 'wantsNightlife', 'confidence'],
  additionalProperties: false,
} as const;

function systemPrompt(moodVocabulary: string[]): string {
  return [
    'You turn one guest sentence about Downtown Oakland into a structured request.',
    'Fill in only fields you can support from the sentence. Leave pace/budget null rather than guessing.',
    'intent is the shape of answer the sentence asks for, and it decides which page the guest lands on — get it wrong and they see the wrong screen:',
    '  plan_evening — wants a full night built ("dinner then a show", "plan my evening")',
    '  find_place — wants a ranked list of places ("somewhere cheap and quick", "a quiet bar")',
    '  find_event — wants what is on ("any live music tonight?")',
    '  find_activity — wants something to do outdoors or active ("a run before dinner")',
    '  answer_fact — wants one fact ("is Yoshi\'s open Mondays?")',
    '  refine — adjusts a plan already on screen ("cheaper", "something closer")',
    '  unknown — nonsense, off-topic, or too vague to place. Prefer unknown over guessing.',
    `domains scope the request to catalog areas, from this exact list only: food, events, music, film, drinks. Omit anything else — do not invent a domain for outdoor or fitness requests. A sentence that only mentions dinner with no show/music/film ("dinner only, no event") should set domains to just ["food"], so the plan doesn't add a stop nobody asked for.`,
    `exclusions are preference dislikes the guest asked NOT to have ("not thai" -> thai, "no loud bars"). Use values from this exact list only (omit anything not in it): ${moodVocabulary.join(', ') || '(none available)'}`,
    `hardExclusions are dietary restrictions or allergies stated as non-negotiable — "allergic to X", "X allergy", "vegan", "vegetarian", "gluten-free", "can't eat X", "dairy-free". These get dropped from consideration entirely, not just deprioritized, so only put a real safety/dietary restriction here, never a taste preference. Same exact-list rule as exclusions: ${moodVocabulary.join(', ') || '(none available)'}`,
    `moodTags must only use values from this exact list (omit anything not in it): ${moodVocabulary.join(', ') || '(none available)'}`,
    'occasion is the kind of evening this is, only when the sentence actually signals it: "date_night" (anniversary, date, romantic), "group" (with friends, a group of, the guys/girls, birthday party), "solo" (solo, by myself, traveling alone), "casual" (explicitly low-key/casual/no fuss). Leave it null rather than guessing — most sentences do not say.',
    'timeWindow times are 24-hour "HH:MM" local time, or null if not mentioned. Convert 12-hour clock times: "10pm" is "22:00", not "10:00"; "7am" is "07:00". This is evening planning, so a bare hour like "by 8" almost always means 20:00, not 08:00, unless the sentence clearly says morning.',
    'budget is your read of price intent, not just an explicit dollar sign — infer it from words. "cheap"/"budget"/"affordable"/"inexpensive"/"broke" -> "$". "upscale"/"fancy"/"spare no expense"/"splurge"/"treat myself"/"tasting menu"/"go all out" -> "$$$". A plain "nice dinner" or "somewhere good" with no price language stays null — that is a taste signal, not a budget one.',
    'wantsNightlife is true whenever the guest wants something after dinner, even without the word "nightlife" in the sentence — "a nightcap", "drinks after", "the full night", "dinner, a show and drinks" all imply it. It stays false when the guest asks for dinner only or a show only.',
    'confidence is your own honest certainty about this parse: high, medium, or low.',
    'If the sentence is nonsense or unrelated to planning an Oakland evening, still return the object with empty/null fields and confidence "low".',
    'Copy the guest sentence verbatim into rawText. Never invent a restaurant, venue, or event name — you are not asked for any and none should appear.',
  ].join('\n');
}

/** Every no-plan path is a 204 the guest experiences identically as "browse
 * instead" (CLAUDE.md #6) — but the reason travels in a header so the eval
 * harness and telemetry can tell a rate limit apart from a bad parse. Without
 * this, `npm run eval:concierge` scores infrastructure failures as model
 * quality failures and reports a meaningless pass rate. */
type Outcome = 'ok' | 'no_key' | 'bad_request' | 'invalid_input' | 'rate_limited' | 'upstream_error' | 'malformed_completion' | 'timeout';

function declined(outcome: Outcome, extra: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'x-concierge-outcome': outcome, ...extra } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return declined('bad_request');

  const startedAt = Date.now();

  if (!CONCIERGE_API_KEY) return declined('no_key');

  let rawText: string;
  let moodVocabulary: string[];
  try {
    const body = await req.json();
    rawText = typeof body?.rawText === 'string' ? body.rawText : '';
    moodVocabulary = Array.isArray(body?.moodVocabulary) ? body.moodVocabulary.filter((t: unknown) => typeof t === 'string') : [];
  } catch {
    return declined('bad_request');
  }

  if (!rawText || rawText.length > MAX_RAW_TEXT_LENGTH || moodVocabulary.length > MAX_MOOD_VOCABULARY) {
    return declined('invalid_input');
  }

  let attempts = 0;
  for (;;) {
    attempts += 1;
    const attemptStartedAt = Date.now();
    try {
      const response = await fetch(`${CONCIERGE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CONCIERGE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONCIERGE_MODEL,
          temperature: 0,
          // Generous ceiling costs nothing unused — real spend is metered by
          // actual completion tokens, not this cap.
          max_tokens: 1000,
          messages: [
            { role: 'system', content: systemPrompt(moodVocabulary) },
            { role: 'user', content: rawText },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'concierge_request', strict: true, schema: CONCIERGE_REQUEST_SCHEMA },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.log(JSON.stringify({ event: 'concierge_upstream_error', status: response.status, attempt: attempts, durationMs: Date.now() - attemptStartedAt }));
        // 429 is a capacity/rate-limit signal, not a broken request — never
        // retried, since hammering a rate-limited provider only makes it
        // worse. A 5xx is usually transient and worth one retry; anything
        // else in the 4xx range (a bad key, a malformed request) will fail
        // identically on a second try, so don't spend the latency on it.
        if (response.status === 429) {
          logRun({ outcome: 'rate_limited', model: CONCIERGE_MODEL, duration_ms: Date.now() - startedAt, attempts, upstream_status: response.status });
          return declined('rate_limited', { 'x-concierge-retry-after': response.headers.get('retry-after') ?? '' });
        }
        if (response.status >= 500 && attempts < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        logRun({ outcome: 'upstream_error', model: CONCIERGE_MODEL, duration_ms: Date.now() - startedAt, attempts, upstream_status: response.status });
        return declined('upstream_error', { 'x-concierge-upstream-status': String(response.status) });
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        logRun({ outcome: 'malformed_completion', model: CONCIERGE_MODEL, duration_ms: Date.now() - startedAt, attempts });
        return declined('malformed_completion');
      }

      const usage = payload?.usage ?? {};
      console.log(
        JSON.stringify({
          event: 'concierge_request_parsed',
          durationMs: Date.now() - startedAt,
          attempts,
          promptTokens: usage.prompt_tokens ?? null,
          completionTokens: usage.completion_tokens ?? null,
          totalTokens: usage.total_tokens ?? null,
          model: CONCIERGE_MODEL,
        }),
      );
      logRun({
        outcome: 'ok',
        model: CONCIERGE_MODEL,
        duration_ms: Date.now() - startedAt,
        attempts,
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
      });

      return new Response(content, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'x-concierge-outcome': 'ok',
          'x-concierge-total-tokens': String(usage.total_tokens ?? ''),
        },
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
      console.log(JSON.stringify({ event: 'concierge_error', message: String(error), attempt: attempts, durationMs: Date.now() - attemptStartedAt }));
      // A timeout already spent the full REQUEST_TIMEOUT_MS budget — retrying
      // it doubles worst-case latency for a guest who is actively waiting, so
      // only a hard network failure (connection refused/reset, DNS) retries.
      if (!timedOut && attempts < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      const outcome: Outcome = timedOut ? 'timeout' : 'upstream_error';
      logRun({ outcome, model: CONCIERGE_MODEL, duration_ms: Date.now() - startedAt, attempts });
      return declined(outcome);
    }
  }
});
