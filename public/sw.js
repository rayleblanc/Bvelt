// Active Version: PWA Service Worker v1.4.3 (Resilient Immutable Chunk Caching & Error Recovery)

const CACHE_VERSION = 'v40-resilient';
const CACHE_NAME = `bvelt-${CACHE_VERSION}`;
const DATA_CACHE_NAME = 'bvelt-data-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/bvelt-icon-192.png',
  '/bvelt-icon-512.png',
  '/bvelt-icon-maskable-192.png',
  '/bvelt-icon-maskable-512.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg'
];

// Import and configure the Firebase SDK (compat style for Service Worker environment compatibility)
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    projectId: "localflowpro-20e3d",
    appId: "1:284563852580:web:41bf98a4d8da54093c77b1",
    apiKey: "AIzaSyDP0a3Xv274CqoAvEjR0t5vztV70oGaSqk",
    authDomain: "localflowpro-20e3d.firebaseapp.com",
    storageBucket: "localflowpro-20e3d.firebasestorage.app",
    messagingSenderId: "284563852580",
  });

  const messaging = firebase.messaging();

  // Background Messages handler via Firebase Messaging
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message via FCM:', payload);
    const title = payload.notification?.title || payload.data?.title || '🚨 Nuevo de Bvelt';
    const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva actualización pendiente.';
    const icon = payload.notification?.icon || '/bvelt-icon-192.png';
    
    const options = {
      body: body,
      icon: icon,
      badge: '/favicon.png',
      data: payload.data || {}
    };
    
    self.registration.showNotification(title, options);
  });
} catch (error) {
  console.warn("FCM compat scripts import failed or was skipped (might be offline):", error);
}

// Service Worker Installation (Fail-Open asset pre-caching)
self.addEventListener('install', (event) => {
  console.log('[sw.js] Installing new Service Worker version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Fail-open caching: cache available assets without failing the entire installation if one 404s
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'no-cache' });
            if (res && res.ok) {
              await cache.put(asset, res);
            }
          } catch (fetchErr) {
            console.warn('[sw.js] Pre-caching skipped for:', asset, fetchErr);
          }
        })
      );
    })
  );
  // Force active state immediately without waiting for previous SW to shut down
  self.skipWaiting();
});

// Service Worker Activation & Immediate Cache Cleanup
self.addEventListener('activate', (event) => {
  console.log('[sw.js] Activating Service Worker & purging stale caches...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log('[sw.js] Purging obsolete cache key:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      // Claim all open PWA windows/clients immediately
      return self.clients.claim();
    })
  );
});

// Handle incoming control messages from main client (SKIP_WAITING, CLEAR_CACHE, CACHE_OFFLINE_DATA)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[sw.js] SKIP_WAITING received from client. Activating immediately.');
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_OLD_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== DATA_CACHE_NAME).map((k) => caches.delete(k)))
      )
    );
  }

  if (event.data.type === 'CACHE_OFFLINE_DATA') {
    const { leads, transactions } = event.data;
    caches.open(DATA_CACHE_NAME).then((cache) => {
      if (leads) {
        cache.put('/api/offline/leads', new Response(JSON.stringify(leads), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      if (transactions) {
        cache.put('/api/offline/transactions', new Response(JSON.stringify(transactions), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    });
  }
});

// Fetch Interceptor for Caching and Network-First Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // 1. Bypass Service Worker entirely (network only) for OpenStreetMap tiles, Firebase Auth handlers (/__/*), and external origins
  if (url.pathname.startsWith('/__/')) {
    // CRITICAL: Never intercept Firebase Auth handlers (/__/auth/handler, etc.)
    return;
  }

  const isMapTile = url.hostname.includes('tile.openstreetmap.org') ||
                    url.hostname.includes('openstreetmap.org') ||
                    url.hostname.includes('cartocdn.com') ||
                    url.hostname.includes('mapbox.com') ||
                    url.hostname.includes('arcgisonline.com');
  const isExternal = url.origin !== self.location.origin;

  if (isMapTile || (isExternal && !url.pathname.includes('/api/offline/'))) {
    // Returning without calling event.respondWith lets the browser perform native network fetch
    return;
  }

  // 1.5 Bypass ServiceWorker completely for all backend API endpoints (except offline cache routes)
  // Ensures /api/plan/usage, /api/verify-session, /api/overpass-proxy, etc. communicate directly with the backend
  if (url.pathname.startsWith('/api/') && 
      !url.pathname.startsWith('/api/leads') && 
      !url.pathname.startsWith('/api/transactions') && 
      !url.pathname.startsWith('/api/business/') && 
      !url.pathname.startsWith('/api/offline/')) {
    return;
  }

  // 2. Bypass SW cache for manifest.json, sw.js, and brand icons to ensure immediate brand updates
  const isBrandIconOrManifest = url.pathname === '/manifest.json' || 
                                url.pathname === '/sw.js' ||
                                url.pathname.includes('bvelt-icon') ||
                                url.pathname.includes('icon-') ||
                                url.pathname.includes('apple-touch-icon') ||
                                url.pathname.includes('favicon');

  if (isBrandIconOrManifest) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Special offline fallback for leads, transactions, and verified evidence API endpoints
  if (url.pathname.startsWith('/api/leads') || url.pathname.startsWith('/api/transactions') || (url.pathname.startsWith('/api/business/') && !url.pathname.includes('/verify-session'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (url.pathname.includes('/api/business/') && url.pathname.includes('/evidence')) {
              return caches.match('/api/offline/evidence').then((offlineRes) => {
                if (offlineRes) return offlineRes;
                return new Response(JSON.stringify({ offline: true, error: 'OFFLINE_CACHED_UNAVAILABLE' }), {
                  headers: { 'Content-Type': 'application/json' }
                });
              });
            }
            const fallbackPath = url.pathname.includes('/api/leads') ? '/api/offline/leads' : '/api/offline/transactions';
            return caches.match(fallbackPath).then((offlineRes) => {
              if (offlineRes) return offlineRes;
              return new Response(JSON.stringify({ offline: true, data: [] }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
          });
        })
    );
    return;
  }

  // 4. Hashed Vite Assets (/assets/*.js, /assets/*.css)
  // Vite content-hashed assets are immutable.
  // Cache-First strategy ensures instant, offline-capable loading and prevents dynamic import chunk failures.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const contentType = networkResponse.headers.get('content-type') || '';
              // If SPA fallback served index.html instead of a missing JS module, do NOT cache or return as JS!
              if (url.pathname.endsWith('.js') && contentType.includes('text/html')) {
                return new Response('/* Chunk unavailable or stale */', {
                  status: 404,
                  statusText: 'Not Found',
                  headers: { 'Content-Type': 'application/javascript' }
                });
              }
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(async (fetchErr) => {
            console.warn('[sw.js] Failed to fetch hashed asset:', url.pathname, fetchErr);
            // Fallback: check across all open caches
            const fallbackCache = await caches.match(event.request);
            if (fallbackCache) return fallbackCache;

            // Return a safe 404 response rather than throwing unhandled TypeError into event.respondWith
            return new Response('/* Chunk unavailable or offline */', {
              status: 404,
              statusText: 'Not Found',
              headers: { 
                'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' 
              }
            });
          });
      })
    );
    return;
  }

  // 5. Network-First Strategy for HTML Navigation and Main Application Assets
  // Ensures mobile PWA users always receive the latest deployment from Vercel/Cloud Run
  const isNavigation = ((event.request.mode === 'navigate' ||
                        url.pathname === '/' ||
                        url.pathname === '/index.html' ||
                        (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')))) &&
                        !url.pathname.startsWith('/__/');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline) -> Serve cached version
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return (await caches.match('/')) || (await caches.match('/index.html'));
        })
    );
    return;
  }

  // 6. Network-First with Cache Fallback for general static assets (icons, images, fonts)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
          return new Response('/* Asset unavailable */', {
            status: 404,
            statusText: 'Not Found',
            headers: { 
              'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' 
            }
          });
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      })
  );
});

