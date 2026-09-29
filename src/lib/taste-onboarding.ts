import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';

// Device-local record of the arrival sequence's taste-tag prompt, plus any
// tags a signed-out guest picked before creating an account. Mirrors
// location.ts/stay.ts: a returning guest shouldn't see the prompt again just
// because tasteTags is empty (tags require an account to sync today), and
// tags picked before signing up shouldn't be lost the moment they do.

const TASTE_PROMPT_KEY = 'wayvee.taste-onboarding.v1';
const GUEST_TASTE_TAGS_KEY = 'wayvee.guest-taste-tags.v1';

export type TastePromptStatus = 'unknown' | 'done' | 'skipped';

export async function restoreTastePromptStatus(): Promise<TastePromptStatus> {
  const raw = await getStoredItem(TASTE_PROMPT_KEY);
  return raw === 'done' || raw === 'skipped' ? raw : 'unknown';
}

export async function markTastePromptDone(status: 'done' | 'skipped'): Promise<void> {
  await setStoredItem(TASTE_PROMPT_KEY, status);
}

export async function restoreGuestTasteTags(): Promise<string[]> {
  const raw = await getStoredItem(GUEST_TASTE_TAGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveGuestTasteTags(tags: string[]): Promise<void> {
  await setStoredItem(GUEST_TASTE_TAGS_KEY, JSON.stringify(tags));
}

export async function clearGuestTasteTags(): Promise<void> {
  await deleteStoredItem(GUEST_TASTE_TAGS_KEY);
}
