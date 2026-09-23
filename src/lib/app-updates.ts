import * as Updates from 'expo-updates';

let checked = false;

/**
 * Check for an over-the-air update, at most once per launch.
 *
 * app.json sets updates.checkAutomatically to NEVER so that nothing contacts
 * Expo before the user has accepted the disclosure; this is called only after
 * consent. A downloaded update is applied on the next cold start rather than by
 * reloading, so a user in the middle of connecting is never interrupted.
 *
 * Failures are silent by design: an unreachable update server must never stop
 * the VPN from working.
 */
export async function checkForAppUpdateOnce(): Promise<void> {
  if (checked || !Updates.isEnabled) return;
  checked = true;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // Offline, blocked, or no update published yet.
  }
}