// a) Background Sync Event
self.addEventListener('sync', (event) => {
  console.log('[sw.js] Background sync event triggered with tag:', event.tag);
  if (event.tag === 'sync-pending-requests' || event.tag === 'sync-leads' || event.tag === 'sync-transactions' || event.tag === 'firestore-sync') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        const syncPromises = clientList.map((client) => {
          console.log('[sw.js] Notifying client to trigger Firestore sync:', client.url);
          client.postMessage({ type: 'TRIGGER_SYNC_FIRESTORE' });
        });
        return Promise.all(syncPromises);
      })
    );
  }
});

// b) Native Notification Push Event Handler
self.addEventListener('push', (event) => {
  console.log('[sw.js] Native push event received:', event);
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch (e) {
    payload = event.data ? { notification: { body: event.data.text() } } : null;
  }

  if (payload) {
    const title = payload.notification?.title || payload.data?.title || '🚨 Nuevo de Bvelt';
    const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva actualización pendiente.';
    const icon = payload.notification?.icon || '/bvelt-icon-192.png';
    
    const options = {
      body: body,
      icon: icon,
      badge: '/favicon.png',
      data: payload.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// b) Notification Click Event Handler (Redirect or Open PWA)
self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] Notification clicked:', event.notification);
  event.notification.close();

  let targetUrl = '/';
  if (event.notification.data) {
    const { tab, leadId, route, scanRadius, subRow } = event.notification.data;
    const rawTab = (tab || '').toLowerCase().trim();

    // MAPA Canonical Translations:
    // 1. Radar → leads + subRow (1)
    // 2. Retry radius → scan + run (dashboard with scanRadius and triggerScan: true)
    // 3. Answer Leads → lead (leads tab with subRow 4)
    // 4. Reviews → reviews (reviews tab, subRow 1)
    // 5. Estimator → estimator
    // 6. Upgrade → plans
    // 7. Cuota → profile
    // 8. Notification → tab + leadId
    if (leadId || rawTab === 'answer_leads' || rawTab === 'answer-leads') {
      targetUrl = `/?tab=leads&subRow=4&leadId=${encodeURIComponent(leadId || '')}`;
    } else if (rawTab === 'radar' || rawTab === 'prospecting_radar') {
      targetUrl = `/?tab=leads&subRow=${subRow !== undefined ? subRow : 1}`;
    } else if (rawTab === 'retry_radius' || scanRadius !== undefined) {
      targetUrl = `/?tab=dashboard&scanRadius=${scanRadius || 5}&triggerScan=true`;
    } else if (rawTab === 'reviews' || rawTab === 'review') {
      targetUrl = `/?tab=reviews&subRow=${subRow !== undefined ? subRow : 1}`;
    } else if (rawTab === 'estimator' || rawTab === 'quotes') {
      targetUrl = `/?tab=estimator`;
    } else if (rawTab === 'upgrade' || rawTab === 'plans') {
      targetUrl = `/?tab=plans`;
    } else if (rawTab === 'cuota' || rawTab === 'profile') {
      targetUrl = `/?tab=profile`;
    } else if (tab) {
      targetUrl = `/?tab=${encodeURIComponent(tab)}${subRow !== undefined ? `&subRow=${subRow}` : ''}`;
    } else if (route) {
      targetUrl = route;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there is an existing window open, focus it and notify it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data
            });
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
