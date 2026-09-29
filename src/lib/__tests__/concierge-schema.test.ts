// The Edge Function (supabase/functions/concierge/index.ts) can't import from
// src/ — it's a separate Deno deployment — so its JSON schema restates
// PACE_OPTIONS/BUDGET_OPTIONS/CONFIDENCE_LEVELS by hand instead of importing
// concierge/enums.ts. That's a real, silent drift risk: someone adds a new
// pace option in enums.ts, every app-side type and test picks it up, and the
// deployed function keeps rejecting it with strict:true — a production bug
// with no compiler or test to catch it. This test reads the function's source
// as text and checks its literal enum arrays against the one real source of
// truth, so drift fails a test run instead of surfacing as a live 400.
import fs from 'node:fs';
import path from 'node:path';

import { BUDGET_OPTIONS, CONFIDENCE_LEVELS, DOMAIN_OPTIONS, INTENT_OPTIONS, OCCASION_OPTIONS, PACE_OPTIONS } from '@/lib/concierge/enums';

const SOURCE = fs.readFileSync(path.join(__dirname, '../../../supabase/functions/concierge/index.ts'), 'utf-8');

function extractEnumArray(fieldName: string): string[] {
  const match = SOURCE.match(new RegExp(`${fieldName}:[^]*?enum:\\s*\\[([^\\]]*)\\]`));
  if (!match) throw new Error(`Could not find an "enum:" array for "${fieldName}" in the deployed function source.`);
  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== 'null')
    .map((entry) => entry.replace(/^['"]|['"]$/g, ''));
}

describe('concierge Edge Function schema — drift guard against src/lib/concierge/enums.ts', () => {
  it('pace enum matches PACE_OPTIONS', () => {
    expect(extractEnumArray('pace')).toEqual([...PACE_OPTIONS]);
  });

  it('budget enum matches BUDGET_OPTIONS', () => {
    expect(extractEnumArray('budget')).toEqual([...BUDGET_OPTIONS]);
  });

  it('confidence enum matches CONFIDENCE_LEVELS', () => {
    expect(extractEnumArray('confidence')).toEqual([...CONFIDENCE_LEVELS]);
  });

  it('intent enum matches INTENT_OPTIONS', () => {
    expect(extractEnumArray('intent')).toEqual([...INTENT_OPTIONS]);
  });

  it('domains enum matches DOMAIN_OPTIONS', () => {
    expect(extractEnumArray('domains')).toEqual([...DOMAIN_OPTIONS]);
  });

  it('occasion enum matches OCCASION_OPTIONS', () => {
    expect(extractEnumArray('occasion')).toEqual([...OCCASION_OPTIONS]);
  });

  it('schema and every nested object declare additionalProperties: false (Groq/OpenAI strict-mode requirement)', () => {
    const occurrences = SOURCE.match(/additionalProperties:\s*false/g) ?? [];
    // One for the root object, one for the nested timeWindow object.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('every nullable field uses anyOf rather than a type array (the union form Groq/OpenAI strict mode rejects)', () => {
    expect(SOURCE).not.toMatch(/type:\s*\[\s*['"]string['"]\s*,\s*['"]null['"]\s*\]/);
  });
});
