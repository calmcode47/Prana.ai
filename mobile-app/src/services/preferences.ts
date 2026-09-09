import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
  language: 'en' | 'hi' | 'pa';
  defaultCorridorNode: 'punjab' | 'transit' | 'delhi';
  aqiAlertThreshold: number;
  temperatureUnit: 'C' | 'F';
  darkMode: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  defaultCorridorNode: 'delhi',
  aqiAlertThreshold: 200,
  temperatureUnit: 'C',
  darkMode: false,
};

const STORAGE_PREFIX = '@prana_pref_';

export async function getPreferences(): Promise<UserPreferences> {
  try {
    const keys = Object.keys(DEFAULT_PREFERENCES) as (keyof UserPreferences)[];
    const pairs = await AsyncStorage.multiGet(keys.map((k) => `${STORAGE_PREFIX}${k}`));
    const prefs = { ...DEFAULT_PREFERENCES };

    for (const [storageKey, val] of pairs) {
      if (val !== null) {
        const prefKey = storageKey.replace(STORAGE_PREFIX, '') as keyof UserPreferences;
        try {
          (prefs as any)[prefKey] = JSON.parse(val);
        } catch {
          (prefs as any)[prefKey] = val;
        }
      }
    }
    return prefs;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function getPreference<K extends keyof UserPreferences>(
  key: K
): Promise<UserPreferences[K]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) return DEFAULT_PREFERENCES[key];
    try {
      return JSON.parse(raw);
    } catch {
      return raw as unknown as UserPreferences[K];
    }
  } catch {
    return DEFAULT_PREFERENCES[key];
  }
}

export async function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Storage write failure fallback
  }
}
