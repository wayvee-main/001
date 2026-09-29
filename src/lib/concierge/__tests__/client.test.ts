// Locks in CLAUDE.md #6 for the one call that leaves the device: whatever
// goes wrong reaching the concierge Edge Function, requestConciergeRequest
// must resolve null, never throw, so a caller always has a clean "browse
// instead" path. Mocks '@/lib/supabase' directly rather than going through
// the real client, since the thing under test is client.ts's own handling of
// what supabase.functions.invoke can hand back — not Supabase's SDK itself.
import { requestConciergeRequest } from '@/lib/concierge/client';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get supabase() {
    return { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } };
  },
}));

const VOCAB = ['cozy', 'lively'];

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    rawText: 'dinner tonight',
    intent: 'plan_evening',
    domains: [],
    exclusions: [],
    pace: null,
    budget: null,
    moodTags: [],
    timeWindow: { startsBy: null, backBy: null },
    wantsNightlife: false,
    confidence: 'high',
    ...overrides,
  };
}

beforeEach(() => mockInvoke.mockReset());

describe('requestConciergeRequest — rule-6 fallback on every failure path', () => {
  it('resolves null on empty rawText without calling the function at all', async () => {
    expect(await requestConciergeRequest('   ', VOCAB)).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('resolves the parsed request on a clean 200', async () => {
    mockInvoke.mockResolvedValueOnce({ data: validPayload(), error: null });
    const result = await requestConciergeRequest('dinner tonight', VOCAB);
    expect(result?.intent).toBe('plan_evening');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('resolves null on a 204 decline (no data, no error)', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: null });
    expect(await requestConciergeRequest('asdkj', VOCAB)).toBeNull();
  });

  it('resolves null when invoke reports an error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('rate limited') });
    expect(await requestConciergeRequest('dinner tonight', VOCAB)).toBeNull();
  });

  it('resolves null, never throws, when a malformed payload fails the guardrail', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { rawText: 'x', pace: 'Extreme' }, error: null });
    await expect(requestConciergeRequest('dinner tonight', VOCAB)).resolves.toBeNull();
  });

  it('retries once on a thrown network error, then succeeds', async () => {
    mockInvoke.mockRejectedValueOnce(new TypeError('Network request failed'));
    mockInvoke.mockResolvedValueOnce({ data: validPayload(), error: null });
    const result = await requestConciergeRequest('dinner tonight', VOCAB);
    expect(result?.intent).toBe('plan_evening');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('resolves null, never throws, when every attempt throws', async () => {
    mockInvoke.mockRejectedValue(new TypeError('Network request failed'));
    await expect(requestConciergeRequest('dinner tonight', VOCAB)).resolves.toBeNull();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});
