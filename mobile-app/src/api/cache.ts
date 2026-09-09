import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@prana/api/v1/';

interface CacheEnvelope<T> {
  savedAt: string;
  value: T;
}

const keyFor = (requestKey: string) => `${CACHE_PREFIX}${requestKey}`;

export async function writeApiCache<T>(requestKey: string, value: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { savedAt: new Date().toISOString(), value };
  await AsyncStorage.setItem(keyFor(requestKey), JSON.stringify(envelope));
}

export const DEFAULT_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export async function readApiCache<T>(
  requestKey: string,
  maxAgeMs: number = DEFAULT_CACHE_MAX_AGE_MS
): Promise<T | null> {
  const serialized = await AsyncStorage.getItem(keyFor(requestKey));
  if (!serialized) return null;
  try {
    const envelope = JSON.parse(serialized) as CacheEnvelope<T>;
    if (!envelope || envelope.value === undefined) return null;

    if (envelope.savedAt && maxAgeMs > 0) {
      const ageMs = Date.now() - new Date(envelope.savedAt).getTime();
      if (ageMs > maxAgeMs) {
        return null;
      }
    }
    return envelope.value ?? null;
  } catch {
    await AsyncStorage.removeItem(keyFor(requestKey));
    return null;
  }
}
