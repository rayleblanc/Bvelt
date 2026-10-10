/**
 * BVELT Offline Storage (IndexedDB Schema V2)
 * Manages local persistence for pending mutations, offline actions,
 * zero-prompt photo evidence, and cached Verified Records.
 */

import { ExifData } from './exifExtractor';
import { updateAppBadge } from './appBadging';

export const DB_NAME = 'bvelt_offline_db';
export const DB_VERSION = 21;

export interface PendingMutation {
  id: string;
  path: string;
  type: 'setDoc' | 'addDoc' | 'deleteDoc';
  data: any;
  timestamp: number; // Client mutation time for Last-Write-Wins (LWW)
  lwwTimestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

export interface OfflineAction {
  id: string;
  actionType: 'LEAD_STATUS_UPDATE' | 'REVIEW_RESPONSE' | 'ACTION_STEP_COMPLETE' | 'GBP_POST_QUEUE' | 'OPPORTUNITY_ACTION' | 'MESSAGING_OUTBOUND';
  payload: any;
  createdAt: number;
  lwwTimestamp: number;
  status: 'QUEUED_OFFLINE' | 'SYNCING' | 'RECONCILED' | 'CONFLICT_LWW_DROPPED';
  businessId?: string;
}

export interface OfflinePhotoRecord {
  id: string;
  businessId: string;
  category: 'JOB_PROOF' | 'GBP_UPDATE' | 'VISUAL_ESTIMATE' | 'REPUTATION_ASSET';
  caption?: string;
  blob: Blob;
  dataUrl?: string;
  exif: ExifData;
  createdAt: number;
  synced: boolean;
  cloudUrl?: string;
}

export interface CachedVerifiedRecord {
  entityId: string;
  recordData: any;
  cachedAt: number;
  headHash?: string;
  isValid?: boolean;
}

class BveltOfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported in this environment'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Pending Firestore Mutations
        if (!db.objectStoreNames.contains('pending_mutations')) {
          const store = db.createObjectStore('pending_mutations', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 2. High-Level Offline Actions
        if (!db.objectStoreNames.contains('offline_actions')) {
          const store = db.createObjectStore('offline_actions', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }

        // 3. Zero-Prompt Offline Photos with EXIF
        if (!db.objectStoreNames.contains('offline_photos')) {
          const store = db.createObjectStore('offline_photos', { keyPath: 'id' });
          store.createIndex('businessId', 'businessId', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }

        // 4. Cached Public Verified Records
        if (!db.objectStoreNames.contains('cached_records')) {
          db.createObjectStore('cached_records', { keyPath: 'entityId' });
        }

        // 5. Generic Snapshots (Market checks, CRM cache)
        if (!db.objectStoreNames.contains('cached_snapshots')) {
          db.createObjectStore('cached_snapshots', { keyPath: 'key' });
        }

        // 6. Key-value store fallback
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const requiredStores = ['pending_mutations', 'offline_actions', 'offline_photos', 'cached_records', 'cached_snapshots', 'store'];
        const hasAllStores = requiredStores.every(s => db.objectStoreNames.contains(s));
        if (!hasAllStores) {
          const nextVer = (db.version || DB_VERSION) + 1;
          db.close();
          const upReq = window.indexedDB.open(DB_NAME, nextVer);
          upReq.onupgradeneeded = (ev) => {
            const udb = (ev.target as IDBOpenDBRequest).result;
            requiredStores.forEach(s => {
              if (!udb.objectStoreNames.contains(s)) {
                if (s === 'pending_mutations' || s === 'offline_actions' || s === 'offline_photos') {
                  udb.createObjectStore(s, { keyPath: 'id' });
                } else if (s === 'cached_records') {
                  udb.createObjectStore(s, { keyPath: 'entityId' });
                } else if (s === 'cached_snapshots') {
                  udb.createObjectStore(s, { keyPath: 'key' });
                } else {
                  udb.createObjectStore(s);
                }
              }
            });
          };
          upReq.onsuccess = () => resolve(upReq.result);
          upReq.onerror = () => resolve(db);
          return;
        }
        resolve(db);
      };

      request.onerror = () => {
        const err = request.error;
        console.warn('[OfflineStore] IndexedDB open error (attempting safe versionless fallback):', err?.name, err?.message);
        try {
          const retryReq = window.indexedDB.open(DB_NAME);
          retryReq.onsuccess = () => {
            resolve(retryReq.result);
          };
          retryReq.onerror = () => {
            reject(err || retryReq.error);
          };
        } catch (e) {
          reject(err || e);
        }
      };
    });

    return this.dbPromise;
  }

  // --- Pending Mutations Store ---

