/**
 * BVELT Offline Sync & Last-Write-Wins (LWW) Conflict Engine
 * Coordinates background sync, mutation replaying, LWW conflict resolution,
 * and photo evidence synchronization.
 */

import { offlineStore, PendingMutation, OfflineAction, OfflinePhotoRecord } from './offlineStore';
import { getFirebaseDB } from '../firebase';
import { doc, getDoc, setDoc as firestoreSetDoc, addDoc as firestoreAddDoc, collection, serverTimestamp } from 'firebase/firestore';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

class BveltOfflineSyncEngine {
  private isSyncing = false;
  private syncListeners: ((state: SyncState, pendingCount: number) => void)[] = [];
  private currentState: SyncState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineSync] Network online detected. Triggering sync...');
        this.syncAll();
      });

      window.addEventListener('offline', () => {
        console.log('[OfflineSync] Network offline detected.');
        this.setState('offline');
      });

      // Listen to Service Worker TRIGGER_SYNC_FIRESTORE messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'TRIGGER_SYNC_FIRESTORE') {
            console.log('[OfflineSync] Received TRIGGER_SYNC_FIRESTORE from Service Worker.');
            this.syncAll();
          }
        });
      }
    }
  }

  public init() {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncAll();
    }
  }

  public destroy() {
    this.syncListeners = [];
  }

  public subscribe(listener: (state: SyncState, pendingCount: number) => void): () => void {
    this.syncListeners.push(listener);
    offlineStore.getPendingCount().then((count) => listener(this.currentState, count));
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private async setState(state: SyncState) {
    this.currentState = state;
    const count = await offlineStore.getPendingCount();
    this.syncListeners.forEach((l) => l(state, count));
  }

  /**
   * Registers a Background Sync event with the Service Worker if supported.
   */
  public async registerBackgroundSync(tag = 'sync-pending-requests'): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration && typeof (registration as any).sync.register === 'function') {
        await (registration as any).sync.register(tag);
        console.log(`[OfflineSync] Background Sync registered with tag: ${tag}`);
        return true;
      }
    } catch (err) {
      console.debug('[OfflineSync] Background Sync registration not supported/failed:', err);
    }
    return false;
  }

  /**
   * Main sync orchestration method
   */
  public async syncAll(): Promise<{ success: boolean; syncedCount: number; conflictCount: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState('offline');
      return { success: false, syncedCount: 0, conflictCount: 0 };
    }

    if (this.isSyncing) {
      console.log('[OfflineSync] Sync already in progress, skipping duplicate run.');
      return { success: true, syncedCount: 0, conflictCount: 0 };
    }

    this.isSyncing = true;
    await this.setState('syncing');

    let syncedCount = 0;
    let conflictCount = 0;

    try {
      const db = getFirebaseDB();
      if (!db) {
        console.warn('[OfflineSync] Firebase DB instance not available, aborting sync.');
        this.isSyncing = false;
        await this.setState(navigator.onLine ? 'synced' : 'offline');
        return { success: false, syncedCount: 0, conflictCount: 0 };
      }

      // 1. Replay Pending Firestore Mutations with Last-Write-Wins (LWW)
      const mutations = await offlineStore.getAllPendingMutations();
      mutations.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      for (const mut of mutations) {
        try {
          const lwwResult = await this.replayMutationWithLWW(db, mut);
          if (lwwResult.status === 'APPLIED') {
            syncedCount++;
          } else if (lwwResult.status === 'LWW_DROPPED') {
            conflictCount++;
            console.log(`[OfflineSync] Mutation ${mut.id} dropped under LWW rule (server doc has newer timestamp).`);
          }
          await offlineStore.deletePendingMutation(mut.id);
        } catch (mutErr) {
          console.error(`[OfflineSync] Failed replaying mutation ${mut.id}:`, mutErr);
        }
      }

      // 2. Replay Queued Offline High-Level Actions
      const actions = await offlineStore.getQueuedActions();
      for (const action of actions) {
        try {
          await this.replayOfflineAction(db, action);
          await offlineStore.markActionReconciled(action.id, 'RECONCILED');
          syncedCount++;
        } catch (actErr) {
          console.error(`[OfflineSync] Failed executing queued action ${action.id}:`, actErr);
        }
      }

      // 3. Sync Offline Photos with EXIF Evidence
      const photos = await offlineStore.getUnsyncedPhotos();
      for (const photo of photos) {
        try {
          await this.syncOfflinePhotoEvidence(db, photo);
          await offlineStore.markPhotoSynced(photo.id);
          syncedCount++;
        } catch (photoErr) {
          console.error(`[OfflineSync] Failed syncing photo ${photo.id}:`, photoErr);
        }
      }

      await this.setState('synced');
      console.log(`[OfflineSync] Sync complete. Applied: ${syncedCount}, LWW Dropped: ${conflictCount}`);
      return { success: true, syncedCount, conflictCount };
    } catch (err) {
      console.warn('[OfflineSync] syncAll encountered an error (failing soft, will retry on next cycle):', err);
      await this.setState('error');
      return { success: false, syncedCount, conflictCount };
    } finally {
      this.isSyncing = false;
      await offlineStore.notifyPendingChanges();
    }
  }

  /**
   * Replays a Firestore mutation enforcing Last-Write-Wins (LWW)
   */
  private async replayMutationWithLWW(
    db: any, 
    mut: PendingMutation
  ): Promise<{ status: 'APPLIED' | 'LWW_DROPPED' | 'ERROR' }> {
    const docRef = doc(db, mut.path);

    // Read current server state to compare LWW timestamp
    let serverDocData: any = null;
    try {
      const serverSnap = await getDoc(docRef);
      if (serverSnap.exists()) {
        serverDocData = serverSnap.data();
      }
    } catch (readErr) {
      console.debug(`[OfflineSync] Could not read server doc at ${mut.path}, proceeding with write:`, readErr);
    }

    // Compare timestamps for LWW
    if (serverDocData) {
      const serverTime = serverDocData._timestamp || serverDocData.updatedAt || serverDocData.lastModified;
      let serverMillis = 0;

      if (serverTime) {
        if (typeof serverTime === 'number') {
          serverMillis = serverTime;
        } else if (serverTime.toMillis && typeof serverTime.toMillis === 'function') {
          serverMillis = serverTime.toMillis();
        } else if (typeof serverTime === 'string') {
          serverMillis = Date.parse(serverTime) || 0;
        }
      }

      // If server version is strictly newer than our offline modification, drop stale write
      if (serverMillis > 0 && serverMillis > (mut.lwwTimestamp || mut.timestamp)) {
        return { status: 'LWW_DROPPED' };
      }
    }

    // Apply write with merged metadata
    const payload = {
      ...mut.data,
      _lwwReconciledAt: Date.now(),
      _lastOfflineLwwTimestamp: mut.lwwTimestamp || mut.timestamp
    };

    if (mut.type === 'setDoc') {
      await firestoreSetDoc(docRef, payload, { merge: true });
    } else if (mut.type === 'addDoc') {
      const pathSegments = (mut.path || '').split('/').filter(Boolean);
      if (pathSegments.length % 2 === 0) {
        await firestoreSetDoc(docRef, payload, { merge: true });
      } else {
        const colRef = collection(db, mut.path);
        await firestoreAddDoc(colRef, payload);
      }
    }

    return { status: 'APPLIED' };
  }

  /**
   * Replays a high-level queued action (lead update, review reply, checklist step)
   */
  private async replayOfflineAction(db: any, action: OfflineAction): Promise<void> {
    console.log(`[OfflineSync] Replaying high-level action: ${action.actionType}`, action.payload);

    if (action.actionType === 'LEAD_STATUS_UPDATE' && action.payload?.leadId) {
      const leadPath = action.payload.businessId 
        ? `businesses/${action.payload.businessId}/leads/${action.payload.leadId}`
        : `leads/${action.payload.leadId}`;
      const leadRef = doc(db, leadPath);
      await firestoreSetDoc(leadRef, {
        status: action.payload.newStatus,
        updatedAt: Date.now(),
        _reconciledFromOffline: true
      }, { merge: true });
    } else if (action.actionType === 'ACTION_STEP_COMPLETE' && action.payload?.stepId) {
      const roadmapPath = `businesses/${action.payload.businessId || 'default'}/roadmap_progress/${action.payload.stepId}`;
      const stepRef = doc(db, roadmapPath);
      await firestoreSetDoc(stepRef, {
        completed: true,
        completedAt: action.lwwTimestamp,
        _reconciledFromOffline: true
      }, { merge: true });
    } else if (action.actionType === 'MESSAGING_OUTBOUND' && action.payload?.recipientId && action.payload?.text) {
      console.log(`[OfflineSync] Replaying outbound messaging dispatch to ${action.payload.recipientId}`);
      const res = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: action.payload.channel || 'whatsapp',
          recipientId: action.payload.recipientId,
          text: action.payload.text,
          businessId: action.payload.businessId || action.businessId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(`Offline messaging replay failed: ${err.error || res.statusText}`);
      }

      if (db && action.payload.messageId) {
        const msgPath = `businesses/${action.payload.businessId || 'default'}/outbound_messages/${action.payload.messageId}`;
        const msgRef = doc(db, msgPath);
        await firestoreSetDoc(msgRef, {
          status: 'SENT',
          sentAt: new Date().toISOString(),
          _reconciledFromOffline: true
        }, { merge: true });
      }
    }
  }

  /**
   * Syncs an offline photo evidence record
   */
  private async syncOfflinePhotoEvidence(db: any, photo: OfflinePhotoRecord): Promise<void> {
    console.log(`[OfflineSync] Syncing offline photo evidence for business: ${photo.businessId}`);
    
    // Store evidence metadata in business evidence collection
    const evidenceCol = collection(db, `businesses/${photo.businessId || 'default'}/evidence_records`);
    await firestoreAddDoc(evidenceCol, {
      type: 'PHOTO_EVIDENCE',
      category: photo.category,
      caption: photo.caption || 'Captured via BVELT Zero-Prompt Offline Capture',
      exif: {
        dateTime: photo.exif.dateTime,
        latitude: photo.exif.latitude,
        longitude: photo.exif.longitude,
        altitude: photo.exif.altitude,
        camera: photo.exif.model || photo.exif.make || 'Device Camera',
        hasGps: photo.exif.hasGps,
        source: photo.exif.source
      },
      createdAt: photo.createdAt,
      syncedAt: Date.now(),
      status: 'VERIFIED_OFFLINE_RECEIPT'
    });
  }
}

export const offlineSyncEngine = new BveltOfflineSyncEngine();
