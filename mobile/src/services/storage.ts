import * as SecureStore from 'expo-secure-store';

// Keys may only contain letters, numbers, ".", "-" and "_"
const KEYS = {
  serverUrl: 'layali.serverUrl',
  deviceToken: 'layali.deviceToken',
  sessionToken: 'layali.sessionToken',
} as const;

export type StoredKey = keyof typeof KEYS;

// Tokens stay on this phone: not readable before first unlock, never restored to another device
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// Fallback for platforms without a secure store (e.g. web preview): memory only, never persisted
const memory = new Map<StoredKey, string>();

export async function readStored(key: StoredKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS[key], OPTIONS);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function writeStored(key: StoredKey, value: string | null): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(KEYS[key], value, OPTIONS);
    else await SecureStore.deleteItemAsync(KEYS[key], OPTIONS);
  } catch {
    if (value) memory.set(key, value);
    else memory.delete(key);
  }
}

export async function readAllStored() {
  const [serverUrl, deviceToken, sessionToken] = await Promise.all([
    readStored('serverUrl'),
    readStored('deviceToken'),
    readStored('sessionToken'),
  ]);
  return { serverUrl, deviceToken, sessionToken };
}