  async savePendingMutation(mutation: Omit<PendingMutation, 'retries' | 'status' | 'lwwTimestamp'>): Promise<void> {
    const db = await this.getDB();
    const fullMutation: PendingMutation = {
      ...mutation,
      lwwTimestamp: mutation.timestamp || Date.now(),
      retries: 0,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_mutations', 'readwrite');
      const store = tx.objectStore('pending_mutations');
      const req = store.put(fullMutation);
      req.onsuccess = () => {
        this.notifyPendingChanges();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllPendingMutations(): Promise<PendingMutation[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_mutations', 'readonly');
      const store = tx.objectStore('pending_mutations');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deletePendingMutation(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_mutations', 'readwrite');
      const store = tx.objectStore('pending_mutations');
      const req = store.delete(id);
      req.onsuccess = () => {
        this.notifyPendingChanges();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Offline Actions Store ---

  async queueOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt' | 'lwwTimestamp' | 'status'> & { id?: string }): Promise<OfflineAction> {
    const db = await this.getDB();
    const actionId = action.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    const queuedAction: OfflineAction = {
      id: actionId,
      actionType: action.actionType,
      payload: action.payload,
      businessId: action.businessId,
      createdAt: now,
      lwwTimestamp: now,
      status: 'QUEUED_OFFLINE'
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_actions', 'readwrite');
      const store = tx.objectStore('offline_actions');
      const req = store.put(queuedAction);
      req.onsuccess = () => {
        this.notifyPendingChanges();
        resolve(queuedAction);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getQueuedActions(): Promise<OfflineAction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_actions', 'readonly');
      const store = tx.objectStore('offline_actions');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflineAction[] = req.result || [];
        resolve(all.filter(a => a.status === 'QUEUED_OFFLINE'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async markActionReconciled(actionId: string, status: 'RECONCILED' | 'CONFLICT_LWW_DROPPED' = 'RECONCILED'): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_actions', 'readwrite');
      const store = tx.objectStore('offline_actions');
      const getReq = store.get(actionId);
      getReq.onsuccess = () => {
        const item: OfflineAction = getReq.result;
        if (item) {
          item.status = status;
          store.put(item);
        }
        this.notifyPendingChanges();
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- Zero-Prompt Photo Store ---

  async saveOfflinePhoto(photo: Omit<OfflinePhotoRecord, 'id' | 'createdAt' | 'synced'>): Promise<OfflinePhotoRecord> {
    const db = await this.getDB();
    const id = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullPhoto: OfflinePhotoRecord = {
      ...photo,
      id,
      createdAt: Date.now(),
      synced: false
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_photos', 'readwrite');
      const store = tx.objectStore('offline_photos');
      const req = store.put(fullPhoto);
      req.onsuccess = () => {
        this.notifyPendingChanges();
        resolve(fullPhoto);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getUnsyncedPhotos(businessId?: string): Promise<OfflinePhotoRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_photos', 'readonly');
      const store = tx.objectStore('offline_photos');
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflinePhotoRecord[] = req.result || [];
        const filtered = all.filter(p => !p.synced && (!businessId || p.businessId === businessId));
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async markPhotoSynced(photoId: string, cloudUrl?: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_photos', 'readwrite');
      const store = tx.objectStore('offline_photos');
      const getReq = store.get(photoId);
      getReq.onsuccess = () => {
        const item: OfflinePhotoRecord = getReq.result;
        if (item) {
          item.synced = true;
          if (cloudUrl) item.cloudUrl = cloudUrl;
          store.put(item);
        }
        this.notifyPendingChanges();
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- Verified Records Cache ---

  async cacheVerifiedRecord(entityId: string, recordData: any, headHash?: string, isValid: boolean = true): Promise<void> {
    const db = await this.getDB();
    const item: CachedVerifiedRecord = {
      entityId,
      recordData,
      cachedAt: Date.now(),
      headHash,
      isValid
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_records', 'readwrite');
      const store = tx.objectStore('cached_records');
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedVerifiedRecord(entityId: string): Promise<CachedVerifiedRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_records', 'readonly');
      const store = tx.objectStore('cached_records');
      const req = store.get(entityId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Generic Snapshots (Market Checks & CRM Data) ---

  async setSnapshot(key: string, data: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_snapshots', 'readwrite');
      const store = tx.objectStore('cached_snapshots');
      const req = store.put({ key, data, cachedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSnapshot<T = any>(key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_snapshots', 'readonly');
      const store = tx.objectStore('cached_snapshots');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Attention Badge Calculation ---

  async getPendingCount(): Promise<number> {
    try {
      const mutations = await this.getAllPendingMutations();
      const actions = await this.getQueuedActions();
      const photos = await this.getUnsyncedPhotos();
      return mutations.length + actions.length + photos.length;
    } catch {
      return 0;
    }
  }

  async notifyPendingChanges() {
    if (typeof window === 'undefined') return;
    try {
      const count = await this.getPendingCount();
      updateAppBadge(count);
      window.dispatchEvent(new CustomEvent('bvelt-offline-queue-changed', { detail: { count } }));
    } catch (e) {
      console.debug('[OfflineStore] Error updating badge count:', e);
    }
  }
}

export const offlineStore = new BveltOfflineStore();
