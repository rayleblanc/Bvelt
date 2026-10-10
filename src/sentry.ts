/// <reference types="vite/client" />
import * as Sentry from '@sentry/react';

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key];
    }
  } catch {
    // Ignore meta env errors
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const dsn =
  getEnvVar('VITE_SENTRY_DSN') ||
  getEnvVar('SENTRY_DSN') ||
  'https://548ff0f8215c0f5f0e37f11febafe338@o4511861895331840.ingest.us.sentry.io/4511861918662656';

export function initClientSentry() {
  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1.0,
      ignoreErrors: [
        'WebSocket',
        'vite',
        'websocket',
        'Failed to fetch',
        'NetworkError'
      ]
    });
    console.log('[Sentry Client] Initialized successfully.');
  } else {
    console.log('[Sentry Client] DSN missing, skipping initialization.');
  }
}

export { Sentry };

