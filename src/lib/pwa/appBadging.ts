/**
 * BVELT App Badging API Utility
 * Integrates with navigator.setAppBadge / navigator.clearAppBadge for PWA mobile/desktop icon badges.
 */

let lastBadgeCount: number | null = null;

/**
 * Checks whether the Badging API is supported by the current browser/OS environment.
 */
export function isAppBadgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/**
 * Safely updates the app badge count.
 * @param count - Number of pending attention items (offline mutations, unread gaps, urgent actions).
 * If count is 0 or negative, clears the badge.
 */
export async function updateAppBadge(count: number): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  try {
    if (count <= 0) {
      return await clearAppBadge();
    }

    if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
      await (navigator as any).setAppBadge(Math.round(count));
      lastBadgeCount = count;
      return true;
    }

    // Fallback: document.title notification counter
    updateDocumentTitleBadge(count);
    return false;
  } catch (err) {
    console.debug('[AppBadge] Could not set app badge (silently ignored):', err);
    return false;
  }
}

/**
 * Safely clears the app badge.
 */
export async function clearAppBadge(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  try {
    if ('clearAppBadge' in navigator && typeof (navigator as any).clearAppBadge === 'function') {
      await (navigator as any).clearAppBadge();
      lastBadgeCount = 0;
      clearDocumentTitleBadge();
      return true;
    }

    clearDocumentTitleBadge();
    return false;
  } catch (err) {
    console.debug('[AppBadge] Could not clear app badge:', err);
    return false;
  }
}

/**
 * Fallback to updating document title with (N) badge prefix when Badging API is unavailable.
 */
let originalDocTitle: string | null = null;

function updateDocumentTitleBadge(count: number) {
  if (typeof document === 'undefined') return;
  if (!originalDocTitle) {
    originalDocTitle = document.title.replace(/^\(\d+\)\s*/, '');
  }
  const cleanTitle = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = `(${count}) ${cleanTitle}`;
}

function clearDocumentTitleBadge() {
  if (typeof document === 'undefined') return;
  if (originalDocTitle) {
    document.title = document.title.replace(/^\(\d+\)\s*/, '');
  }
}
