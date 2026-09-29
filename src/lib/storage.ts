import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_STORE_CHUNK_SIZE = 1800;
const CHUNK_MARKER = 'wayvee-secure-chunks:';

function chunkKey(key: string, index: number): string {
  return `${key}.chunk.${index}`;
}

function storedChunkCount(value: string | null): number {
  if (!value?.startsWith(CHUNK_MARKER)) return 0;
  const count = Number(value.slice(CHUNK_MARKER.length));
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function deleteNativeChunks(key: string, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))),
  );
}

function browserStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.localStorage;
}

export async function getStoredItem(key: string): Promise<string | null> {
  const storage = browserStorage();
  if (storage) return storage.getItem(key);
  if (Platform.OS === 'web') return null;

  const stored = await SecureStore.getItemAsync(key);
  const chunkCount = storedChunkCount(stored);
  if (!chunkCount) return stored;

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
  );
  return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }
  if (Platform.OS === 'web') return;

  const previousChunkCount = storedChunkCount(await SecureStore.getItemAsync(key));
  if (value.length <= SECURE_STORE_CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    await deleteNativeChunks(key, previousChunkCount);
    return;
  }

  const chunks = Array.from(
    { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
    (_, index) => value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE),
  );
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
  await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${chunks.length}`);
  if (previousChunkCount > chunks.length) {
    await Promise.all(
      Array.from(
        { length: previousChunkCount - chunks.length },
        (_, index) => SecureStore.deleteItemAsync(chunkKey(key, chunks.length + index)),
      ),
    );
  }
}

export async function deleteStoredItem(key: string): Promise<void> {
  const storage = browserStorage();
  if (storage) {
    storage.removeItem(key);
    return;
  }
  if (Platform.OS === 'web') return;

  const chunkCount = storedChunkCount(await SecureStore.getItemAsync(key));
  await Promise.all([SecureStore.deleteItemAsync(key), deleteNativeChunks(key, chunkCount)]);
}
