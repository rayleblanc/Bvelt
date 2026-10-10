import React from 'react';

/**
 * Resilient React.lazy wrapper with automatic retry and stale-chunk auto-recovery.
 *
 * In production PWAs, when a new deployment is published, existing browser tabs
 * request old hashed chunks (e.g. /assets/BveltOnboardingWizard-BpWrROl2.js) that no longer
 * exist on the server, resulting in:
 * "TypeError: error loading dynamically imported module" or "Failed to fetch dynamically imported module".
 *
 * lazyWithRetry:
 * 1. Attempts the dynamic import.
 * 2. On transient failure, waits 500ms and retries once.
 * 3. If it still fails due to a stale chunk or network break, triggers a controlled
 *    window.location.reload() (capped to 1 reload per 10s via sessionStorage) to fetch the latest manifest.
 * 4. While the reload is pending, returns an empty component rather than crashing with an unhandled exception.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const key = `bvelt_chunk_reload_${chunkName || 'chunk'}`;
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    const now = Date.now();
    const canReload = now - lastReload > 10000;

    try {
      const module = await factory();
      sessionStorage.removeItem(key);
      return module.default ? module : { default: module };
    } catch (firstErr: any) {
      console.warn(`[lazyWithRetry] Initial load failed for ${chunkName || 'chunk'}. Retrying in 500ms...`, firstErr);

      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const module = await factory();
        sessionStorage.removeItem(key);
        return module.default ? module : { default: module };
      } catch (secondErr: any) {
        console.error(`[lazyWithRetry] Second load failed for ${chunkName || 'chunk'}:`, secondErr);

        const isDynamicImportError =
          secondErr?.message?.includes('dynamically imported module') ||
          secondErr?.message?.includes('Failed to fetch dynamically imported module') ||
          secondErr?.message?.includes('Loading chunk') ||
          secondErr?.message?.includes('error loading') ||
          secondErr?.name === 'TypeError' ||
          secondErr?.name === 'ChunkLoadError';

        if (isDynamicImportError && canReload) {
          sessionStorage.setItem(key, String(now));
          console.warn(`[lazyWithRetry] Stale chunk detected for ${chunkName || 'chunk'}. Reloading app to fetch updated version...`);
          window.location.reload();
          // Return a pending promise so React Suspense waits for the reload rather than crashing
          return new Promise(() => {});
        }

        // Fail-safe: Instead of throwing an unhandled exception that unmounts the entire React app,
        // log the error and render an empty fallback component safely.
        console.warn(`[lazyWithRetry] Suppressed crash for chunk ${chunkName || 'chunk'}, rendering fallback:`, secondErr);
        return { default: (() => null) as unknown as T };
      }
    }
  });
}
