import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

// Phones and tablets stay open all shift, so don't wait for a cold start to look for updates
const CHECK_EVERY_MS = 10 * 60_000;

async function downloadIfAvailable() {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline or update server unreachable: try again later
  }
}

/**
 * Over-the-air updates: checks on launch, on return to the foreground and every 10 minutes, and
 * applies a downloaded update as soon as `canRestart` is true (lock or pairing screen, where a
 * reload loses nothing). Does nothing in development or while updates are disabled.
 */
export function useAppUpdates(canRestart: boolean) {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const timer = setInterval(downloadIfAvailable, CHECK_EVERY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void downloadIfAvailable();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (isUpdatePending && canRestart) Updates.reloadAsync().catch(() => {});
  }, [isUpdatePending, canRestart]);
}
