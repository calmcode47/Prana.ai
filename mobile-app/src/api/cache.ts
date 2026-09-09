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

export async function readApiCache<T>(requestKey: string): Promise<T | null> {
  const serialized = await AsyncStorage.getItem(keyFor(requestKey));
  if (!serialized) return null;
  try {
    const envelope = JSON.parse(serialized) as CacheEnvelope<T>;
    return envelope?.value ?? null;
  } catch {
    await AsyncStorage.removeItem(keyFor(requestKey));
    return null;
  }
}
