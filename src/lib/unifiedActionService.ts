/**
 * Unified Action Record Service for Bvelt
 * Provides a unified schema and dual persistence (Firestore + localStorage)
 * for tracking executable actions with explicit user confirmation and persisted done states.
 * 
 * Schema: { id, type, status, createdAt, doneAt, meta, userId }
 */

import { auth, db } from './firebase';
import { doc, setDoc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { BusinessDnaService } from '../knowledge/memory/businessDnaService';

export type ActionRecordStatus = 'todo' | 'in_progress' | 'done' | 'dismissed';

export interface ActionRecordMeta {
  channel?: string;
  leadName?: string;
  leadPhone?: string;
  leadId?: string;
  revenue?: number;
  notes?: string;
  outcomeType?: string;
  source?: string;
  title?: string;
  day?: string;
  [key: string]: any;
}

export interface ActionRecord {
  id: string;
  userId?: string;
  type: string;
  status: ActionRecordStatus;
  createdAt: string;
  doneAt?: string | null;
  meta?: ActionRecordMeta;
}

const STORAGE_KEY = 'bvelt_unified_actions_v1';
export const ACTION_UPDATE_EVENT = 'bvelt_action_records_updated';

class UnifiedActionServiceImpl {
  private cache: Map<string, ActionRecord> = new Map();
  private isInitialized = false;
  private unsubscribeFirestore: (() => void) | null = null;
  private listeners: Set<(records: ActionRecord[]) => void> = new Set();
  private hasWarnedSync = false;
  private warnedActionKeys: Set<string> = new Set();

  constructor() {
    this.initLocalCache();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.initLocalCache();
          this.notifyListeners();
        }
      });

      // Listen to auth state changes to attach Firestore listener
      auth?.onAuthStateChanged?.((user) => {
        if (user) {
          this.attachFirestoreSync(user.uid);
        } else {
          if (this.unsubscribeFirestore) {
            this.unsubscribeFirestore();
            this.unsubscribeFirestore = null;
          }
        }
      });
    }
  }

  private initLocalCache() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ActionRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(rec => {
            if (rec && rec.id) {
              this.cache.set(rec.id, rec);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[UnifiedActionService] Error loading local cache:', e);
    }
    this.isInitialized = true;
  }

  private persistLocalCache() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.cache.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-300)));
    } catch (e) {
      console.warn('[UnifiedActionService] Error persisting to localStorage:', e);
    }
  }

  private notifyListeners() {
    const list = Array.from(this.cache.values());
    this.listeners.forEach(fn => {
      try {
        fn(list);
      } catch (err) {
        console.warn('[UnifiedActionService] Listener error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACTION_UPDATE_EVENT, {
        detail: { count: list.length }
      }));
    }
  }

  private attachFirestoreSync(uid: string) {
    if (!db || typeof window === 'undefined') return;
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
    }

    try {
      const userActionsRef = collection(db, 'users', uid, 'actions');
      this.unsubscribeFirestore = onSnapshot(userActionsRef, (snapshot) => {
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as Partial<ActionRecord>;
          if (data && data.id) {
            const current = this.cache.get(data.id);
            // Only update if newer or different
            if (!current || current.status !== data.status || current.doneAt !== data.doneAt) {
              const fullRecord: ActionRecord = {
                id: data.id,
                userId: uid,
                type: data.type || current?.type || 'action',
                status: (data.status as ActionRecordStatus) || 'todo',
                createdAt: data.createdAt || current?.createdAt || new Date().toISOString(),
                doneAt: data.doneAt ?? null,
                meta: data.meta || current?.meta || {}
              };
              this.cache.set(data.id, fullRecord);
              changed = true;
            }
          }
        });

        if (changed) {
          this.persistLocalCache();
          this.notifyListeners();
        }
      }, (err) => {
        if (!this.hasWarnedSync) {
          this.hasWarnedSync = true;
          console.warn('[UnifiedActionService] Firestore sync warning (using local cache):', err?.message || err);
        }
      });
    } catch (e) {
      if (!this.hasWarnedSync) {
        this.hasWarnedSync = true;
        console.warn('[UnifiedActionService] Error initializing Firestore snapshot:', e);
      }
    }
  }

  /**
   * Returns all stored action records
   */
  public getAllRecords(): ActionRecord[] {
    if (!this.isInitialized) this.initLocalCache();
    return Array.from(this.cache.values());
  }

  /**
   * Retrieves a single action record by ID
   */
  public getRecord(actionId: string): ActionRecord | undefined {
    if (!this.isInitialized) this.initLocalCache();
    return this.cache.get(actionId);
  }

  /**
   * Returns whether an action is marked as done
   */
  public isDone(actionId: string): boolean {
    const rec = this.getRecord(actionId);
    return rec?.status === 'done';
  }

  /**
   * Alias for isDone to support isActionDone nomenclature
   */
  public isActionDone(actionId: string): boolean {
    return this.isDone(actionId);
  }

  /**
   * Returns all action IDs that have status 'done'
   */
  public getDoneActionIds(): string[] {
    return this.getAllRecords()
      .filter(r => r.status === 'done')
      .map(r => r.id);
  }

  /**
   * Saves or updates an action record with full persistence
   */
  public async saveRecord(record: ActionRecord): Promise<ActionRecord> {
    const uid = auth?.currentUser?.uid || record.userId;
    const cleanRecord: ActionRecord = {
      id: record.id,
      userId: uid,
      type: record.type || 'action',
      status: record.status || 'todo',
      createdAt: record.createdAt || new Date().toISOString(),
      doneAt: record.status === 'done' ? (record.doneAt || new Date().toISOString()) : null,
      meta: record.meta || {}
    };

    // 1. Optimistic local update
    this.cache.set(cleanRecord.id, cleanRecord);
    this.persistLocalCache();
    this.notifyListeners();

    // 2. Persist to Firestore if available and logged in
    if (db && uid) {
      try {
        const userDocRef = doc(db, 'users', uid, 'actions', cleanRecord.id);
        const profileDocRef = doc(db, 'profiles', uid, 'actions', cleanRecord.id);
        const topDocRef = doc(db, 'actions', `${uid}_${cleanRecord.id}`);

        const payload: Record<string, any> = {
          id: cleanRecord.id,
          userId: uid,
          type: cleanRecord.type,
          status: cleanRecord.status,
          createdAt: cleanRecord.createdAt,
          doneAt: cleanRecord.doneAt,
          meta: cleanRecord.meta || {}
        };

        const results = await Promise.allSettled([
          setDoc(userDocRef, payload, { merge: true }),
          setDoc(profileDocRef, payload, { merge: true }),
          setDoc(topDocRef, payload, { merge: true })
        ]);

        results.forEach((res) => {
          if (res.status === 'rejected') {
            const err = res.reason;
            const errKey = `${cleanRecord.id}_${err?.code || 'error'}`;
            // Log only once per action key to avoid console spam
            if (!this.warnedActionKeys.has(errKey)) {
              this.warnedActionKeys.add(errKey);
              if (err?.code === 'permission-denied' || String(err?.message).includes('insufficient permissions')) {
                console.warn(`[UnifiedActionService] Firestore permission-denied for action ${cleanRecord.id}. Falling back cleanly to local cache.`);
              } else {
                console.warn(`[UnifiedActionService] Firestore non-fatal error for action ${cleanRecord.id}:`, err?.message || err);
              }
            }
          }
        });
      } catch (fsErr: any) {
        const errKey = `general_${cleanRecord.id}`;
        if (!this.warnedActionKeys.has(errKey)) {
          this.warnedActionKeys.add(errKey);
          console.warn('[UnifiedActionService] Firestore save error (local cache preserved):', fsErr?.message || fsErr);
        }
      }
    }

    return cleanRecord;
  }

  /**
   * Explicitly marks an action as done (requires user confirmation)
   */
  public async markActionDone(
    actionId: string, 
    type: string = 'action', 
    meta?: ActionRecordMeta
  ): Promise<ActionRecord> {
    const existing = this.getRecord(actionId);
    const now = new Date().toISOString();

    const updatedRecord: ActionRecord = {
      id: actionId,
      userId: auth?.currentUser?.uid || existing?.userId,
      type: type || existing?.type || 'action',
      status: 'done',
      createdAt: existing?.createdAt || now,
      doneAt: now,
      meta: {
        ...(existing?.meta || {}),
        ...(meta || {})
      }
    };

    const saved = await this.saveRecord(updatedRecord);

    // QUIET LEARNING: Write small memory record into BusinessDNA structure
    try {
      const activeUid = auth?.currentUser?.uid || existing?.userId || 'anonymous';
      BusinessDnaService.recordActionExecution(activeUid, {
        actionId: actionId,
        actionType: type || existing?.type || 'action',
        destination: meta?.channel || meta?.source || 'direct',
        executedAt: now
      });
    } catch (e) {
      console.warn('[Quiet Learning] Action execution record skipped:', e);
    }

    return saved;
  }

  /**
   * Marks an action as in progress
   */
  public async markActionInProgress(
    actionId: string, 
    type: string = 'action', 
    meta?: ActionRecordMeta
  ): Promise<ActionRecord> {
    const existing = this.getRecord(actionId);
    const now = new Date().toISOString();

    const updatedRecord: ActionRecord = {
      id: actionId,
      userId: auth?.currentUser?.uid || existing?.userId,
      type: type || existing?.type || 'action',
      status: 'in_progress',
      createdAt: existing?.createdAt || now,
      doneAt: null,
      meta: {
        ...(existing?.meta || {}),
        ...(meta || {})
      }
    };

    return this.saveRecord(updatedRecord);
  }

  /**
   * Toggles an action between todo and done
   */
  public async toggleActionDone(
    actionId: string, 
    type: string = 'action', 
    meta?: ActionRecordMeta
  ): Promise<ActionRecord> {
    const existing = this.getRecord(actionId);
    const isCurrentlyDone = existing?.status === 'done';
    const now = new Date().toISOString();

    const updatedRecord: ActionRecord = {
      id: actionId,
      userId: auth?.currentUser?.uid || existing?.userId,
      type: type || existing?.type || 'action',
      status: isCurrentlyDone ? 'todo' : 'done',
      createdAt: existing?.createdAt || now,
      doneAt: isCurrentlyDone ? null : now,
      meta: {
        ...(existing?.meta || {}),
        ...(meta || {})
      }
    };

    return this.saveRecord(updatedRecord);
  }

  /**
   * Marks an action as dismissed
   */
  public async markActionDismissed(
    actionId: string, 
    type: string = 'action', 
    meta?: ActionRecordMeta
  ): Promise<ActionRecord> {
    const existing = this.getRecord(actionId);
    const now = new Date().toISOString();

    const updatedRecord: ActionRecord = {
      id: actionId,
      userId: auth?.currentUser?.uid || existing?.userId,
      type: type || existing?.type || 'action',
      status: 'dismissed',
      createdAt: existing?.createdAt || now,
      doneAt: null,
      meta: {
        ...(existing?.meta || {}),
        ...(meta || {})
      }
    };

    return this.saveRecord(updatedRecord);
  }

  /**
   * Subscribes to real-time action record updates
   */
  public subscribe(callback: (records: ActionRecord[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getAllRecords());
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const UnifiedActionService = new UnifiedActionServiceImpl();
