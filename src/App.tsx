// En Bvelt, garantizamos la integridad y la confianza de su negocio local. 🚀
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ChangeEvent, ReactNode, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bolt, User2, MapPin, Flame, Moon, Sun, CreditCard, 
  Map as MapIcon, Image as ImageIcon, Filter, Calculator, 
  ChartLine, Settings, FileText, Gem, Share2, Trophy, Globe,
  Send, MessageSquare, Wand2, Copy, EyeOff, Star, X, Home,
  Mic, Camera, CheckCircle, Plus, Lock, LogIn, LogOut, Activity, CloudRain, MessageCircle, ThumbsUp, ArrowLeft, ArrowUp, Sparkles, Trash2, TrendingUp, Zap, Menu, ShieldCheck, ArrowRight, Briefcase,
  Play, Video, HelpCircle, ChevronDown, ChevronUp, ChevronRight, BookOpen, Square, AlertTriangle, Smartphone, Phone, Mail, DollarSign, AlertCircle, BellRing
, Store, Edit2, Sliders, Users, RefreshCw, Search, Printer, Download} from 'lucide-react';
import { 
  initFirebase, loginWithGoogle, checkRedirectResult, onAuthStateChanged, User, getFirebaseDB, getFirebaseAuth, getAccessToken, db, requestFcmToken, listenToFcmMessages, getHumanAuthErrorMessage
} from './lib/firebase';
import { DashboardView } from './components/DashboardView';
import { AutocompleteInput } from './components/AutocompleteInput';
import { CityAutocomplete, NicheAutocomplete } from './components/CityAutocomplete';
import { AppIcon } from './components/AppIcon';
import { Accordion } from './components/Accordion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Skeleton, CardSkeleton, ListSkeleton } from './components/Skeleton';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { ClientOpportunityCard, LocalBusinessOpportunityData } from './components/ClientOpportunityCard';
import { GeneratedPitchData } from './components/ClientPitchModal';
import { ClientAcquisitionLeadList, LeadStatusType } from './components/ClientAcquisitionLeadList';
import { NavLink } from './components/NavLink';
import type { OnboardingData } from './components/onboarding/BveltOnboardingWizard';
import { getScanUsageInfo, recordScanUsage } from './lib/scanLimiter';
import { parseRateLimitHeaders, updateQuotaFromServer } from './lib/rateLimitService';
import { RecoveryFeeService } from './services/recoveryFeeService';
import { PlanLimitModal } from './components/common/PlanLimitModal';
import { EVENT_LIMIT_REACHED, installGlobalFetchLimitInterceptor } from './lib/planLimits';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Install global fetch interceptor to catch any 429/403 LIMIT_REACHED responses app-wide
installGlobalFetchLimitInterceptor();

// Dynamic code splitting with auto-recovery for non-initial render views and heavy modals (Master Plan 7.8.1)
const BusinessScanView = lazyWithRetry(() => import('./components/BusinessScanView').then(m => ({ default: m.BusinessScanView })), 'BusinessScanView');
const GMBPostCanvas = lazyWithRetry(() => import('./components/GMBPostCanvas').then(m => ({ default: m.GMBPostCanvas })), 'GMBPostCanvas');
const NeighborhoodDirectory = lazyWithRetry(() => import('./components/NeighborhoodDirectory').then(m => ({ default: m.NeighborhoodDirectory })), 'NeighborhoodDirectory');
const MarketGrowthView = lazyWithRetry(() => import('./components/MarketGrowthView').then(m => ({ default: m.MarketGrowthView })), 'MarketGrowthView');
const WebsiteView = lazyWithRetry(() => import('./components/WebsiteView').then(m => ({ default: m.WebsiteView })), 'WebsiteView');
const PublicLandingPage = lazyWithRetry(() => import('./components/PublicLandingPage').then(m => ({ default: m.PublicLandingPage })), 'PublicLandingPage');
const AboutPage = lazyWithRetry(() => import('./components/AboutPage').then(m => ({ default: m.AboutPage })), 'AboutPage');
const PublicTemplatePage = lazyWithRetry(() => import('./components/PublicTemplatePage').then(m => ({ default: m.PublicTemplatePage })), 'PublicTemplatePage');
const VisualEstimator = lazyWithRetry(() => import('./components/VisualEstimator').then(m => ({ default: m.VisualEstimator })), 'VisualEstimator');
const ReputationShieldPage = lazyWithRetry(() => import('./components/ReputationShieldPage').then(m => ({ default: m.ReputationShieldPage })), 'ReputationShieldPage');
const ReactivationCRM = lazyWithRetry(() => import('./components/ReactivationCRM').then(m => ({ default: m.ReactivationCRM })), 'ReactivationCRM');
const GBPAuditChecklist = lazyWithRetry(() => import('./components/GBPAuditChecklist').then(m => ({ default: m.GBPAuditChecklist })), 'GBPAuditChecklist');
const Confetti = lazyWithRetry(() => import('./components/Confetti').then(m => ({ default: m.Confetti })), 'Confetti');
const PublicFreeAuditPage = lazyWithRetry(() => import('./components/PublicFreeAuditPage').then(m => ({ default: m.PublicFreeAuditPage })), 'PublicFreeAuditPage');
const PublicVerifiedRecordPage = lazyWithRetry(() => import('./components/PublicVerifiedRecordPage').then(m => ({ default: m.PublicVerifiedRecordPage })), 'PublicVerifiedRecordPage');
const PublicSnapshotView = lazyWithRetry(() => import('./components/PublicSnapshotView').then(m => ({ default: m.PublicSnapshotView })), 'PublicSnapshotView');
const PublicReportFunnelPage = lazyWithRetry(() => import('./components/PublicReportFunnelPage').then(m => ({ default: m.PublicReportFunnelPage })), 'PublicReportFunnelPage');
const OnboardingMission = lazyWithRetry(() => import('./components/OnboardingMission').then(m => ({ default: m.OnboardingMission })), 'OnboardingMission');
const BveltOnboardingWizard = lazyWithRetry(() => import('./components/onboarding/BveltOnboardingWizard').then(m => ({ default: m.BveltOnboardingWizard })), 'BveltOnboardingWizard');
const ClientPitchModal = lazyWithRetry(() => import('./components/ClientPitchModal'), 'ClientPitchModal');
const ProspectingRadar = lazyWithRetry(() => import('./components/ProspectingRadar').then(m => ({ default: m.ProspectingRadar })), 'ProspectingRadar');
const OperatorProspectFunnel = lazyWithRetry(() => import('./components/dashboard/OperatorProspectFunnel').then(m => ({ default: m.OperatorProspectFunnel })), 'OperatorProspectFunnel');
const PlansView = lazyWithRetry(() => import('./components/PlansView').then(m => ({ default: m.PlansView })), 'PlansView');
import { PlanLimitsCard } from './components/settings/PlanLimitsCard';
import { ReferralInviteCard } from './components/dashboard/ReferralInviteCard';
import { ReferralRewardService } from './services/referralRewardService';
import { SealedJobEvidenceWaitlistCard } from './components/SealedJobEvidenceWaitlistCard';
import { routeToAnswerLeads, getActionableLeadsAwaitingReply, isBusinessLead } from './lib/navigation/routeToAnswerLeads';
import { navigateTo, ResolvedNavigation } from './lib/navigation/navigateTo';
import { resolveVoiceIntent, parseLocalVoiceIntent, VoiceIntentType } from './lib/voiceIntent';
import { getTopPriorityItem, dismissPriority, isPriorityDismissed, PriorityItem } from './services/priorityQueueService';
import { notifyOwner } from './services/ownerNotifier';
import { recordBveltEvent } from './knowledge/memory/bemStore';

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[300px] p-8 space-y-4">
    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cargando módulo Bvelt...</span>
  </div>
);
import { LeadQualityEngine } from './knowledge/engine/leadQualityEngine';
import { ReviewComplianceFirewall } from './knowledge/memory/reviewComplianceFirewall';

import { PWAInstallButton } from './components/pwa/PWAInstallButton';
import { PWAInstallBanner } from './components/pwa/PWAInstallBanner';
import { OfflineIndicatorBanner } from './components/pwa/OfflineIndicatorBanner';
import { ZeroPromptPhotoCapture } from './components/pwa/ZeroPromptPhotoCapture';
import { offlineSyncEngine } from './lib/pwa/offlineSync';
import { updateAppBadge, clearAppBadge } from './lib/pwa/appBadging';

import { useSwipeable } from 'react-swipeable';
import { 
  doc, setDoc as originalSetDoc, getDoc, collection, addDoc as originalAddDoc, query, where, getDocs, onSnapshot, limit, disableNetwork, arrayUnion, serverTimestamp
} from 'firebase/firestore';
import { recordFirestoreOp, trackBveltEvent } from './lib/bveltObservability';

// Safe IndexedDB with auto-migration and memory fallback
export const openSafeIDB = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const handleUpgradeNeeded = (db: IDBDatabase) => {
      try {
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
        if (!db.objectStoreNames.contains('pending_mutations')) {
          db.createObjectStore('pending_mutations', { keyPath: 'id' });
        }
      } catch (upErr) {
        console.warn("[IndexedDB] upgrade error:", upErr);
      }
    };

    const tryOpenWithFallback = () => {
      try {
        const fallbackReq = window.indexedDB.open('lf_fallback_db');
        fallbackReq.onsuccess = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains('store') || !db.objectStoreNames.contains('pending_mutations')) {
            const nextVer = (db.version || 1) + 1;
            db.close();
            const upReq = window.indexedDB.open('lf_fallback_db', nextVer);
            upReq.onupgradeneeded = (ev: any) => handleUpgradeNeeded(ev.target.result);
            upReq.onsuccess = (ev: any) => resolve(ev.target.result);
            upReq.onerror = () => resolve(null);
            return;
          }
          resolve(db);
        };
        fallbackReq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };

    try {
      const request = window.indexedDB.open('lf_fallback_db', 5);
      request.onupgradeneeded = (e) => {
        handleUpgradeNeeded((e.target as any).result as IDBDatabase);
      };
      request.onsuccess = (e) => {
        try {
          const db = (e.target as any).result as IDBDatabase;
          if (!db.objectStoreNames.contains('store') || !db.objectStoreNames.contains('pending_mutations')) {
            const nextVer = (db.version || 5) + 1;
            db.close();
            const upReq = window.indexedDB.open('lf_fallback_db', nextVer);
            upReq.onupgradeneeded = (ev: any) => handleUpgradeNeeded(ev.target.result);
            upReq.onsuccess = (ev: any) => resolve(ev.target.result);
            upReq.onerror = () => resolve(null);
            return;
          }
          resolve(db);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => {
        tryOpenWithFallback();
      };
    } catch {
      tryOpenWithFallback();
    }
  });
};

// Proxy wrappers to implement retry backoff + jitter, telemetry and IndexedDB fallback queue
export const setDoc = async (reference: any, data: any, options?: any, attempt: number = 1): Promise<any> => {
  const maxAttempts = 5;
  try {
    recordFirestoreOp('write', reference?.path || 'unknown', 1);
    return await originalSetDoc(reference, data, options);
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isQuota = errMsg.toLowerCase().includes("quota") || 
                    errMsg.toLowerCase().includes("exhausted") || 
                    errMsg.toLowerCase().includes("resource-exhausted") || 
                    error?.code === "resource-exhausted" ||
                    error?.code === "8";

    if (isQuota && attempt <= maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`[Firestore Quota] setDoc failed. Attempt ${attempt}/${maxAttempts}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return setDoc(reference, data, options, attempt + 1);
    }

    // Queue in IndexedDB fallback queue
    console.warn(`[Firestore Offline/Quota] setDoc failed permanently. Queueing write to IndexedDB pending_mutations...`);
    openSafeIDB().then(idb => {
      if (!idb) return;
      if (idb.objectStoreNames.contains("pending_mutations")) {
        const transaction = idb.transaction(["pending_mutations"], "readwrite");
        const store = transaction.objectStore("pending_mutations");
        
        // Write-Coalescing: use reference.path as the key so that subsequent updates offline overwrite previous ones
        const itemKey = reference.path || 'unknown';
        store.put({
          id: itemKey,
          path: reference.path || 'unknown',
          type: 'setDoc',
          data: JSON.parse(JSON.stringify(data)),
          timestamp: Date.now()
        });
        
        if (typeof (window as any).updatePendingMutationsCount === 'function') {
          (window as any).updatePendingMutationsCount();
        }
      }
    }).catch(idbErr => {
      console.warn("Failed to queue setDoc write to IndexedDB:", idbErr);
    });
    throw error;
  }
};

export const addDoc = async (reference: any, data: any, docRefForRetry?: any, attempt: number = 1): Promise<any> => {
  const maxAttempts = 5;
  // ID Único en Cliente: generate a unique docRef on client BEFORE retry/sending to ensure absolute idempotency
  const docRef = docRefForRetry || doc(reference);
  try {
    recordFirestoreOp('write', docRef?.path || 'unknown', 1);
    await originalSetDoc(docRef, data);
    return docRef;
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isQuota = errMsg.toLowerCase().includes("quota") || 
                    errMsg.toLowerCase().includes("exhausted") || 
                    errMsg.toLowerCase().includes("resource-exhausted") || 
                    error?.code === "resource-exhausted" ||
                    error?.code === "8";

    if (isQuota && attempt <= maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`[Firestore Quota] addDoc failed. Attempt ${attempt}/${maxAttempts}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return addDoc(reference, data, docRef, attempt + 1);
    }

    // Queue in IndexedDB fallback queue
    console.warn(`[Firestore Offline/Quota] addDoc failed permanently. Queueing write to IndexedDB pending_mutations...`);
    openSafeIDB().then(idb => {
      if (!idb) return;
      if (idb.objectStoreNames.contains("pending_mutations")) {
        const transaction = idb.transaction(["pending_mutations"], "readwrite");
        const store = transaction.objectStore("pending_mutations");
        
        // Write-Coalescing: use docRef.path as the key so that subsequent updates offline overwrite previous ones
        const itemKey = docRef.path || 'unknown';
        store.put({
          id: itemKey,
          path: docRef.path || 'unknown',
          type: 'addDoc',
          data: JSON.parse(JSON.stringify(data)),
          timestamp: Date.now()
        });
        
        if (typeof (window as any).updatePendingMutationsCount === 'function') {
          (window as any).updatePendingMutationsCount();
        }
      }
    }).catch(idbErr => {
      console.warn("Failed to queue addDoc write to IndexedDB:", idbErr);
    });
    throw error;
  }
};

import { RouteLeafletMap } from './components/RouteLeafletMap';
import { executeAndSaveAgentScan, MultiAgentScanResponse, executeOnboardingHook, OnboardingHookOutput, executeRealCompetitorScraping } from './services/multiAgentService';
import { fetchWithRetry } from './lib/retryFetch';

// --- Global Constants ---
const STRIPE_RENEWAL_DAYS = 7;

const getHumanizedSystemInstruction = (baseInstruction: string, language: string, location?: string) => {
  const outputLanguageLabel = language === 'en' ? 'English' : 'Spanish';
  return `${baseInstruction || ""}

=========================================
CAPA DE ESTILO Y HUMANIZACIÓN OBLIGATORIA (HUMAN COMMUNICATION FILTER - LAYER 2):
=========================================
You are a highly skilled professional human business copywriter and local service specialist. Your absolute goal is to generate or rewrite this content so that it sounds 100% written by a real person (a friendly, highly professional local contractor/business owner) and NOT by an AI or bot.

[CAPA DE ESTILO - PROHIBICIÓN ABSOLUTA DE PALABRAS Y CLICHÉS DE IA / BANNED WORDS & PATTERNS]:
1. PROHIBICIÓN ESTRICTA Y ABSOLUTA DE PALABRAS: Queda strictly prohibido utilizar o mencionar palabras como "IA", "AI", "Agente", "Agent", "Bot", "Robot", "Asistente Virtual", "Virtual Assistant", "Neural", "Algoritmo", "Algorithm", "Modelo de Lenguaje", "Language Model", "Inteligencia Artificial" o "Artificial Intelligence" en cualquier respuesta, texto o propuesta para el usuario.
2. NEVER use typical AI boilerplate or transition words:
   - In Spanish, NEVER say: "En el dinámico mundo de hoy", "En resumen", "Es fundamental", "Explora estas opciones", "Como modelo de lenguaje", "Espero que esto te sirva", "estimado cliente", "espero que este mensaje te encuentre bien".
   - In English, NEVER say: "In today's fast-paced world", "In conclusion", "It is crucial to", "Dive into", "Furthermore", "Delve", "Hope this helps", "Dear client", "I hope this finds you well", "As an AI".
3. NEVER use rigid bulleted lists or dry summaries unless explicitly asked for. Continuous natural text sounds much more human.
4. NEVER repeat the same sentence structure or verbs in consecutive paragraphs.
5. NEVER reference algorithms, AI, robots, automated systems, GPT, or Gemini.

[STRICT LANGUAGE & TONE RULE]
1. Adaptive Language: Always respond entirely in ${outputLanguageLabel}. Even if the system instruction or user prompt contains another language, translate it dynamically to ${outputLanguageLabel} with a native, local flow.
2. Conversational & Empathetic: Adopt a conversational, helpful, professional, and close tone (as if a proud local business owner/contractor is talking directly to a homeowner, client, or a respected colleague).
3. Sentence Variance: Mix short, punchy statements with medium-length sentences. Avoid robotic, symmetric, or predictable sentence structures.
4. Natural Transitions & Pauses: Introduce natural conversational transitions (e.g. in Spanish: "mira,", "por cierto,", "la verdad es que..."; in English: "look,", "by the way,", "honestly,").
5. Simplicity: Use clear, direct, and straightforward vocabulary. Avoid theoretical, rigid, academic, or overly formal explanations.
6. Mobile Friendly: Keep paragraphs extremely short (maximum 2 to 3 lines per paragraph) for optimal readability on mobile screens.
7. Tone/Role specifics:
   - If outputting in English, sound like a high-end, experienced, trustworthy local trade contractor from "${location || 'the local area'}" (HVAC, roofing, lawn-care, remodeling, home services). Do NOT use corporate boilerplate (like "I hope this email finds you well", "Dear Client", "As an AI..."). Be direct, warm, and highly professional.
   - If outputting in Spanish, sound like a proud, professional, and reliable Hispanic contractor speaking directly to local homeowners.

[OUTPUT CRITERIO]
Before finalizing the response, ensure that it reads like a real, authentic, fast message typed from a mobile phone by an expert in the field who cares deeply about their work and clients. If the output format requires a specific JSON schema, output a valid JSON where the keys are exactly as requested, but all the generated human-facing strings (such as actions, strategies, comments) are written in ${outputLanguageLabel} with these rules applied.`;
};

const initIndexedDBFallback = () => {
  if (typeof window === 'undefined') return;
  openSafeIDB().then((db) => {
    if (!db || !db.objectStoreNames?.contains?.('store')) return;
    try {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const getAllKeysReq = store.getAllKeys();
      getAllKeysReq.onsuccess = () => {
        const keys = getAllKeysReq.result;
        const getAllValuesReq = store.getAll();
        getAllValuesReq.onsuccess = () => {
          const values = getAllValuesReq.result;
          if (!(window as any).__fallback_storage) {
            (window as any).__fallback_storage = {};
          }
          keys.forEach((key: string, idx: number) => {
            (window as any).__fallback_storage[key] = values[idx];
          });
        };
      };
    } catch (txErr) {
      console.warn("IndexedDB read transaction failed safely:", txErr);
    }
  }).catch((err) => {
    console.warn("IndexedDB fallback init failed:", err);
  });
};

const writeToIndexedDB = (key: string, value: string) => {
  if (!(window as any).__fallback_storage) (window as any).__fallback_storage = {};
  (window as any).__fallback_storage[key] = value;
  openSafeIDB().then((db) => {
    if (!db || !db.objectStoreNames?.contains?.('store')) return;
    try {
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      store.put(value, key);
    } catch (txErr) {
      console.warn("IndexedDB write failed safely:", txErr);
    }
  }).catch(() => {});
};

const removeFromIndexedDB = (key: string) => {
  if ((window as any).__fallback_storage) {
    delete (window as any).__fallback_storage[key];
  }
  openSafeIDB().then((db) => {
    if (!db || !db.objectStoreNames?.contains?.('store')) return;
    try {
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      store.delete(key);
    } catch (txErr) {
      console.warn("IndexedDB delete failed safely:", txErr);
    }
  }).catch(() => {});
};

const clearIndexedDB = () => {
  (window as any).__fallback_storage = {};
  openSafeIDB().then((db) => {
    if (!db || !db.objectStoreNames?.contains?.('store')) return;
    try {
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      store.clear();
    } catch (txErr) {
      console.warn("IndexedDB clear failed safely:", txErr);
    }
  }).catch(() => {});
};

if (typeof window !== 'undefined') {
  initIndexedDBFallback();
}

const getFromIndexedDB = (key: string): Promise<string | null> => {
  return new Promise((resolve) => {
    if ((window as any).__fallback_storage && (window as any).__fallback_storage[key] !== undefined) {
      return resolve((window as any).__fallback_storage[key]);
    }
    openSafeIDB().then((db) => {
      if (!db || !db.objectStoreNames?.contains?.('store')) {
        return resolve((window as any).__fallback_storage?.[key] || null);
      }
      try {
        const tx = db.transaction('store', 'readonly');
        const store = tx.objectStore('store');
        const getReq = store.get(key);
        getReq.onsuccess = () => resolve(getReq.result || (window as any).__fallback_storage?.[key] || null);
        getReq.onerror = () => resolve((window as any).__fallback_storage?.[key] || null);
      } catch {
        resolve((window as any).__fallback_storage?.[key] || null);
      }
    }).catch(() => resolve((window as any).__fallback_storage?.[key] || null));
  });
};

const writeToIndexedDBAsync = (key: string, value: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!(window as any).__fallback_storage) (window as any).__fallback_storage = {};
    (window as any).__fallback_storage[key] = value;
    openSafeIDB().then((db) => {
      if (!db || !db.objectStoreNames?.contains?.('store')) return resolve();
      try {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        const putReq = store.put(value, key);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    }).catch(() => resolve());
  });
};

const removeFromIndexedDBAsync = (key: string): Promise<void> => {
  return new Promise((resolve) => {
    if ((window as any).__fallback_storage) {
      delete (window as any).__fallback_storage[key];
    }
    openSafeIDB().then((db) => {
      if (!db || !db.objectStoreNames?.contains?.('store')) return resolve();
      try {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        const delReq = store.delete(key);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    }).catch(() => resolve());
  });
};

const clearIndexedDBAsync = (): Promise<void> => {
  return new Promise((resolve) => {
    (window as any).__fallback_storage = {};
    openSafeIDB().then((db) => {
      if (!db || !db.objectStoreNames?.contains?.('store')) return resolve();
      try {
        const tx = db.transaction('store', 'readwrite');
        const store = tx.objectStore('store');
        const clearReq = store.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    }).catch(() => resolve());
  });
};

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {
      console.warn("[Storage] LocalStorage read failed, checking fallback:", e);
    }
    if ((window as any).__fallback_storage && key in (window as any).__fallback_storage) {
      return (window as any).__fallback_storage[key];
    }
    return await getFromIndexedDB(key);
  },
  getItemSync(key: string): string | null {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (e) {}
    return (window as any).__fallback_storage?.[key] || null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (!(window as any).__fallback_storage) {
      (window as any).__fallback_storage = {};
    }
    (window as any).__fallback_storage[key] = value;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn("[Storage] LocalStorage write failed, queueing fallback:", e);
    }
    await writeToIndexedDBAsync(key, value);
  },
  setItemSync(key: string, value: string): void {
    if (!(window as any).__fallback_storage) {
      (window as any).__fallback_storage = {};
    }
    (window as any).__fallback_storage[key] = value;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
    writeToIndexedDB(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if ((window as any).__fallback_storage) {
      delete (window as any).__fallback_storage[key];
    }
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn("[Storage] LocalStorage remove failed, removing fallback:", e);
    }
    await removeFromIndexedDBAsync(key);
  },
  removeItemSync(key: string): void {
    if ((window as any).__fallback_storage) {
      delete (window as any).__fallback_storage[key];
    }
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
    removeFromIndexedDB(key);
  },
  async clear(): Promise<void> {
    (window as any).__fallback_storage = {};
    try {
      window.localStorage.clear();
    } catch (e) {
      console.warn("[Storage] LocalStorage clear failed, clearing fallback:", e);
    }
    await clearIndexedDBAsync();
  },
  clearSync(): void {
    (window as any).__fallback_storage = {};
    try {
      window.localStorage.clear();
    } catch (e) {}
    clearIndexedDB();
  }
};
const localStorage = {
  getItem: safeStorage.getItemSync,
  setItem: safeStorage.setItemSync,
  removeItem: safeStorage.removeItemSync,
  clear: safeStorage.clearSync,
  get length(): number {
    try {
      return window.localStorage.length;
    } catch (e) {
      return Object.keys((window as any).__fallback_storage || {}).length;
    }
  },
  key(index: number): string | null {
    try {
      return window.localStorage.key(index);
    } catch (e) {
      return Object.keys((window as any).__fallback_storage || {})[index] || null;
    }
  }
};


export interface NavState {
  activeTab: Tab;
  selectedMobileView: 'menu' | 'tab';
  activeSubRow: number;
  activeSection?: 'home' | 'leads' | 'social';
}

type Tab = 'dashboard' | 'business_scan' | 'reviews' | 'social' | 'leads' | 'pricing' | 'growth' | 'profile' | 'plans' | 'tools' | 'accounting' | 'eod' | 'website' | 'estimator' | 'action_center' | 'ledger';

type Niche = 'jardineria' | 'construccion' | 'plomeria' | 'barberia' | 'peluqueria' | 'uñas' | 'pintura' | 'real_estate' | 'seguridad' | 'limpieza' | 'restaurante' | 'gastronomia' | 'aire_acondicionado' | 'pest_control' | 'piscina' | 'nieve' | 'techado' | 'solar' | 'handyman' | 'mascotas' | 'mudanzas' | 'bienestar' | 'cerrajeria' | 'arborista' | 'puertas_garaje' | 'electricidad' | 'lavado_presion' | 'limpieza_alfombras' | 'remocion_escombros' | 'restauracion' | 'gruas' | 'electrodomesticos' | 'detallado_autos' | 'pisos_epoxicos' | 'cercas' | 'concreto' | 'chimeneas' | 'ventanas_puertas' | 'otro';

interface NotificationSettings {
  newLeads: boolean;
  pendingReviews: boolean;
  priceAlerts: boolean;
}


export interface UserSubscription {
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';
  trialDaysLeft: number;
  currentPeriodEnd: number | null;
  billingCycle: 'monthly' | 'yearly' | null;
}
interface BusinessProfile {
  name: string;
  category: string;
  location: string;
  phone: string;
  gmbLink: string;
  badges: string[];
  services?: string[];
  features?: string[];
  lat?: number;
  lng?: number;
  locationSource?: 'DEVICE' | 'BROWSER_NETWORK' | 'USER_ENTERED' | 'DEMO_EXAMPLE';
  lastBattleRevenue?: number;
  lastGrowthRevenue?: number;
  roi?: number;
  isPro?: boolean;
  plan?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  trustPoints?: number;
  niche?: string;
  hasUsedTrial?: boolean;
  trialStartDate?: string;
  notificationSettings?: NotificationSettings;
}

interface Lead {
  id: string;
  date?: string;
  text: string;
  urgency: string;
  size?: string;
  action?: string;
  strategy?: string;
  ltv?: number;
  client?: string;
  phone?: string;
  email?: string;
  status?: string;
  timestamp?: string;
  score?: number;
  estimatedValue?: number;
  competitorHash?: string;
  isDemo?: boolean;
  tag?: string;
  city?: string;
  category?: string;
  [key: string]: any;
}

interface Transaction {
  id: string;
  name?: string;
  amount: number;
  status: 'pendiente' | 'pagado';
  date: string;
  client?: string;
  service?: string;
  isDemo?: boolean;
  [key: string]: any;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  points: number;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export const detectClientLanguage = (): 'es' | 'en' => {
  if (typeof window === 'undefined') return 'en';

  try {
    // 1. Check if user already explicitly saved a preference
    const saved = localStorage.getItem('lf_lang');
    if (saved === 'es' || saved === 'en') {
      return saved;
    }
  } catch (e) {
    console.warn("Language detection fallback error:", e);
  }

  // English is the primary language and always the default on load
  return 'en';
};


const Card: React.FC<{
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm ${className}`}>
    {(title || icon) && (
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        {icon && <div className="shrink-0">{icon}</div>}
        <div>
          {title && <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>}
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
    )}
    {children}
  </div>
);

const Header: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
    <div>
      <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

const Input: React.FC<{
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
}> = ({ label, placeholder, value, onChange, type = 'text' }) => (
  <div className="space-y-1">
    {label && <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</label>}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
    />
  </div>
);

const PriceRow: React.FC<{
  label: string;
  amount: number | string;
  color?: string;
}> = ({ label, amount, color = 'text-slate-900 dark:text-white' }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/60 text-xs">
    <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
    <span className={`font-black ${color}`}>${typeof amount === 'number' ? amount.toFixed(2) : amount}</span>
  </div>
);

const ImageUpload: React.FC<{
  label: string;
  id: string;
  image: string | null;
  onUpload: (file: File) => void;
  icon?: React.ReactNode;
}> = ({ label, id, image, onUpload, icon }) => (
  <div className="space-y-1.5">
    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</label>
    <label htmlFor={`upload-${id}`} className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500 transition h-28 relative overflow-hidden">
      {image ? (
        <img src={image} alt={label} className="w-full h-full object-cover rounded-lg" />
      ) : (
        <div className="text-center text-slate-400 flex flex-col items-center gap-1">
          {icon}
          <span className="text-[10px] font-bold">Subir Imagen</span>
        </div>
      )}
      <input
        id={`upload-${id}`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onUpload(e.target.files[0]);
        }}
      />
    </label>
  </div>
);

const LeadSwipeableRow: React.FC<{
  l: any;
  t: (es: string, en: string) => string;
  onGenerateClosing: (lead: any) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
}> = ({ l, t, onGenerateClosing, onDelete }) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
    <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{l.business_name || l.text || 'Lead'}</td>
    <td className="py-3 px-2 text-slate-500">{l.city || l.category || 'Local'}</td>
    <td className="py-3 px-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">{l.urgency || 'Media'}</span></td>
    <td className="py-3 px-2">
      <button onClick={() => onGenerateClosing(l)} className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer">{t("Cerrar", "Close")}</button>
    </td>
    <td className="py-3 px-2 text-right">
      <button onClick={() => onDelete && onDelete(l.id)} className="text-slate-400 hover:text-rose-500 cursor-pointer">✕</button>
    </td>
  </tr>
);


export default function App() {
  const [language, setLanguage] = useState<'es' | 'en'>(() => {
    return detectClientLanguage();
  });

  // Translations
  const t = (es: string, en: string) => language === 'es' ? es : en;

  const [user, setUser] = useState<User | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isVerifyingSubscription, setIsVerifyingSubscription] = useState(false);
  const isVerifyingStripeSessionRef = useRef(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const [pendingMutationsCount, setPendingMutationsCount] = useState<number>(0);

  const updatePendingMutationsCount = () => {
    if (typeof window === 'undefined') return;
    openSafeIDB().then(idb => {
      if (!idb || !idb.objectStoreNames.contains("pending_mutations")) {
        setPendingMutationsCount(0);
        return;
      }
      const transaction = idb.transaction(["pending_mutations"], "readonly");
      const store = transaction.objectStore("pending_mutations");
      const countReq = store.count();
      countReq.onsuccess = () => {
        setPendingMutationsCount(countReq.result || 0);
      };
    }).catch(err => {
      console.warn("Failed to update pending mutations count:", err);
    });
  };

  const getSecureNow = (): number => {
    // If serverTimeOffset is reasonable (within +/- 1 hour), apply it; otherwise fallback to local Date.now()
    if (Math.abs(serverTimeOffset) <= 3600000) {
      return Date.now() + serverTimeOffset;
    }
    return Date.now();
  };

  const [profileVerificationRequired, setProfileVerificationRequired] = useState(false);
  const [matchingSuggestions, setMatchingSuggestions] = useState<any[]>([]);

  // For speech synthesis ref
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    (window as any).updatePendingMutationsCount = updatePendingMutationsCount;
    updatePendingMutationsCount();

    // Fetch secure server time on mount to eliminate client clock manipulation
    fetch("/api/server-time")
      .then(res => res.json())
      .then((data: any) => {
        if (!data) return;
        let serverMs = typeof data.time === 'number'
          ? data.time
          : (typeof data.timestamp === 'number'
            ? data.timestamp
            : (data.time ? Date.parse(data.time) : (data.timestamp ? Date.parse(data.timestamp) : NaN)));

        // Handle seconds vs milliseconds (10-digit unix timestamp in seconds)
        if (serverMs > 0 && serverMs < 1e11) {
          serverMs = serverMs * 1000;
        }

        if (!isNaN(serverMs) && serverMs > 0) {
          const rawOffset = serverMs - Date.now();
          // Offset must be realistic: between -1 hour and +1 hour (3600000 ms)
          // Discard absurd offsets like -323902044ms or days skew
          if (Math.abs(rawOffset) <= 3600000) {
            setServerTimeOffset(rawOffset);
            console.log("[Time] Server time synchronized. Offset: " + rawOffset + "ms");
          } else {
            console.warn(`[Time] Discarding absurd server time offset (${rawOffset}ms). Using local clock fallback.`);
            setServerTimeOffset(0);
          }
        } else {
          setServerTimeOffset(0);
        }
      })
      .catch(err => {
        console.warn("[Time] Could not sync server time, falling back to local clock:", err);
        setServerTimeOffset(0);
      });

    try {
      window.localStorage.removeItem('lf_last_perf_now');
      window.localStorage.removeItem('lf_last_server_time');
    } catch {}

    return () => {
      delete (window as any).updatePendingMutationsCount;
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null;
        currentUtteranceRef.current.onerror = null;
        currentUtteranceRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const syncPendingMutations = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    const db = getFirebaseDB();
    if (!db) return;

    try {
      const idb = await openSafeIDB();
      if (!idb || !idb.objectStoreNames.contains("pending_mutations")) return;

      const transaction = idb.transaction(["pending_mutations"], "readonly");
      const store = transaction.objectStore("pending_mutations");
      const getReq = store.getAll();

      getReq.onsuccess = async () => {
        const mutations = getReq.result || [];
        if (mutations.length === 0) return;

        console.log(`[Sync] Found ${mutations.length} pending mutations to replay.`);

        for (const mut of mutations) {
          try {
            if (mut.type === 'setDoc') {
              const docRef = doc(db, mut.path);
              await originalSetDoc(docRef, mut.data, { merge: true });
              console.log(`[Sync] Successfully replayed setDoc for path: ${mut.path}`);
            } else if (mut.type === 'addDoc') {
              const pathSegments = (mut.path || '').split('/').filter(Boolean);
              if (pathSegments.length % 2 === 0) {
                const docRef = doc(db, mut.path);
                await originalSetDoc(docRef, mut.data, { merge: true });
              } else {
                const colRef = collection(db, mut.path);
                await originalAddDoc(colRef, mut.data);
              }
              console.log(`[Sync] Successfully replayed addDoc for path: ${mut.path}`);
            }

            // Remove from IndexedDB pending list
            const delTransaction = idb.transaction(["pending_mutations"], "readwrite");
            const delStore = delTransaction.objectStore("pending_mutations");
            delStore.delete(mut.id);
          } catch (err) {
            console.error(`[Sync] Failed to replay mutation ${mut.id}:`, err);
          }
        }
        setTimeout(updatePendingMutationsCount, 500);
      };
    } catch (err) {
      console.warn("[Sync] Error running pending mutations synchronization:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', syncPendingMutations);
      syncPendingMutations();
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', syncPendingMutations);
      }
    };
  }, [user]);

  const [activeTab, setActiveTab] = useState<Tab>(() => (typeof window !== 'undefined' && window.innerWidth < 1024) ? 'action_center' : 'dashboard');
  const [collapsedNavSections, setCollapsedNavSections] = useState<Record<string, boolean>>({
    market: true,
    leads: true,
    growth: true,
    execute: true,
    channels: true,
    account: true,
  });

  const toggleNavSection = (sectionKey: string) => {
    setCollapsedNavSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };
  const [publicSiteId, setPublicSiteId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const site = params.get('site');
        if (site) return site;
        const path = window.location.pathname;
        if (path.startsWith('/web/')) {
          const slug = path.split('/web/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) return slug;
        }
      }
    } catch (e) {}
    return null;
  });

  const [publicRateId, setPublicRateId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const rate = params.get('rate');
        if (view === 'shield' || rate) {
          return rate || 'demo_bvelt';
        }
      }
    } catch (e) {}
    return null;
  });

  const [publicAuditMode, setPublicAuditMode] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const path = window.location.pathname;
        if (path === '/free-audit' || path === '/audit' || view === 'free-audit' || view === 'audit') {
          return true;
        }
      }
    } catch (e) {}
    return false;
  });

  const [publicFunnelReportId, setPublicFunnelReportId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        const rParam = params.get('r');
        if (rParam) return decodeURIComponent(rParam);
        const reportParam = params.get('report');
        if (reportParam && reportParam !== 'true' && reportParam !== '1') return decodeURIComponent(reportParam);
        if (path.startsWith('/r/')) {
          const id = path.split('/r/')[1]?.split('/')[0]?.split('?')[0];
          if (id) return decodeURIComponent(id);
        }
        if (path.startsWith('/report/')) {
          const id = path.split('/report/')[1]?.split('/')[0]?.split('?')[0];
          if (id) return decodeURIComponent(id);
        }
      }
    } catch (e) {}
    return null;
  });

  const [publicSnapshotMode, setPublicSnapshotMode] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        const snapshot = params.get('snapshot');
        const report = params.get('report');
        const path = window.location.pathname;
        const ref = params.get('ref') || params.get('referred_by') || params.get('referrer');
        if (ref) {
          localStorage.setItem('bvelt_referred_by', ref);
        }
        // Si es una ruta de embudo /r/:id o /report/:id, delegar a publicFunnelReportId
        if (path.startsWith('/r/') || path.startsWith('/report/') || params.get('r') || (report && report !== 'true' && report !== '1')) {
          return false;
        }
        if (
          snapshot === 'true' || snapshot === '1' || 
          report === 'true' || report === '1' ||
          view === 'snapshot' || view === 'report' || view === 'leak-report' ||
          path.startsWith('/snapshot/') || path === '/report'
        ) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  });

  const [publicVerifiedEntityId, setPublicVerifiedEntityId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const verified = params.get('verified');
        if (verified) return verified;
        const path = window.location.pathname;
        if (path.startsWith('/verify/')) {
          const slug = path.split('/verify/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) return slug;
        }
        if (path.startsWith('/verified/')) {
          const slug = path.split('/verified/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) return slug;
        }
      }
    } catch (e) {}
    return null;
  });

  const [publicTemplateSlug, setPublicTemplateSlug] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/templates/')) {
          const slug = path.split('/templates/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) return slug;
        }
      }
    } catch (e) {}
    return null;
  });

  const [publicAboutMode, setPublicAboutMode] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const view = new URLSearchParams(window.location.search).get('view');
        if (path === '/about' || path === '/support' || path === '/apoyar' || view === 'about' || view === 'support' || view === 'apoyar') {
          return true;
        }
      }
    } catch (e) {}
    return false;
  });

  useEffect(() => {
    const handleUrlResolution = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const site = params.get('site');
        const view = params.get('view');
        const rate = params.get('rate');
        const verified = params.get('verified');
        const path = window.location.pathname;

        if (path === '/about' || path === '/support' || path === '/apoyar' || view === 'about' || view === 'support' || view === 'apoyar') {
          if ((path === '/support' || path === '/apoyar' || view === 'support' || view === 'apoyar') && typeof window !== 'undefined' && !window.location.hash) {
            window.location.hash = 'support';
          }
          setPublicAboutMode(true);
          return;
        }

        if (path.startsWith('/templates/')) {
          const slug = path.split('/templates/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) {
            setPublicTemplateSlug(slug);
            return;
          }
        }

        if (path.startsWith('/verify/')) {
          const slug = path.split('/verify/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) {
            setPublicVerifiedEntityId(slug);
            return;
          }
        }
        if (path.startsWith('/verified/')) {
          const slug = path.split('/verified/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) {
            setPublicVerifiedEntityId(slug);
            return;
          }
        }
        if (verified) {
          setPublicVerifiedEntityId(verified);
          return;
        }

        if (
          path.startsWith('/snapshot') || path.startsWith('/report') || 
          view === 'snapshot' || view === 'report' || view === 'leak-report' ||
          params.get('report') === 'true' || params.get('snapshot') === 'true'
        ) {
          setPublicSnapshotMode(true);
          return;
        }

        if (path === '/free-audit' || path === '/audit' || view === 'free-audit' || view === 'audit') {
          setPublicAuditMode(true);
          return;
        }

        if (view === 'shield' || rate) {
          setPublicRateId(rate || 'demo_bvelt');
          return;
        }
        
        if (site) {
          setPublicSiteId(site);
        } else if (path.startsWith('/web/')) {
          const slug = path.split('/web/')[1]?.split('/')[0]?.split('?')[0];
          if (slug) {
            setPublicSiteId(slug);
          }
        }

        if (view === 'operator' || path === '/operator' || path === '/prospects' || view === 'prospects') {
          setActiveTab('leads');
          setActiveSubRow(6);
          return;
        }

        const tabParam = params.get('tab');
        const leadIdParam = params.get('leadId') || params.get('lead_id');
        if (tabParam) {
          setActiveTab(tabParam as Tab);
        }
        if (tabParam === 'leads' || leadIdParam) {
          setActiveSubRow(4);
          if (leadIdParam) {
            try {
              localStorage.setItem('crm_open_lead_id', leadIdParam);
              localStorage.setItem('crm_lead_filter', 'ALL');
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new CustomEvent('bvelt_open_lead', { detail: { leadId: leadIdParam } }));
            } catch (err) {}
          }
        }
      } catch (e) {
        console.error('Error al leer parámetros de URL', e);
      }
    };

    handleUrlResolution();
    window.addEventListener('popstate', handleUrlResolution);
    return () => {
      window.removeEventListener('popstate', handleUrlResolution);
    };
  }, []);

  const [activeSection, setActiveSection] = useState<'home' | 'leads' | 'social'>('home');
  const [referralCount, setReferralCount] = useState(3);
  const [portfolioStats, setPortfolioStats] = useState({ photos: 24, stories: 8 });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [selectedMobileView, setSelectedMobileView] = useState<'menu' | 'tab'>('menu');

  const [activeSubRow, setActiveSubRow] = useState<number>(0);

  useEffect(() => {
    let sectionKey = '';
    if (['business_scan', 'estimator'].includes(activeTab) || (activeTab === 'tools' && activeSubRow === 0)) {
      sectionKey = 'market';
    } else if (activeTab === 'leads') {
      sectionKey = 'leads';
    } else if (['reviews', 'social', 'growth', 'action_center', 'website'].includes(activeTab)) {
      sectionKey = 'growth';
    } else if (['eod', 'pricing'].includes(activeTab) || (activeTab === 'tools' && activeSubRow !== 0)) {
      sectionKey = 'execute';
    } else if (['accounting', 'plans', 'profile'].includes(activeTab)) {
      sectionKey = 'account';
    }
    if (sectionKey) {
      setCollapsedNavSections(prev => (prev[sectionKey] ? { ...prev, [sectionKey]: false } : prev));
    }
  }, [activeTab, activeSubRow]);

  const [historyStack, setHistoryStack] = useState<NavState[]>([
    { activeTab: (typeof window !== 'undefined' && window.innerWidth < 1024) ? 'action_center' : 'dashboard', selectedMobileView: 'menu', activeSubRow: 0, activeSection: 'home' }
  ]);
  const isGoingBackRef = useRef(false);
  const prevNavStateRef = useRef<NavState>({
    activeTab: (typeof window !== 'undefined' && window.innerWidth < 1024) ? 'action_center' : 'dashboard',
    selectedMobileView: 'menu',
    activeSubRow: 0,
    activeSection: 'home'
  });

  useEffect(() => {
    const currentNavState: NavState = {
      activeTab,
      selectedMobileView,
      activeSubRow,
      activeSection
    };

    const prev = prevNavStateRef.current;
    const isDifferent =
      prev.activeTab !== currentNavState.activeTab ||
      prev.selectedMobileView !== currentNavState.selectedMobileView ||
      prev.activeSubRow !== currentNavState.activeSubRow ||
      prev.activeSection !== currentNavState.activeSection;

    if (isDifferent) {
      prevNavStateRef.current = currentNavState;

      if (!isGoingBackRef.current) {
        setHistoryStack(stack => {
          const top = stack[stack.length - 1];
          if (
            top &&
            top.activeTab === currentNavState.activeTab &&
            top.selectedMobileView === currentNavState.selectedMobileView &&
            top.activeSubRow === currentNavState.activeSubRow &&
            top.activeSection === currentNavState.activeSection
          ) {
            return stack;
          }
          return [...stack, currentNavState];
        });
      }
    }
  }, [activeTab, selectedMobileView, activeSubRow, activeSection]);

  const handleGoBack = () => {
    isGoingBackRef.current = true;

    if (historyStack.length > 1) {
      const newStack = historyStack.slice(0, -1);
      const previousState = newStack[newStack.length - 1];
      setHistoryStack(newStack);

      if (previousState) {
        prevNavStateRef.current = previousState;
        setActiveTab(previousState.activeTab);
        setSelectedMobileView(previousState.selectedMobileView);
        setActiveSubRow(previousState.activeSubRow);
        if (previousState.activeSection) {
          setActiveSection(previousState.activeSection);
        }
      }
    } else {
      const homeState: NavState = { activeTab: (typeof window !== 'undefined' && window.innerWidth < 1024) ? 'action_center' : 'dashboard', selectedMobileView: 'menu', activeSubRow: 0, activeSection: 'home' };
      setHistoryStack([homeState]);
      prevNavStateRef.current = homeState;
      setActiveTab('dashboard');
      setSelectedMobileView('menu');
      setActiveSubRow(0);
      setActiveSection('home');
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }

    setTimeout(() => {
      isGoingBackRef.current = false;
    }, 50);
  };


  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [showMobileDock, setShowMobileDock] = useState(true);
  const lastScrollY = useRef(0);
  const eodAudioRef = useRef<HTMLAudioElement | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstallable, setIsPWAInstallable] = useState(false);
  const [isRepairingPWA, setIsRepairingPWA] = useState(false);
  const [isInIframe, setIsInIframe] = useState(() => typeof window !== 'undefined' && window.self !== window.top);

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const stripeEnv = (import.meta as any).env || {};
  const priceProMonthly = stripeEnv.VITE_STRIPE_PROD_MONTHLY || 
                          stripeEnv.VITE_STRIPE_PRICE_PRO_MONTHLY || 
                          stripeEnv.VITE_STRIPE_PROD_PRICE_MONTHLY || 
                          stripeEnv.VITE_STRIPE_PRICE_PROD_MONTHLY || 
                          stripeEnv.VITE_STRIPE_PRICE_MONTHLY || 
                          'price_mock_pro_monthly';

  const priceProYearly = stripeEnv.VITE_STRIPE_PROD_YEARLY || 
                         stripeEnv.VITE_STRIPE_PROD_ANNUAL || 
                         stripeEnv.VITE_STRIPE_PRICE_PRO_YEARLY || 
                         stripeEnv.VITE_STRIPE_PROD_PRICE_YEARLY || 
                         stripeEnv.VITE_STRIPE_PRICE_PROD_YEARLY || 
                         stripeEnv.VITE_STRIPE_PROD_PRICE_ANNUAL || 
                         'price_mock_pro_yearly';

  const handleCheckout = async (priceIdOrPlan?: string, optionalPlan?: string) => {
    let planType: 'monthly' | 'yearly' = 'monthly';
    let priceId = '';

    if (priceIdOrPlan === 'yearly' || priceIdOrPlan === 'annual' || optionalPlan === 'yearly' || optionalPlan === 'annual') {
      planType = 'yearly';
      priceId = priceIdOrPlan !== 'yearly' && priceIdOrPlan !== 'annual' ? (priceIdOrPlan || priceProYearly) : (optionalPlan || priceProYearly);
    } else if (priceIdOrPlan === 'monthly' || optionalPlan === 'monthly') {
      planType = 'monthly';
      priceId = priceIdOrPlan !== 'monthly' ? (priceIdOrPlan || priceProMonthly) : (optionalPlan || priceProMonthly);
    } else if (priceIdOrPlan && (priceIdOrPlan.includes('year') || priceIdOrPlan.includes('annual'))) {
      planType = 'yearly';
      priceId = priceIdOrPlan;
    } else {
      planType = (optionalPlan as any) || 'monthly';
      priceId = priceIdOrPlan || priceProMonthly;
    }

    let currentUser = user;
    if (!currentUser) {
      try {
        const pendingPayload = JSON.stringify({ planType, priceId });
        sessionStorage.setItem('pending_checkout', pendingPayload);
        localStorage.setItem('pending_checkout', pendingPayload);
        showToast(t("Iniciando sesión con Google antes del pago...", "Signing in with Google before checkout..."), "info");
        const loggedUser = await loginWithGoogle();
        if (!loggedUser) {
          // In mobile/PWA environments, loginWithGoogle initiates a redirect navigation.
          return;
        }
        sessionStorage.removeItem('pending_checkout');
        localStorage.removeItem('pending_checkout');
        currentUser = loggedUser;
      } catch (loginErr: any) {
        sessionStorage.removeItem('pending_checkout');
        localStorage.removeItem('pending_checkout');
        console.error("Error signing in before checkout:", loginErr?.code || 'AUTH_ERROR');
        const msg = getHumanAuthErrorMessage(loginErr, language);
        showToast(msg, loginErr?.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
        return;
      }
    }

    try {
      setCheckoutLoading(planType);

      // Trigger GA4 event: begin_checkout
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'begin_checkout', {
          value: planType === 'yearly' ? 390 : 49,
          currency: 'USD',
          items: [{
            item_id: priceId || (planType === 'yearly' ? 'pro_yearly' : 'pro_monthly'),
            item_name: planType === 'yearly' ? 'Pro Anual VIP' : 'Plan Mensual Premium',
            price: planType === 'yearly' ? 390 : 49,
            quantity: 1
          }]
        });
      }

      let response;
      try {
        const idToken = currentUser ? await currentUser.getIdToken() : '';
        const bodyPayload: Record<string, any> = { planType };
        if (priceId && !priceId.includes('mock') && !priceId.startsWith('pro_')) {
          bodyPayload.priceId = priceId;
        }

        notifyOwner({
          event: 'checkout_or_payment',
          emailOrUid: currentUser?.email || currentUser?.uid,
          details: { planType, priceId }
        });

        recordBveltEvent({
          uid: currentUser?.uid || user?.uid,
          type: 'checkout_started',
          trade: profile?.category || niche,
          city: profile?.city || profile?.location || '',
          meta: { planType, priceId }
        });

        response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify(bodyPayload),
        });
      } catch (networkErr: any) {
        console.error("Network error connecting to payment server:", networkErr);
        if (currentUser?.uid) {
          Sentry.setUser({ id: currentUser.uid });
          Sentry.setTag('uid', currentUser.uid);
        }
        Sentry.captureException(networkErr, {
          tags: { feature: 'stripe_checkout_network', uid: currentUser?.uid || 'anonymous' },
          extra: { priceId, planType }
        });
        showToast(
          t("No se pudo conectar con el servidor de pagos. Verifica tu conexión a internet.", "Could not connect to payment server. Check your network connection."),
          "error"
        );
        return;
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error("Invalid JSON response from server:", jsonErr);
        showToast(
          t(`Error de respuesta del servidor (${response.status})`, `Server response error (${response.status})`),
          "error"
        );
        return;
      }

      if (data.url) {
        try {
          const urlObj = new URL(data.url, window.location.origin);
          const urlSessionId = urlObj.searchParams.get('session_id') || data.sessionId || data.id;
          if (urlSessionId) {
            localStorage.setItem('pending_stripe_session_id', urlSessionId);
            console.log("[Stripe] Pre-redirect, saved pending Stripe session ID: " + urlSessionId);
          }
        } catch (e) {
          console.warn("[Stripe] Failed to parse Stripe Checkout URL for session_id:", e);
        }
        window.location.href = data.url;
      } else if (data.error || data.details || data.message) {
        const errorMsg = data.error || data.message || t("Error en el pago", "Payment error");
        const detailsMsg = data.details ? `: ${data.details}` : "";
        if (currentUser?.uid) {
          Sentry.setUser({ id: currentUser.uid });
          Sentry.setTag('uid', currentUser.uid);
        }
        Sentry.captureException(new Error(`Checkout failed: ${errorMsg}${detailsMsg}`), {
          tags: { feature: 'stripe_checkout_client', uid: currentUser?.uid || 'anonymous' },
          extra: { priceId, planType, data }
        });
        showToast(`${errorMsg}${detailsMsg}`, "error");
      } else {
        showToast(
          t(`Error inesperado al conectar con Stripe (${response.status})`, `Unexpected error connecting to Stripe (${response.status})`),
          "error"
        );
      }
    } catch (err: any) {
      console.error("Error in handleCheckout:", err);
      if (currentUser?.uid) {
        Sentry.setUser({ id: currentUser.uid });
        Sentry.setTag('uid', currentUser.uid);
      }
      Sentry.captureException(err, {
        tags: { feature: 'stripe_checkout_client_unhandled', uid: currentUser?.uid || 'anonymous' },
        extra: { priceId, planType }
      });
      showToast(err?.message || t("Error al procesar el pago", "Error processing payment"), "error");
    } finally {
      setCheckoutLoading(null);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status') || params.get('checkout');
      const plan = params.get('plan');
      const sessionIdFromUrl = params.get('session_id');

      let sessionId = sessionIdFromUrl || localStorage.getItem('pending_stripe_session_id');

      if (status === 'success' && sessionIdFromUrl) {
        localStorage.setItem('pending_stripe_session_id', sessionIdFromUrl);
      }

      const verifySessionWithBackoff = async (sid: string, attempt: number = 1): Promise<any> => {
        const maxAttempts = 6;
        try {
          showToast(t(`Procesando pago... Verificando estado (intento ${attempt}/${maxAttempts})`, `Processing payment... Verifying status (attempt ${attempt}/${maxAttempts})`), "info");
          const res = await fetch(`/api/verify-session?session_id=${encodeURIComponent(sid)}`);
          const data = await res.json().catch(() => null) as {
            ok?: boolean;
            status?: string;
            error?: string;
            details?: string;
            plan?: string;
            message?: string;
            payment_status?: string;
            session_status?: string;
            isPro?: boolean;
            currentPeriodEnd?: number;
            billingCycle?: 'monthly' | 'yearly';
            stripeCustomerId?: string;
          } | null;

          if (!res.ok) {
            const errorMsg = data?.error || data?.details || `Server responded with status ${res.status}`;
            // If the server returns a 400 (e.g. invalid session_id or unpaid), do at most 3 attempts and don't loop endlessly
            if (res.status === 400 && attempt >= 3) {
              const defErr: any = new Error(errorMsg);
              defErr.isDefinitive = true;
              throw defErr;
            }
            throw new Error(errorMsg);
          }

          // 1. Success cases
          if (data && (data.ok === true || data.isPro === true || data.status === 'active' || data.status === 'trialing' || data.payment_status === 'paid')) {
            return data;
          }

          // 2. Processing cases (status 200 with status "processing" or message "Payment is still processing")
          if (data && (data.status === 'processing' || data.message?.includes('still processing') || data.payment_status === 'unpaid' || data.session_status === 'open')) {
            const procErr: any = new Error(data.message || 'Payment is still processing in Stripe');
            if (attempt >= maxAttempts) {
              procErr.isProcessingTimeout = true;
            } else {
              procErr.isProcessing = true;
            }
            throw procErr;
          }

          throw new Error('Session status is not active/trialing yet');
        } catch (err: any) {
          if (!err?.isDefinitive && !err?.isProcessingTimeout && attempt < maxAttempts) {
            const delay = Math.pow(1.8, attempt) * 1200 + Math.random() * 400; // Exponential backoff + jitter (~2.1s, ~3.9s)
            console.log(`[Stripe] Verification attempt ${attempt} pending/processing. Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return verifySessionWithBackoff(sid, attempt + 1);
          }
          throw err;
        }
      };

      if (sessionId && !isVerifyingStripeSessionRef.current) {
        isVerifyingStripeSessionRef.current = true;
        setIsVerifyingSubscription(true);
        verifySessionWithBackoff(sessionId)
          .then(data => {
            if (data && (data.ok === true || data.isPro === true || data.status === 'active' || data.status === 'trialing' || data.payment_status === 'paid' || data.status === 'paid')) {
              if (data.plan === 'recovery_fee' || data.opportunityId || status === 'recovery_success') {
                const oppId = data.opportunityId || params.get('opportunityId') || 'recovery_job';
                RecoveryFeeService.markFeePaid(oppId, sessionId);
                showToast(t("🎉 ¡Honorario de recuperación ($19) verificado y pagado!", "🎉 Recovery fee ($19) successfully verified and paid!"), "success");
                return;
              }

              setUserSubscription({
                status: 'active',
                trialDaysLeft: 0,
                currentPeriodEnd: data.currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000),
                billingCycle: data.billingCycle || 'monthly'
              });
              
              // save to firestore
              const db = getFirebaseDB();
              const auth = getFirebaseAuth();
              if (db && auth?.currentUser) {
                const profileRef = doc(db, 'profiles', auth.currentUser.uid);
                setDoc(profileRef, {
                  subscriptionStatus: 'active',
                  plan: data.plan || (data.billingCycle === 'yearly' ? 'pro_annual' : 'pro_monthly'),
                  currentPeriodEnd: data.currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000),
                  stripeCustomerId: data.stripeCustomerId || profile?.stripeCustomerId || "",
                  isPro: true
                }, { merge: true }).catch(err => {
                  console.error("Failed to update profile after Stripe verify:", err);
                });
              }

              // Instantly update local profile state
              setProfile(prev => {
                const updated = prev ? {
                  ...prev,
                  subscriptionStatus: 'active',
                  plan: data.plan || (data.billingCycle === 'yearly' ? 'pro_annual' : 'pro_monthly'),
                  isPro: true,
                  currentPeriodEnd: data.currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000)
                } : prev;
                localStorage.setItem('lf_profile', JSON.stringify(updated));
                localStorage.setItem('user_profile', JSON.stringify(updated));
                return updated;
              });

              // Take user directly to the Dashboard
              setActiveTab('dashboard');

              // Trigger GA4 event: purchase_success
              if (typeof (window as any).gtag === 'function') {
                (window as any).gtag('event', 'purchase_success', {
                  transaction_id: sessionId || undefined,
                  value: plan === 'yearly' ? 390 : 49,
                  currency: 'USD',
                  items: [{
                    item_name: plan === 'yearly' ? 'Pro Anual VIP' : 'Plan Mensual Premium',
                    price: plan === 'yearly' ? 390 : 49,
                    quantity: 1
                  }]
                });
              }

              showToast(t("¡Suscripción activada con éxito!", "Subscription successfully activated!"), "success");
            }
          })
          .catch(err => {
            if (err?.isProcessingTimeout || err?.message?.includes('still processing') || err?.isProcessing) {
              console.warn('[Stripe] Payment is still processing after maximum retries');
              showToast(t("El pago está tardando en procesarse. En 1-2 minutos tu cuenta se activará automáticamente.", "Payment is taking a bit longer to process. Your account will activate automatically in 1-2 minutes."), "info");
            } else {
              console.error('[Stripe] All subscription verification retries failed:', err);
              showToast(t("No pudimos confirmar tu pago todavía. Si ya pagaste, espera 1 minuto y recarga. Si no, intenta de nuevo.", "We couldn't confirm your payment yet. If you already paid, wait 1 minute and reload. Otherwise, try again."), "error");
            }
          })
          .finally(() => {
            isVerifyingStripeSessionRef.current = false;
            setIsVerifyingSubscription(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            localStorage.removeItem('pending_stripe_session_id');
          });
      }

      if (status === 'cancelled' || status === 'cancel') {
        showToast(t("El proceso de pago fue cancelado.", "Payment process was cancelled."), "info");
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.removeItem('pending_stripe_session_id');
      }
    }
  }, [user]);

  const firstMount = useRef(true);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsPWAInstallable(false);
    }

    const handleGlobalPWA = () => {
      if (isStandalone) return;
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setIsPWAInstallable(true);
      }
    };

    // Check immediately in case it already fired
    handleGlobalPWA();

    // Also listen for the custom event we dispatch in index.html
    window.addEventListener('pwa-installable', handleGlobalPWA);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (isStandalone) return;
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e as any);
      setIsPWAInstallable(true);
      console.log('PWA beforeinstallprompt event fired and captured in App!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('pwa-installable', handleGlobalPWA);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handlePWAInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPrompt;
    if (!promptEvent) {
      console.warn('Install prompt is not available.');
      return;
    }
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    (window as any).deferredPrompt = null;
    setIsPWAInstallable(false);
  };

  const handleForceReRegisterSW = async () => {
    if (isRepairingPWA) return;
    setIsRepairingPWA(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log('Unregistered all previous service workers.');

        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            await caches.delete(key);
          }
          console.log('Cleared all previous caches.');
        }

        // Clean up some localStorage flags just in case
        localStorage.removeItem('pwa_installed');
        localStorage.removeItem('pwa_prompt_dismissed');

        const newReg = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker re-registered successfully:', newReg.scope);
        await newReg.update();

        showToast(
          t("🛠️ PWA Reparada: Se limpió la caché y se re-registró el servicio. Reiniciando la app en 1.5s...", "🛠️ PWA Repaired: Old cache cleared and Service Worker re-registered. Reloading app in 1.5s..."),
          "success"
        );

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setIsRepairingPWA(false);
        showToast(
          t("Tu navegador no soporta Service Workers.", "Your browser does not support Service Workers."),
          "error"
        );
      }
    } catch (err: any) {
      setIsRepairingPWA(false);
      console.error('Error repairing PWA SW:', err);
      showToast(
        t("Error al reparar PWA: ", "Error repairing PWA: ") + (err.message || err.toString()),
        "error"
      );
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 55) {
        setShowMobileDock(false);
      } else {
        setShowMobileDock(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    if (isMobile) {
      setSelectedMobileView('tab');
    }
  }, [activeTab, isMobile]);

  const logFirestoreWrite = (targetName: string) => {
    console.log("🔥 ESCRITURA EN FIRESTORE:", targetName);
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const auth = getFirebaseAuth();
    const errMsg = error instanceof Error ? error.message : String(error);
    const isOffline = errMsg.toLowerCase().includes("offline") || 
                     errMsg.toLowerCase().includes("unreachable") || 
                     errMsg.toLowerCase().includes("could not reach") || 
                     errMsg.toLowerCase().includes("network");

    const isQuota = errMsg.toLowerCase().includes("quota") || 
                    errMsg.toLowerCase().includes("exhausted") || 
                    errMsg.toLowerCase().includes("resource-exhausted") || 
                    (error as any)?.code === "resource-exhausted";

    const errInfo: FirestoreErrorInfo = {
      error: errMsg,
      authInfo: {
        userId: auth?.currentUser?.uid,
        email: auth?.currentUser?.email,
        emailVerified: auth?.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));

    if (isQuota) {
      console.warn("Firestore operating in quota exceeded fallback mode:", errMsg);
      setIsQuotaExceeded(true);
      return; // Do not throw if quota is exceeded! This keeps the UI working smoothly on local/cached data.
    }

    if (isOffline) {
      console.warn("Firestore operating in offline fallback mode:", errMsg);
      return; // Do not throw if offline or unreachable! This keeps the UI working smoothly on cached local storage data.
    }

    // CRITICAL: Must throw JSON string for system diagnosis
    throw new Error(JSON.stringify(errInfo));
  };

  const scrollToSection = (sectionId: string, fallbackTab: Tab, sectionName: 'home' | 'leads' | 'social') => {
    setSelectedMobileView('tab');
    setActiveSection(sectionName);
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else {
          setActiveTab(fallbackTab);
        }
      }, 150);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleHomeClick = () => {
    setSelectedMobileView('tab');
    setActiveSection('home');
    if (activeTab === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveTab('dashboard');
    }
  };
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('lf_tasks');
    return saved ? JSON.parse(saved) : [
      { id: '1', title: t('Pedir reseña de trabajo residencial finalizado hoy', 'Ask for review for job completed today'), completed: false, points: 50 },
      { id: '2', title: t('Publicar foto de servicio reciente en Google Maps', "Post recent service photo on Google Maps"), completed: false, points: 30 },
      { id: '3', title: t('Responder a reseñas pendientes en Google Business', 'Reply to pending reviews on Google Business'), completed: false, points: 20 },
      { id: '4', title: t('Generar auditoría de brechas en mercado local', 'Run local market gap audit'), completed: false, points: 100 },
      { id: '5', title: t('Configurar categorías secundarias y servicios en Maps', 'Configure secondary categories & services in Maps'), completed: false, points: 40 },
    ];
  });
  const [estimatedEarnings, setEstimatedEarnings] = useState(0);
  const [showCloserModal, setShowCloserModal] = useState<{show: boolean, leadId: string | null}>({show: false, leadId: null});
  const [closerMessage, setCloserMessage] = useState('');
  const [closerAgentStyle, setCloserAgentStyle] = useState<'elite' | 'ai' | 'friendly'>('elite');
  const [tempLeadText, setTempLeadText] = useState('');
  const [niche, setNiche] = useState<Niche | ''>('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTourGuide, setShowTourGuide] = useState(false);
  const [isEditingNiche, setIsEditingNiche] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    const saved = localStorage.getItem('user_profile') || localStorage.getItem('lf_profile');
    let parsed: any = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse profile from local storage:", e);
      }
    }

    return {
      name: parsed?.name || '',
      category: parsed?.category || '',
      location: (parsed?.location === 'Toro Yo' ? '' : (parsed?.location || '')),
      phone: parsed?.phone || '',
      gmbLink: parsed?.gmbLink || '',
      badges: parsed?.badges || ['Verified Provider', 'Top Quality']
    };
  });

  const isFounderOrAdmin = Boolean(
    (profile as any)?.role === 'admin' ||
    (profile as any)?.isFounder ||
    user?.email === 'rainerblanco405@gmail.com' ||
    localStorage.getItem('bvelt_admin') === '1' ||
    new URLSearchParams(window.location.search).get('admin') === '1'
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [urlBiz, setUrlBiz] = useState<string | null>(null);
  const [urlCity, setUrlCity] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const biz = params.get('biz');
      const city = params.get('city');
      
      if (biz) setUrlBiz(biz);
      if (city) setUrlCity(city);
    } catch (e) {
      console.error(e);
    }

    // Location Sensing Logic disabled for empty state
    if (!profile.location && urlCity) {
      setProfile(p => ({ ...p, location: urlCity }));
    }
  }, [profile.location, urlCity]);

  // PWA Background Sync & App Badging Engine
  useEffect(() => {
    offlineSyncEngine.init();
    const unsub = offlineSyncEngine.subscribe((_syncState, pendingCount) => {
      if (pendingCount > 0) {
        updateAppBadge(pendingCount);
      } else {
        clearAppBadge();
      }
    });
    return () => {
      unsub();
      offlineSyncEngine.destroy();
    };
  }, []);

  useEffect(() => {
    const getLevenshteinDistance = (a: string, b: string): number => {
      const tmp = [];
      let i, j, alen = a.length, blen = b.length;
      if (alen === 0) return blen;
      if (blen === 0) return alen;
      for (i = 0; i <= alen; i++) tmp[i] = [i];
      for (j = 0; j <= blen; j++) tmp[0][j] = j;
      for (i = 1; i <= alen; i++) {
        for (j = 1; j <= blen; j++) {
          tmp[i][j] = Math.min(
            tmp[i - 1][j] + 1,
            tmp[i][j - 1] + 1,
            tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
      }
      return tmp[alen][blen];
    };

    const getLevenshteinSimilarity = (a: string, b: string): number => {
      const distance = getLevenshteinDistance(a.toLowerCase().trim(), b.toLowerCase().trim());
      const maxLen = Math.max(a.length, b.length);
      if (maxLen === 0) return 1.0;
      return 1.0 - distance / maxLen;
    };

    const debounceSearch = setTimeout(async () => {
      const auth = getFirebaseAuth();
      if (!auth || !auth.currentUser) return;
      if (profile.name && profile.name.length > 3) {
        try {
          const search_prefix = profile.name.toLowerCase().trim().substring(0, 4);
          const q = query(
            collection(db, 'leads_pool'),
            where('search_key', '>=', search_prefix),
            where('search_key', '<=', search_prefix + '\uf8ff'),
            limit(10)
          );
          const querySnapshot = await getDocs(q);
          let bestMatch: any = null;
          let bestScore = 0;
          let isAmbiguous = false;

          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const score = getLevenshteinSimilarity(profile.name, data.business_name || '');
            if (score > bestScore) {
              bestScore = score;
              bestMatch = data;
            }
          });

          if (bestMatch) {
            querySnapshot.forEach((docSnapshot) => {
              const data = docSnapshot.data();
              if (data.business_name !== bestMatch.business_name) {
                const score = getLevenshteinSimilarity(profile.name, data.business_name || '');
                if (Math.abs(score - bestScore) < 0.15 && score > 0.4) {
                  isAmbiguous = true;
                }
              }
            });
          }

          if (bestMatch && bestScore >= 0.85) {
            setProfile(prev => ({ 
              ...prev, 
              location: bestMatch.city || prev.location, 
              category: bestMatch.niche || prev.category,
              requiresConfirmation: false,
              isAmbiguous: false,
              matchedBusinessId: bestMatch.id || null
            }));
            console.log(`[LeadsPool] Strong match found (${Math.round(bestScore * 100)}%): ${bestMatch.business_name}`);
          } else if (bestMatch && bestScore >= 0.50) {
            setProfile(prev => ({ 
              ...prev, 
              location: bestMatch.city || prev.location, 
              category: bestMatch.niche || prev.category,
              requiresConfirmation: true,
              isAmbiguous: isAmbiguous || (bestScore < 0.85),
              matchedBusinessId: bestMatch.id || null
            }));
            console.log(`[LeadsPool] Weak/Ambiguous match found (${Math.round(bestScore * 100)}%): ${bestMatch.business_name}. Marked for confirmation.`);
          } else {
            setProfile(prev => ({ 
              ...prev, 
              requiresConfirmation: false,
              isAmbiguous: false 
            }));
          }
        } catch (err: any) {
          console.warn("Leads pool lookup skipped or unavailable:", err);
        }
      }
    }, 300);
    return () => clearTimeout(debounceSearch);
  }, [profile.name]);

  const [growthStats, setGrowthStats] = useState(() => {
    const saved = localStorage.getItem('lf_growth');
    return saved ? JSON.parse(saved) : {
      reviews: 0,
      posts: 0,
      leads: 0,
      roi: 0
    };
  });
  const [isTrialLocked, setIsTrialLocked] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(() => {
    return localStorage.getItem('lf_trial_start');
  });
  const hasUsedTrial = !!profile?.hasUsedTrial || 
                       localStorage.getItem('lf_has_used_trial') === 'true' || 
                       !!trialStartDate || 
                       profile?.plan === 'trial';
  const hasActivatedTrial = !!profile?.isPro || userSubscription?.status === 'active';

  const getTrialDaysRemaining = (): number => {
    let startMs: number | null = null;
    
    if (profile?.trialStartDate) {
      if (typeof profile.trialStartDate.toDate === 'function') {
        startMs = profile.trialStartDate.toDate().getTime();
      } else if (profile.trialStartDate.seconds) {
        startMs = profile.trialStartDate.seconds * 1000;
      } else {
        startMs = new Date(profile.trialStartDate).getTime();
      }
    } else if (trialStartDate) {
      startMs = new Date(trialStartDate).getTime();
    }
    
    if (!startMs) return 7;
    
    const nowServer = getSecureNow(); // using monotonic performance.now() secure clock offline fallback
    const elapsed = nowServer - startMs;
    const remainingMs = (7 * 24 * 60 * 60 * 1000) - elapsed;
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return Math.max(0, remainingDays);
  };

  useEffect(() => {
    if (hasActivatedTrial) {
      const remaining = getTrialDaysRemaining();
      const isPaidActive = profile?.subscriptionStatus === 'active';
      if (remaining <= 0 && !isPaidActive) {
        setIsTrialLocked(true);
      } else {
        setIsTrialLocked(false);
      }
    } else {
      setIsTrialLocked(false);
    }
  }, [hasActivatedTrial, trialStartDate, profile?.trialStartDate, profile?.subscriptionStatus, serverTimeOffset]);

  const activateTrial = async () => {
    if (hasUsedTrial) {
      showToast(t("Ya has utilizado tu período de prueba de 7 días. Selecciona un plan de pago para continuar.", "You have already used your 7-day trial period. Please select a paid plan to continue."), "info");
      setActiveTab('plans');
      return;
    }

    let currentUser = user;
    if (!currentUser) {
      try {
        showToast(t("Iniciando sesión con Google para activar la prueba...", "Signing in with Google to activate trial..."), "info");
        const loggedUser = await loginWithGoogle();
        if (!loggedUser) {
          showToast(t("Debes iniciar sesión para activar la prueba Pro.", "You must be logged in to activate the Pro trial."), "error");
          return;
        }
        currentUser = loggedUser;
        setUser(loggedUser);
        localStorage.setItem('lf_authorized', 'true');
        setIsAuthorized(true);
      } catch (loginErr: any) {
        console.error("Error activating trial with login:", loginErr?.code || 'AUTH_ERROR');
        const msg = getHumanAuthErrorMessage(loginErr, language);
        showToast(msg, loginErr?.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
        return;
      }
    }

    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/activate-trial', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json().catch(() => ({})) as { error?: string };

      if (!res.ok) {
        const errorMsg = data?.error || t("Error al activar la prueba Pro.", "Error activating Pro trial.");
        showToast(errorMsg, "error");
        if (data?.error && data.error.includes("ya")) {
          localStorage.setItem('lf_has_used_trial', 'true');
          setActiveTab('plans');
        }
        return;
      }

      const now = new Date().toISOString();
      setTrialStartDate(now);
      localStorage.setItem('lf_trial_start', now);
      localStorage.setItem('lf_has_used_trial', 'true');
      setProfile(prev => prev ? {
        ...prev,
        isPro: true,
        plan: 'trial',
        subscriptionStatus: 'trialing',
        hasUsedTrial: true,
        trialStartDate: now
      } : prev);

      notifyOwner({
        event: 'signup_or_trial',
        emailOrUid: currentUser?.email || currentUser?.uid,
        details: { plan: 'trial' }
      });

      showToast(t("¡Prueba Pro activada con éxito!", "Pro trial successfully activated!"), "success");
    } catch (err) {
      console.error("Error calling /api/activate-trial:", err);
      showToast(t("Error de conexión al activar la prueba Pro.", "Connection error activating Pro trial."), "error");
    }
  };
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem('lf_authorized') === 'true';
  });
  const [isCreatorMode, setIsCreatorMode] = useState<boolean>(false);


  const getTabTitle = (tab: Tab) => {
    switch (tab) {
      case 'dashboard': return t("Inicio", "Home");
      case 'reviews': return t("Reseñas", "Reviews");
      case 'social': return t("Post Social", "Social Posts");
      case 'leads': return t("CRM & Leads", "CRM & Leads");
      case 'pricing': return t("Tarifas", "Pricing");
      case 'growth': return t("Crecimiento", "Growth");
      case 'profile': return t("Negocio", "Profile");
      case 'website': return t("Mi Web", "My Web");
      case 'plans': return t("Suscripción", "Subscription");
      case 'tools': return t("Herramientas", "Tools");
      case 'accounting': return t("Contabilidad", "Accounting");
      case 'eod': return t("Cierre Diario", "Daily Close");
      case 'estimator': return t("Estimador", "Estimator");
      default: return tab;
    }
  };

  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('lf_streak');
    return saved ? parseInt(saved) : 0;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('lf_theme') !== 'light';
  });
  const [credits, setCredits] = useState<number>(3); // Keep as a dummy static value to avoid broken references
  const [showProModal, setShowProModal] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitModalInfo, setLimitModalInfo] = useState<any>(null);
  const [profileSubTab, setProfileSubTab] = useState<'info' | 'google' | 'customize' | 'install' | 'account'>('info');

  useEffect(() => {
    const handleLimitEvent = (e: any) => {
      if (e.detail) {
        setLimitModalInfo(e.detail);
        setLimitModalOpen(true);
      }
    };
    window.addEventListener(EVENT_LIMIT_REACHED, handleLimitEvent);
    return () => window.removeEventListener(EVENT_LIMIT_REACHED, handleLimitEvent);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
    localStorage.setItem('lf_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('lf_lang', language);
  }, [language]);
  const [aiStatus, setAiStatus] = useState<'online' | 'error' | 'testing'>('online');
  const [showSupport, setShowSupport] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [landingTab, setLandingTab] = useState<'create' | 'auth'>('create');

  // Integraciones Webhooks
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('lf_webhook_url') || '');
  const [isWebhookEnabled, setIsWebhookEnabled] = useState(() => localStorage.getItem('lf_webhook_enabled') === 'true');

  // Virtualización de Listas (Paginación Ligera)
  const [leadsPageSize, setLeadsPageSize] = useState(10);
  const [transactionsPageSize, setTransactionsPageSize] = useState(10);

  // Simulación de OTP / Enlace Mágico
  const [magicEmail, setMagicEmail] = useState('');
  const [magicOtp, setMagicOtp] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  // Portal de Clientes con Efecto Viral
  const [openedPortalInvoice, setOpenedPortalInvoice] = useState<Transaction | null>(null);
  const [portalInvoiceStatus, setPortalInvoiceStatus] = useState<'pendiente' | 'pagado'>('pendiente');
  const [showPortalConfetti, setShowPortalConfetti] = useState(false);

  const nicheKeywords: Record<string, string[]> = {
    limpieza: ["Maid Service", "Move out cleaning", "Pressure washing", "Carpet cleaning", "Deep cleaning"],
    jardineria: ["Lawn Care", "Landscaping near me", "Tree trimming", "Sprinkler repair", "Sod installation"],
    restaurante: ["Best restaurants", "Delivery near me", "Catering services", "Lunch specials", "Takeout"],
    aire_acondicionado: ["AC repair near me", "HVAC service", "Emergency AC fix", "Air duct cleaning", "Heating repair"],
    pest_control: ["Exterminator near me", "Termite treatment", "Ant control", "Rodent removal", "Bed bug treatment"],
    construccion: ["General contractor", "Kitchen remodeling", "Bathroom renovation", "Home additions", "Handyman"],
    piscina: ["Pool cleaning", "Pool maintenance", "Pool repair", "Weekly pool service", "Water testing"],
    nieve: ["Snow removal", "Snow plowing", "Ice removal", "Salt spreading", "Winter services"],
    techado: ["Roofing repair", "Roof installation", "Roof leak fix", "Shingle replacement", "New roof"],
    solar: ["Solar panel installation", "Solar energy", "Solar repair", "Clean energy", "Solar consultation"],
    handyman: ["Handyman services", "Home repairs", "Furniture assembly", "Drywall repair", "Small fixes"],
    mascotas: ["Pet grooming", "Dog walking", "Pet sitting", "Pet training", "Animal care"],
    mudanzas: ["Moving services", "Local movers", "Hauling services", "Packing help", "Long distance moving"],
    bienestar: ["Personal trainer", "Yoga classes", "Wellness coaching", "Fitness programs", "Gym near me"],
    cerrajeria: ["Locksmith near me", "Emergency locksmith", "Key duplication", "Car key replacement", "Lock installation"],
    arborista: ["Tree removal", "Tree trimming", "Stump grinding", "Arborist near me", "Tree doctor"],
    puertas_garaje: ["Garage door repair", "Garage door opener fix", "Spring replacement", "New garage door", "Roll up door"],
    electricidad: ["Electrician near me", "Electrical repair", "Panel upgrade", "Lighting installation", "Outlet repair"],
    lavado_presion: ["Pressure washing", "Power washing", "Driveway cleaning", "House washing", "Roof cleaning"],
    limpieza_alfombras: ["Carpet cleaning", "Upholstery cleaning", "Stain removal", "Rug cleaning", "Steam cleaning"],
    remocion_escombros: ["Junk removal", "Trash hauling", "Debris clean up", "Furniture removal", "Dumpster rental"],
    restauracion: ["Water damage restoration", "Mold remediation", "Flood cleanup", "Fire damage repair", "Smoke restoration"],
    gruas: ["Towing service", "Emergency towing", "Roadside assistance", "Flat tire help", "Car lockout"],
    electrodomesticos: ["Appliance repair", "Refrigerator repair", "Washer dryer fix", "Oven repair", "Dishwasher service"],
    detallado_autos: ["Car detailing", "Mobile auto detailing", "Car wash near me", "Ceramic coating", "Interior deep clean"],
    pisos_epoxicos: ["Epoxy flooring", "Garage floor coating", "Epoxy installers", "Commercial flooring", "Metallic epoxy"],
    cercas: ["Fence installation", "Fence repair", "Wood fence", "Vinyl fencing", "Chain link fence"],
    concreto: ["Concrete contractor", "Concrete driveway", "Patio installation", "Concrete repair", "Stamped concrete"],
    chimeneas: ["Chimney sweep", "Chimney repair", "Chimney inspection", "Fireplace cleaning", "Flue liner"],
    ventanas_puertas: ["Window installation", "Door replacement", "Sliding door repair", "Energy efficient windows", "Entry doors"],
    default: ["Local services", "Best rated", "Near me", "Reviews", "Professional"]
  };

  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('lf_simple_mode');
    return saved ? JSON.parse(saved) : true;
  });
  const [enabledTabs, setEnabledTabs] = useState<Record<Tab, boolean>>(() => {
    const saved = localStorage.getItem('lf_enabled_tabs');
    const defaultTabs: Record<Tab, boolean> = {
      dashboard: true,
      business_scan: true,
      reviews: true,
      social: true,
      leads: true,
      pricing: true,
      growth: true,
      profile: true,
      plans: true,
      tools: true,
      accounting: true,
      eod: true,
      website: true,
      estimator: true,
      action_center: true,
    };
    return saved ? { ...defaultTabs, ...JSON.parse(saved) } : defaultTabs;
  });

  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => {
    return localStorage.getItem('lf_custom_gemini_key') || '';
  });

  const spendCredit = (): boolean => {
    if (customGeminiKey) {
      return true;
    }
    if (hasActivatedTrial) {
      const remaining = getTrialDaysRemaining();
      if (remaining > 0) {
        return true;
      } else {
        setIsTrialLocked(true);
        return false;
      }
    }
    if (hasUsedTrial) {
      setIsTrialLocked(true);
      return false;
    }
    // No activated trial, show upgrade/trial starter modal
    setShowProModal(true);
    return false;
  };

  const renderSubTabs = (labels: string[]) => {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 pt-1 mb-3 md:pb-4 md:mb-4 -mx-4 px-4 border-b border-slate-100 dark:border-slate-900 no-scrollbar">
        {labels.map((label, idx) => (
          <button
            key={idx}
            id={`subtab-${idx}`}
            onClick={() => setActiveSubRow(idx)}
            className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              activeSubRow === idx
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-105'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
        {/* Trailing spacer to ensure the last tab can be fully scrolled and seen on mobile */}
        <div className="w-6 shrink-0 h-px" />
      </div>
    );
  };

  // Review Form States
  const [revClientName, setRevClientName] = useState('');
  const [revClientPhone, setRevClientPhone] = useState('');
  const [revGoogleLink, setRevGoogleLink] = useState('');
  const [reviewResult, setReviewResult] = useState('');
  const [selectedStars, setSelectedStars] = useState(5);
  const [clickedStarIndex, setClickedStarIndex] = useState<number | null>(null);

  // Reply Assistant States
  const [replyRawReview, setReplyRawReview] = useState('');
  const [replyCity, setReplyCity] = useState('');
  const [replyService, setReplyService] = useState('');
  const [replyResult, setReplyResult] = useState('');
  const [replyTone, setReplyTone] = useState<'professional' | 'empathetic' | 'damage_control'>('professional');

  // Lead Pitch Generator States
  const [activePitchCompany, setActivePitchCompany] = useState<LocalBusinessOpportunityData | null>(null);
  const [pitchResult, setPitchResult] = useState<string>('');
  const [structuredPitch, setStructuredPitch] = useState<GeneratedPitchData | null>(null);
  const [isPitchLoading, setIsPitchLoading] = useState<boolean>(false);
  const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());

  // Social Generator States
  const [socialContentLanguage, setSocialContentLanguage] = useState<'en' | 'es'>('en');
  const [socialDesc, setSocialDesc] = useState('');
  const [socialContext, setSocialContext] = useState('');
  const [imgBefore, setImgBefore] = useState<string | null>(null);
  const [imgAfter, setImgAfter] = useState<string | null>(null);
  const [socialResult, setSocialResult] = useState('🌟 Job completed successfully! 🛠️\n\nToday we finished this premium project for our local client. We took care of every detail to ensure the highest quality and an impeccable finish. 🏡✨\n\nWant to improve your property with a team you can fully trust? Contact us to get a tailored estimate! 📞\n\n#ProfessionalServices #QualityWork #LocalImprovements #PremiumServices #Maintenance #HappyClients');
  const [isRecording, setIsRecording] = useState(false);
  const [socialTemplate, setSocialTemplate] = useState<string>('default');

  // Video script states removed as per user request

  // Custom UI Toast Notifications (Replaces raw alert popup windows to work beautifully inside frames)
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Structured Manual Lead Entry Modal States
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);
  const [manualLeadName, setManualLeadName] = useState('');
  const [manualLeadPhone, setManualLeadPhone] = useState('');
  const [manualLeadEmail, setManualLeadEmail] = useState('');
  const [manualLeadService, setManualLeadService] = useState('');
  const [manualLeadBudget, setManualLeadBudget] = useState('');
  const [manualLeadUrgency, setManualLeadUrgency] = useState<'Alta' | 'Media' | 'Baja'>('Media');

  // Native FCM Push Notifications Listener
  useEffect(() => {
    listenToFcmMessages((payload) => {
      const title = payload?.notification?.title || t("🚨 Nuevo Lead Capturado", "🚨 New Lead Captured");
      const body = payload?.notification?.body || t("Tienes una nueva oportunidad de servicio pendiente.", "You have a new service lead pending.");
      
      // Load current notification settings (default to true if not set yet)
      const settings = profile?.notificationSettings || { newLeads: true, pendingReviews: true, priceAlerts: true };
      
      // Determine the category of incoming push alert
      const textForCategory = (title + " " + body).toLowerCase();
      const isLead = textForCategory.includes("lead") || textForCategory.includes("oportunidad") || textForCategory.includes("prospecto");
      const isReview = textForCategory.includes("reseña") || textForCategory.includes("opinión") || textForCategory.includes("review");
      const isPrice = textForCategory.includes("precio") || textForCategory.includes("tarifa") || textForCategory.includes("price") || textForCategory.includes("presupuesto");
      
      if (isLead && !settings.newLeads) {
        console.log("FCM Lead push alert suppressed by user settings");
        return;
      }
      if (isReview && !settings.pendingReviews) {
        console.log("FCM Review push alert suppressed by user settings");
        return;
      }
      if (isPrice && !settings.priceAlerts) {
        console.log("FCM Price/Rate push alert suppressed by user settings");
        return;
      }

      showToast(`${title}: ${body}`, "success");
      
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/bvelt-icon-192.png' });
        } catch (e) {
          console.warn("Native Notification trigger error:", e);
        }
      }
    });
  }, [profile?.notificationSettings, user, isFirebaseReady]);

  // Auto-trigger the tour guide if user has complete profile but has not seen the tour
  useEffect(() => {
    if (showOnboarding) return; // Do NOT trigger tour guide while onboarding modal is open!
    if (profile?.name && profile.name !== 'Local Business') {
      const hasSeenTour = localStorage.getItem('lf_has_seen_tour') === 'true';
      if (!hasSeenTour) {
        const timer = setTimeout(() => {
          setShowTourGuide(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [profile?.name, showOnboarding]);

  // Leads States
  const [leadRawText, setLeadRawText] = useState('');
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('lf_leads');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentLeadAnalysis, setCurrentLeadAnalysis] = useState<any>(null);
  const [lastAnalyzedDraft, setLastAnalyzedDraft] = useState<{
    draft: string;
    phone?: string;
    rawText: string;
    clientName?: string;
    leadId?: string;
    urgency?: string;
    suggestedRange?: string;
  } | null>(null);

  // Accounting States
  const [clientTransactions, setClientTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('lf_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [newClientName, setNewClientName] = useState('');
  const [newClientAmount, setNewClientAmount] = useState('');
  const [newClientStatus, setNewClientStatus] = useState<'pendiente' | 'pagado'>('pendiente');

  // Service Worker Offline Data Synchronization
  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_OFFLINE_DATA',
        leads,
        transactions: clientTransactions
      });
    }
  }, [leads, clientTransactions]);

  const totalCobrado = useMemo(() => {
    return clientTransactions.filter(t => t.status === 'pagado').reduce((acc, curr) => acc + curr.amount, 0);
  }, [clientTransactions]);

  const totalPendiente = useMemo(() => {
    return clientTransactions.filter(t => t.status === 'pendiente').reduce((acc, curr) => acc + curr.amount, 0);
  }, [clientTransactions]);

  // Mobile Sticky Primary Task & CTA
  const [isStickyCtaDismissed, setIsStickyCtaDismissed] = useState<boolean>(false);

  const actionablePendingLeads = useMemo(() => {
    return getActionableLeadsAwaitingReply(leads, profile);
  }, [leads, profile]);

  const pendingLeadsCount = actionablePendingLeads.length;

  const priorityQueueItem = useMemo(() => {
    return getTopPriorityItem({
      leads,
      profile,
      lang: language,
    });
  }, [leads, profile, language]);

  const pendingPrimaryTask = useMemo(() => {
    if (priorityQueueItem) {
      return {
        id: priorityQueueItem.id,
        dismissKey: priorityQueueItem.dismissKey,
        title: priorityQueueItem.title,
        desc: priorityQueueItem.desc,
        actionLabel: priorityQueueItem.actionLabel,
        tab: priorityQueueItem.tab as Tab,
        subRow: priorityQueueItem.subRow,
        badge: priorityQueueItem.badge,
        badgeColor: priorityQueueItem.badgeColor || 'bg-rose-500',
        icon: priorityQueueItem.icon
      };
    }
    return {
      id: 'task_growth',
      dismissKey: 'task_growth_default',
      title: t("Acción prioritaria de crecimiento", "Priority growth action ready"),
      desc: t("Optimiza tu visibilidad en el mapa local", "Optimize your visibility on local map"),
      actionLabel: t("Ver Acción", "View Action"),
      tab: 'action_center' as Tab,
      subRow: 0,
      badge: '1',
      badgeColor: 'bg-indigo-500',
      icon: 'zap'
    };
  }, [priorityQueueItem, t]);

  const handleExecutePriorityAction = () => {
    if (priorityQueueItem?.id === 'task_actionable_leads') {
      navigateTo({
        tab: 'answer_leads',
        leadId: priorityQueueItem.leadId
      });
      routeToAnswerLeads(leads, {
        setActiveTab,
        setActiveSubRow,
        setSelectedMobileView,
        showToast,
        lang: language,
        profile,
        targetLeadId: priorityQueueItem.leadId,
        focusFirstLead: true,
      });
    } else if (priorityQueueItem) {
      navigateTo({
        tab: priorityQueueItem.tab,
        subRow: priorityQueueItem.subRow,
        leadId: priorityQueueItem.leadId,
        scrollId: priorityQueueItem.scrollId
      });
      setActiveTab(priorityQueueItem.tab as Tab);
      if (priorityQueueItem.subRow !== undefined) {
        setActiveSubRow(priorityQueueItem.subRow);
      }
      setSelectedMobileView('tab');
    } else {
      navigateTo({ tab: 'action_center' });
      setActiveTab('action_center');
      setSelectedMobileView('tab');
    }
  };

  const handleDismissPriorityAction = () => {
    if (pendingPrimaryTask?.dismissKey) {
      dismissPriority(pendingPrimaryTask.dismissKey);
    }
    setIsStickyCtaDismissed(true);
  };

  const shouldShowStickyCta = isMobile && selectedMobileView === 'tab' && !isStickyCtaDismissed && Boolean(priorityQueueItem) && activeTab !== pendingPrimaryTask.tab;

  const realProImpact = useMemo(() => {
    const paidTrans = clientTransactions
      .filter(t => !t.isDemo && !t.id?.startsWith('dt-') && t.status === 'pagado')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const wonLeads = leads
      .filter(l => isBusinessLead(l, profile) && (l.status === 'WON' || l.status === 'PAID'))
      .reduce((acc, curr) => acc + (curr.value || (curr as any).actualRevenue || 0), 0);
    return paidTrans + wonLeads;
  }, [clientTransactions, leads, profile]);

  const realTrustScore = useMemo(() => {
    let score = 100;
    if (profile.name && profile.name !== 'Local Business') score += 250;
    if (profile.services && profile.services.length > 0) score += 150;
    if (profile.gmbLink) score += 200;
    tasks.forEach(task => {
      if (task.completed) score += (task.points || 25);
    });
    return score;
  }, [profile, tasks]);

  const monthlyRevenueData = useMemo(() => {
    const monthNames = [
      t("Ene", "Jan"), t("Feb", "Feb"), t("Mar", "Mar"), t("Abr", "Apr"),
      t("May", "May"), t("Jun", "Jun"), t("Jul", "Jul"), t("Ago", "Aug"),
      t("Sep", "Sep"), t("Oct", "Oct"), t("Nov", "Nov"), t("Dic", "Dec")
    ];
    
    const now = new Date();
    const monthsMap: Record<string, { month: string; paid: number; pending: number; total: number }> = {};
    
    // Initialize last 6 months rolling window
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthsMap[mLabel] = { month: mLabel, paid: 0, pending: 0, total: 0 };
    }
    
    clientTransactions.forEach(tx => {
      if (!tx.date) return;
      let txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) {
        txDate = new Date();
      }
      const mLabel = `${monthNames[txDate.getMonth()]} ${txDate.getFullYear().toString().slice(-2)}`;
      if (!monthsMap[mLabel]) {
        monthsMap[mLabel] = { month: mLabel, paid: 0, pending: 0, total: 0 };
      }
      const amt = Number(tx.amount) || 0;
      if (tx.status === 'pagado') {
        monthsMap[mLabel].paid += amt;
      } else {
        monthsMap[mLabel].pending += amt;
      }
      monthsMap[mLabel].total += amt;
    });

    return Object.values(monthsMap);
  }, [clientTransactions, language, t]);

  // Calculator & Market States
  const [calcBase, setCalcBase] = useState('');
  const [calcTax, setCalcTax] = useState('10');
  
  // Quick Estimate States
  const [estClientName, setEstClientName] = useState('');
  const [estDetails, setEstDetails] = useState('');
  const [estPrice, setEstPrice] = useState('');
  
  // Market Gap
  const [myReviews, setMyReviews] = useState('');
  const [compReviews, setCompReviews] = useState('');
  const [gapResult, setGapResult] = useState<string | null>(null);
  const [isGapLoading, setIsGapLoading] = useState(false);
  const [gapLoadingStep, setGapLoadingStep] = useState('');

  // Scraper Simulation States
  const [importedLeadIds, setImportedLeadIds] = useState<Set<string>>(new Set());
  const [scrappedLeads, setScrappedLeads] = useState<any[]>([]);
  const [scrapingStatus, setScrapingStatus] = useState<'idle' | 'connecting' | 'searching' | 'saving' | 'done' | 'error'>('idle');
  const [scrapingProgress, setScrapingProgress] = useState<string[]>([]);

  // UGC crowdsourced state
  const [ugcCosts, setUgcCosts] = useState<any[]>([
    { id: '1', task: 'Revestimiento y Acabados de Superficies', average: 3.50, min: 2.80, max: 4.50, unit: 'sq ft' },
    { id: '2', task: 'Servicio Mantenimiento Técnico Preventivo', average: 65.00, min: 50.00, max: 90.00, unit: 'hora' },
    { id: '3', task: 'Soporte y Monitoreo Recurrente Mensual', average: 250.00, min: 180.00, max: 350.00, unit: 'mes' },
    { id: '4', task: 'Instalación de Iluminación LED Inteligente', average: 140.00, min: 110.00, max: 180.00, unit: 'unidad' },
    { id: '5', task: 'Diagnóstico de Distribución y Reparación', average: 120.00, min: 95.00, max: 150.00, unit: 'visita' }
  ]);
  const [showCostToast, setShowCostToast] = useState(false);
  const [newUgcTask, setNewUgcTask] = useState('');
  const [newUgcAvg, setNewUgcAvg] = useState('');
  const [newUgcUnit, setNewUgcUnit] = useState('sq ft');

  // Dark Pool (Shared Leads)
  const [darkPool, setDarkPool] = useState<{id: string, text: string, date: string}[]>(() => {
    const saved = localStorage.getItem('lf_dark_pool');
    return saved ? JSON.parse(saved) : [];
  });
  const [darkLeadText, setDarkLeadText] = useState('');

  // Growth & SEO States
  const [seoScore, setSeoScore] = useState(65);
  const [seoAudit, setSeoAudit] = useState<string[]>([]);
  const [isSeoLoading, setIsSeoLoading] = useState(false);
  const [isAutoFixingSeo, setIsAutoFixingSeo] = useState<string | null>(null);
  const [generatedGbpPost, setGeneratedGbpPost] = useState<{ issue: string, postText: string } | null>(null);
  const [multiAgentResult, setMultiAgentResult] = useState<MultiAgentScanResponse | null>(null);
  const [isMultiAgentLoading, setIsMultiAgentLoading] = useState(false);
  const [onboardingHookResult, setOnboardingHookResult] = useState<OnboardingHookOutput | null>(null);
  const [isOnboardingHookLoading, setIsOnboardingHookLoading] = useState<boolean>(false);
  const [onboardingLoadingStep, setOnboardingLoadingStep] = useState<string>('');
  const [sampleReviewForAgent, setSampleReviewForAgent] = useState(() => {
    const lang = detectClientLanguage();
    return lang === 'es'
      ? "Increíble trabajo profesional, llegaron rápido y dejaron todo súper limpio. ¡Recomendado 100%!"
      : "Amazing professional work, they arrived quickly and left everything super clean. 100% recommended!";
  });
  const [whatsappMessageForAgent, setWhatsappMessageForAgent] = useState(() => {
    const lang = detectClientLanguage();
    return lang === 'es'
      ? "Su presupuesto es un poco elevado comparado con la otra compañía local, ¿pueden ajustar el precio u ofrecer alguna forma de financiación?"
      : "Your estimate is a bit high compared to the other local company, can you adjust the price or offer some financing options?";
  });

  // Template Rewrite States & Tones (Agente 7)
  const [followUpTemplate, setFollowUpTemplate] = useState<string>('');
  const [followUpTone, setFollowUpTone] = useState<'directo' | 'amigable' | 'urgente'>('directo');
  const [isRewritingFollowUp, setIsRewritingFollowUp] = useState(false);

  const [reactivateTemplate, setReactivateTemplate] = useState<string>('');
  const [reactivateTone, setReactivateTone] = useState<'directo' | 'amigable' | 'urgente'>('amigable');
  const [isRewritingReactivate, setIsRewritingReactivate] = useState(false);

  const [autoResponderSms, setAutoResponderSms] = useState<string>('');
  const [autoResponderTone, setAutoResponderTone] = useState<'cercano' | 'ejecutivo' | 'rapido'>('cercano');
  const [isRewritingAutoResponder, setIsRewritingAutoResponder] = useState(false);

  const [photoToPostImage, setPhotoToPostImage] = useState<string | null>(null);
  const [photoToPostResult, setPhotoToPostResult] = useState<{post: string, budget: string} | null>({
    post: language === 'es' ? "✅ Trabajo Profesional Completado. \n\nAcabamos de terminar este excelente proyecto para un cliente, siempre manteniendo la más alta calidad y un servicio rápido. \n\n#LocalServices #CalidadGarantizada" : "✅ Professional Work Completed. \n\nWe just finished this excellent project for a client, always maintaining the highest quality and fast service. \n\n#LocalServices #GuaranteedQuality",
    budget: "$450.00"
  });

  useEffect(() => {
    const esDefaultReview = "Increíble trabajo profesional, llegaron rápido y dejaron todo súper limpio. ¡Recomendado 100%!";
    const enDefaultReview = "Amazing professional work, they arrived quickly and left everything super clean. 100% recommended!";
    if (language === 'en' && sampleReviewForAgent === esDefaultReview) {
      setSampleReviewForAgent(enDefaultReview);
    } else if (language === 'es' && sampleReviewForAgent === enDefaultReview) {
      setSampleReviewForAgent(esDefaultReview);
    }

    const esDefaultObjection = "Su presupuesto es un poco elevado comparado con la otra compañía local, ¿pueden ajustar el precio u ofrecer alguna forma de financiación?";
    const enDefaultObjection = "Your estimate is a bit high compared to the other local company, can you adjust the price or offer some financing options?";
    if (language === 'en' && whatsappMessageForAgent === esDefaultObjection) {
      setWhatsappMessageForAgent(enDefaultObjection);
    } else if (language === 'es' && whatsappMessageForAgent === enDefaultObjection) {
      setWhatsappMessageForAgent(esDefaultObjection);
    }

    const esDefaultPost = "✅ Trabajo Profesional Completado. \n\nAcabamos de terminar este excelente proyecto para un cliente, siempre manteniendo la más alta calidad y un servicio rápido. \n\n#LocalServices #CalidadGarantizada";
    const enDefaultPost = "✅ Professional Work Completed. \n\nWe just finished this excellent project for a client, always maintaining the highest quality and fast service. \n\n#LocalServices #GuaranteedQuality";
    if (photoToPostResult) {
      if (language === 'en' && photoToPostResult.post === esDefaultPost) {
        setPhotoToPostResult({ post: enDefaultPost, budget: photoToPostResult.budget });
      } else if (language === 'es' && photoToPostResult.post === enDefaultPost) {
        setPhotoToPostResult({ post: esDefaultPost, budget: photoToPostResult.budget });
      }
    }
  }, [language, photoToPostResult]);



  const [demoVideoUrl, setDemoVideoUrl] = useState(() => {
    return localStorage.getItem('lf_demo_video_url') || '';
  });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [scriptStepsChecked, setScriptStepsChecked] = useState<boolean[]>(() => [false, false, false, false]);

  const runMultiAgentGrowthEngine = async () => {
    setIsMultiAgentLoading(true);
    setMultiAgentResult(null); // Limpiar pantalla vieja
    try {
      let locationText = profile.location;
      let coords = null;
      if (!locationText && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) { console.warn("Geo error", e); }
      }
      const res = await executeAndSaveAgentScan({

        dataMaps: { location: locationText, coords,  gmbLink: profile.gmbLink || "Google Maps Profile", trustPoints: profile.trustPoints },
        datosProyecto: { name: profile.name, category: profile.category, niche },
        reviewText: sampleReviewForAgent,
        whatsappMessage: whatsappMessageForAgent,
        language,
        niche,
        customGeminiKey,
        runAllAgents: true
      }, user?.uid);
      setMultiAgentResult(res);
      showToast(t("🤖 Arquitectura de optimización ejecutada y guardada", "🤖 Optimization architecture executed & saved"), "success");
    } catch (err: any) {
      showToast(err.message || "Error al ejecutar agentes", "error");
    } finally {
      setIsMultiAgentLoading(false);
    }
  };

  const runOnboardingHookScan = async () => {
    setIsOnboardingHookLoading(true);
    setOnboardingHookResult(null);
    
    const steps = language === 'es' ? [
      "El Agente 9 está analizando tu mercado local...",
      "Encontrando brechas de conversión de tu nicho...",
      "Sintetizando psicología de consumo...",
      "Escribiendo frases gancho personalizadas..."
    ] : [
      "Agent 9 is analyzing your local market...",
      "Detecting conversion gaps in your niche...",
      "Synthesizing consumer psychology...",
      "Writing personalized hooks..."
    ];

    let currentStep = 0;
    setOnboardingLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setOnboardingLoadingStep(steps[currentStep]);
      }
    }, 2500);

    try {
      const res = await executeOnboardingHook({
        name: profile.name,
        niche: niche,
        location: profile.location || "tu área local",
        language,
        customGeminiKey
      });
      clearInterval(stepInterval);
      setOnboardingHookResult(res);
      showToast(t("✨ ¡Gancho de conversión generado exitosamente!", "✨ Conversion hooks generated successfully!"), "success");
    } catch (err: any) {
      clearInterval(stepInterval);
      showToast(err.message || "Error al ejecutar la generación", "error");
    } finally {
      setIsOnboardingHookLoading(false);
    }
  };

  const runSeoAudit = async () => {
    if (isSeoLoading) return;
    setIsSeoLoading(true);
    const keywords = nicheKeywords[niche] || nicheKeywords.default;
    const prompt = language === 'es'
      ? `Analiza este negocio:
    Nicho: ${niche}
    Ubicación: ${profile.location}
    Nombre: ${profile.name}
    
    Genera un INFORME DE AUDITORÍA SEO LOCAL PROFESIONAL.
    Incluye:
    1. Un Análisis de Oportunidad de Mercado en ${profile.location}.
    2. Estrategia de Contenido usando estas palabras clave: ${keywords.join(', ')}.
    3. 3 Tácticas Técnicas de Google Business Profile para superar a la competencia local.
    4. Un Plan de Acción de 48 horas.
    
    Usa un tono de consultor de alto nivel. Sé específico para el nicho de ${niche}.`
      : `Analyze this business:
    Niche: ${niche}
    Location: ${profile.location}
    Name: ${profile.name}
    
    Generate a PROFESSIONAL LOCAL SEO AUDIT REPORT.
    Include:
    1. Market Opportunity Analysis in ${profile.location}.
    2. Content Strategy using these keywords: ${keywords.join(', ')}.
    3. 3 Technical Google Business Profile Tactics to outrank local competition.
    4. A 48-hour Action Plan.
    
    Use a high-level consultant tone. Be specific to the ${niche} niche.`;

    const systemInstruction = language === 'es'
      ? "Eres el Director de Estrategia de Bvelt, experto en dominar el 'Local Pack' de Google en USA. Tu respuesta debe ser estrictamente resumida, ejecutable y de alto impacto visual. Divide el plan de crecimiento en un máximo de 3 a 4 secciones o puntos clave perfectamente estructurados. Cada punto debe constar únicamente de un título corto en negrita y un párrafo de máximo 2 o 3 frases directas explicando la acción. Está terminantemente prohibido generar listas numeradas kilométricas o incluir líneas vacías con guiones (---)."
      : "You are the Director of Strategy at Bvelt, an expert in dominating the Google Local Pack in the US. Your response must be strictly summarized, actionable, and visually high-impact. Divide the growth plan into a maximum of 3 to 4 perfectly structured sections or key points. Each point must consist only of a short bold title and a paragraph of at most 2 or 3 direct sentences explaining the action. It is strictly forbidden to generate long numbered lists or include empty lines with dashes (---).";

    const result = await handleAiCall(prompt, systemInstruction);
    const lines = result.split('\n').filter((l: string) => l.trim().length > 0).map(l => l.trim().replace(/^[\d\.\-\*]+\s*/, ''));
    setSeoAudit(lines);
    const derivedScore = Math.max(68, Math.min(98, 100 - (lines.length * 4)));
    setSeoScore(derivedScore);
    setIsSeoLoading(false);
    showToast(t("Auditoría SEO Premium Lista", "Premium SEO Audit Ready"), "success");
  };

  const handleAutoFixSeo = async (line: string) => {
    setIsAutoFixingSeo(line);
    const keywords = nicheKeywords[niche] || nicheKeywords.default;
    const prompt = language === 'es'
      ? `Tengo este problema crítico de SEO detectado en mi perfil de Google Business Profile:
"${line}"

Por favor, genera un post/publicación de actualización de Google Business Profile (GBP) persuasivo, profesional y optimizado para SEO local que solucione o ayude a mitigar este problema.
Nombre del negocio: ${profile.name}
Nicho: ${niche}
Ubicación: ${profile.location || 'mi ciudad'}
Palabras clave recomendadas: ${keywords.join(', ')}

El post debe incluir:
1. Un gancho de entrada llamativo que atraiga al cliente local.
2. Contenido de valor relacionado con el servicio, destacando nuestra calidad y confiabilidad en la ubicación.
3. Un llamado a la acción (CTA) claro con número de contacto o link.
4. 3 a 5 hashtags locales relevantes.

No uses explicaciones externas. Genera ÚNICAMENTE el texto final de la publicación que copiaré y pegaré.`
      : `I have this critical SEO issue detected in my Google Business Profile:
"${line}"

Please generate a compelling, professional, and local SEO-optimized Google Business Profile (GBP) update/post to solve or mitigate this issue.
Business Name: ${profile.name}
Niche: ${niche}
Location: ${profile.location || 'my local area'}
Recommended keywords: ${keywords.join(', ')}

The post should include:
1. An eye-catching hook to attract local customers.
2. Value-packed content highlighting our quality and reliability in the area.
3. A clear Call to Action (CTA) with contact info or link.
4. 3 to 5 relevant local hashtags.

Do not use external explanations. Generate ONLY the final post text ready to copy-paste.`;

    const systemInstruction = language === 'es'
      ? "Eres el Director Creativo de Bvelt, experto en redactar publicaciones virales y de alto impacto para Google Business Profile que atraen clientes y posicionan localmente."
      : "You are the Creative Director of Bvelt, an expert in writing viral and high-impact posts for Google Business Profile that attract customers and boost local search rankings.";

    try {
      const customizedSystemInstruction = getHumanizedSystemInstruction(systemInstruction, language, profile.location);

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': customGeminiKey || ''
        },
        body: JSON.stringify({ prompt, systemInstruction: customizedSystemInstruction })
      });
      
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        let errText = "Error al conectar con el servidor.";
        if (ct.includes('application/json')) {
          try {
            const errData = await res.json() as { error?: string };
            if (errData.error) errText = errData.error;
          } catch (_) {}
        }
        showToast(errText, "error");
        return;
      }
      
      const data = await res.json().catch(() => ({ text: "" })) as { text?: string };
      
      setGeneratedGbpPost({
        issue: line,
        postText: data.text || "No se pudo generar el post."
      });
      showToast(t("¡Propuesta de post GBP generada exitosamente!", "GBP post drafted successfully!"), "success");
    } catch (err) {
      console.error("Error auto-fixing SEO:", err);
      showToast(t("Error de conexión al generar el post.", "Connection error while generating the post."), "error");
    } finally {
      setIsAutoFixingSeo(null);
    }
  };

  const generateJobReport = async (jobName: string) => {
    const prompt = language === 'es'
      ? `El negocio "${profile.name}" (${niche}) acaba de terminar el trabajo: "${jobName}" en ${profile.location}.
    Crea un "Reporte de Paz Mental" corto para enviar por WhatsApp al cliente.
    Debe incluir:
    1. Resumen amigable del trabajo hecho.
    2. Confirmación de "Estado del Sistema" (ej. Todo funcionando al 100%).
    3. Una nota de agradecimiento resaltando la confianza.
    4. Pedido sutil de reseña si quedó satisfecho.
    Usa un tono de servicio premium, muy amable y persuasivo.`
      : `The business "${profile.name}" (${niche}) just finished the job: "${jobName}" in ${profile.location}.
    Create a short "Peace of Mind Report" to send via WhatsApp to the client.
    It must include:
    1. Friendly summary of the work done.
    2. System Status confirmation (e.g. Everything running at 100%).
    3. A thank-you note highlighting trust.
    4. A subtle request for a review if they are satisfied.
    Use a premium, very friendly, and persuasive service tone.`;

    const systemInstruction = language === 'es'
      ? "Eres un Director de Experiencia al Cliente de lujo."
      : "You are a luxury Customer Experience Director.";

    const result = await handleGroqCall(prompt, systemInstruction);
    copyToClipboard(result);
    showToast(t("Reporte copiado y listo para enviar", "Trust report copied and ready to send"), "success");
  };

  const generateReferralRequest = async () => {
    const prompt = language === 'es'
      ? `Crea un mensaje de WhatsApp amigable para pedir una recomendación. 
    Contexto: Soy el dueño de "${profile.name}" (${niche}). El mensaje es para un cliente satisfecho en ${profile.location}.
    Usa un tono profesional, agradecido, y menciona que las recomendaciones de vecinos son lo más importante para nosotros. 
    Incluye un espacio para que yo pegue mi link: [LINK].`
      : `Create a friendly WhatsApp message to ask for a referral. 
    Context: I am the owner of "${profile.name}" (${niche}). The message is for a satisfied customer in ${profile.location}.
    Use a professional, grateful tone, and mention that referrals from neighbors are the most important thing to us. 
    Include a placeholder for me to paste my link: [LINK].`;

    const systemInstruction = language === 'es'
      ? "Eres un experto en psicología de ventas y servicio al cliente."
      : "You are an expert in sales psychology and customer service.";

    const result = await handleGroqCall(prompt, systemInstruction);
    copyToClipboard(result);
    setReferralCount(c => c + 1);
    showToast(t("Mensaje de Referidos copiado", "Referral message copied"), "success");
  };

  const generatePortfolioStory = async () => {
    if (!imgBefore && !imgAfter) {
      showToast(t("Sube al menos una foto (Antes o Después) primero", "Upload at least one photo (Before or After) first"), "info");
      return;
    }
    const prompt = language === 'es'
      ? `Crea un pie de foto (caption) impactante para Instagram/Facebook Stories.
    Negocio: ${profile.name} (${niche}) en ${profile.location}.
    Acción: Acabamos de terminar un proyecto increíble.
    Estilo: Storytelling corto, usa emojis, resalta la calidad y la transformación.
    Incluye hashtags locales de ${profile.location}.`
      : `Create an impactful caption for Instagram/Facebook Stories.
    Business: ${profile.name} (${niche}) in ${profile.location}.
    Action: We just finished an incredible project.
    Style: Short storytelling, use emojis, highlight quality and transformation.
    Include local hashtags of ${profile.location}.`;

    const systemInstruction = language === 'es'
      ? "Eres un Social Media Manager creativo."
      : "You are a creative Social Media Manager.";

    const result = await handleAiCall(prompt, systemInstruction, imgAfter || imgBefore || undefined);
    copyToClipboard(result);
    setPortfolioStats(s => ({ ...s, stories: s.stories + 1 }));
    showToast(t("Caption para Story copiado", "Story caption copied"), "success");
  };
  const [trustPoints, setTrustPoints] = useState(850);
  const [eodShowModal, setEodShowModal] = useState(false);
  const [eodPoints, setEodPoints] = useState(0);
  const [eodPlaying, setEodPlaying] = useState(false);
  const [eodOscillator, setEodOscillator] = useState<any>(null);
  const [eodWavOffset, setEodWavOffset] = useState<number[]>([12, 24, 18, 8, 30, 15, 20, 10]);

  const playEodCoinSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (err) {
      console.warn("Audio Context blocked or unsupported:", err);
    }
  };

  const startEodSynth = async () => {
    try {
      if (eodPlaying) {
        stopEodSynth();
        return;
      }

      if (typeof window !== "undefined" && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const revCount = localStorage.getItem('bvelt_reviews_replied') || localStorage.getItem('localflow_reviews_replied') || '0';
      const postCount = localStorage.getItem('bvelt_posts_created') || localStorage.getItem('localflow_posts_created') || '0';
      const quoteCount = localStorage.getItem('bvelt_quotes_sent') || localStorage.getItem('localflow_quotes_sent') || '0';
      const bizName = profile?.name || (language === 'es' ? 'tu negocio' : 'your business');
      const locName = profile?.location || (language === 'es' ? 'tu zona' : 'your local area');
      const catName = profile?.category || (language === 'es' ? 'servicios locales' : 'local services');

      const textEn = `Strategic Briefing for ${bizName}. Market analysis indicates your local authority in ${locName} is currently optimized. We have identified high-intent customer clusters in the ${catName} sector. Recommendations: Publish a project completion update to maintain competitive visibility. Review response rate is within target parameters.`;

      const speechText = textEn;

      setEodPlaying(true);

      // 1. Try to play high-quality AI neural voice from our brand-new backend
      try {
        const response = await fetch("/api/generar-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-gemini-api-key": customGeminiKey || ""
          },
          body: JSON.stringify({ text: speechText, language })
        });

        const ct = response.headers.get("content-type") || "";
        if (response.ok && ct.includes("application/json")) {
          const data = await response.json().catch(() => null) as { success?: boolean, audio?: string } | null;
          if (data && data.success && data.audio) {
            const audioUrl = `data:audio/wav;base64,${data.audio}`;
            const audio = new Audio(audioUrl);
            eodAudioRef.current = audio;
            audio.onended = () => {
              stopEodSynth();
            };
            audio.onerror = () => {
              playFallbackSpeech(speechText);
            };
            audio.play();
            return;
          }
        }
      } catch (apiErr) {
        console.warn("AI neural voice synth failed, using browser fallback:", apiErr);
      }

      // 2. Play local browser-based fallback speech
      playFallbackSpeech(speechText);

    } catch (err) {
      console.error(err);
      setEodPlaying(false);
    }
  };

  const playFallbackSpeech = (speechText: string) => {
    if (typeof window !== "undefined" && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(speechText);
      const activeLang = language === 'es' ? 'es-ES' : 'en-US';
      utterance.lang = activeLang;
      
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = language === 'es' ? 'es' : 'en';
      const matchingVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith(langPrefix));
      
      const preferredVoice = matchingVoices.find(voice => 
        voice.name.includes('Google') || 
        voice.name.includes('Natural') || 
        voice.name.includes('Premium') || 
        voice.name.includes('Microsoft') ||
        voice.name.includes('Apple')
      ) || matchingVoices[0] || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log(`[TTS] Selected voice: ${preferredVoice.name} (${preferredVoice.lang})`);
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        stopEodSynth();
      };

      utterance.onerror = () => {
        stopEodSynth();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        stopEodSynth();
      }, 5000);
    }
  };
  
  const stopEodSynth = () => {
    if (eodAudioRef.current) {
      try {
        eodAudioRef.current.pause();
        eodAudioRef.current = null;
      } catch (e) {}
    }
    if (eodOscillator) {
      try {
        eodOscillator.stop();
      } catch (e) {}
      setEodOscillator(null);
    }
    if (typeof window !== "undefined" && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setEodPlaying(false);
  };

  useEffect(() => {
    let interval: any;
    if (eodPlaying) {
      interval = setInterval(() => {
        setEodWavOffset(prev => prev.map(() => Math.floor(Math.random() * 24) + 6));
      }, 150);
    }
    return () => clearInterval(interval);
  }, [eodPlaying]);
  const [showRouteOptimized, setShowRouteOptimized] = useState(false);
  const [voiceCommandResult, setVoiceCommandResult] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<'consultant' | 'sales'>('consultant');
  const [weatherWindow, setWeatherWindow] = useState<{status: string, color: string}>({status: 'Checking...', color: 'text-slate-400'});
  const [properties, setProperties] = useState<any[]>(() => {
    const saved = localStorage.getItem('bvelt_properties') || localStorage.getItem('localflow_properties');
    return saved ? JSON.parse(saved) : [
      { id: '1', address: '123 Main Street', client: 'Cliente Local 1', status: 'pending' },
      { id: '2', address: '456 Oak Avenue', client: 'Cliente Local 2', status: 'completed' },
      { id: '3', address: '789 Pine Road', client: 'Urbanización Ejemplo', status: 'pending' },
      { id: '4', address: '101 Cedar Blvd', client: 'Cliente Local 3', status: 'pending' }
    ];
  });

  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStopClient, setNewStopClient] = useState('');
  const [newCustomTaskTitle, setNewCustomTaskTitle] = useState('');
  const [newCustomTaskPoints, setNewCustomTaskPoints] = useState(30);

  const addStop = () => {
    if (!newStopAddress.trim()) return;
    const stop = {
      id: 'stop-' + Date.now(),
      address: newStopAddress.trim(),
      client: newStopClient.trim() || t('Cliente sin nombre', 'No Name Client'),
      status: 'pending'
    };
    setProperties([...properties, stop]);
    setNewStopAddress('');
    setNewStopClient('');
  };

  const removeStop = (id: string) => {
    setProperties(properties.filter(p => p.id !== id));
  };

  const openMapsDirectionsUrl = () => {
    const pendingStops = properties.filter(p => p.status === 'pending');
    if (pendingStops.length === 0) {
      showToast(t("¡No hay paradas pendientes hoy!", "No pending stops today!"), "info");
      return;
    }
    
    if (pendingStops.length === 1) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pendingStops[0].address)}`;
      window.open(url, '_blank');
    } else {
      const destination = pendingStops[pendingStops.length - 1].address;
      const waypoints = pendingStops.slice(0, -1).map(p => p.address).join('|');
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}`;
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    localStorage.setItem('lf_simple_mode', JSON.stringify(simpleMode));
  }, [simpleMode]);

  useEffect(() => {
    localStorage.setItem('lf_enabled_tabs', JSON.stringify(enabledTabs));
  }, [enabledTabs]);

  useEffect(() => {
    localStorage.setItem('lf_custom_gemini_key', customGeminiKey);
  }, [customGeminiKey]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab && !enabledTabs[activeTab]) {
      const remainingTabs = (Object.keys(enabledTabs) as Tab[]).filter(t => enabledTabs[t]);
      if (remainingTabs.length > 0) {
        const fallback = remainingTabs.includes('profile') ? 'profile' : remainingTabs[0];
        setActiveTab(fallback);
      }
    }
  }, [enabledTabs, activeTab]);

  useEffect(() => {
    // Initial data for Dark Pool if empty
    if (darkPool.length === 0) {
      setDarkPool([
        { id: 'dp1', text: t('Mantenimiento técnico y adecuación de local comercial', 'Technical maintenance and commercial premises adaptation'), date: t('Hace 2 horas', '2 hours ago') },
        { id: 'dp2', text: t('Limpieza profunda e higienización post-construcción en oficinas', 'Deep cleaning and post-construction sanitization in offices'), date: t('Hace 5 horas', '5 hours ago') },
        { id: 'dp3', text: t('Mejora estética e instalación de acabados profesionales en almacén', 'Aesthetic improvement and professional finishes installation in warehouse'), date: t('Ayer', 'Yesterday') }
      ]);
    }
  }, []);

  const shareRouteToWorker = (medium: 'whatsapp' | 'sms' = 'whatsapp') => {
    const routeText = properties
      .filter(p => p.status === 'pending')
      .map(p => `📍 ${p.address} (${p.client})`)
      .join('\n');
    const message = t(`📋 Ruta de Hoy:\n\n${routeText}\n\nPor favor envía foto al terminar.`, `📋 Today's Route:\n\n${routeText}\n\nPlease send a photo when finished.`);
    if (medium === 'whatsapp') {
      const wpUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(wpUrl, '_blank');
    } else {
      const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
      window.open(smsUrl, '_self');
    }
  };

  useEffect(() => {
    const fetchWeather = async () => {
      const lat = profile.lat || 25.7617;
      const lng = profile.lng || -80.1918;
      
      try {
        const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(4000)
          : undefined;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation_probability`, { signal });
        
        if (!response.ok) {
          setWeatherWindow({status: t("Condiciones ideales para trabajar", "Ideal conditions for work"), color: 'text-emerald-500'});
          return;
        }

        const data = await response.json() as { current_weather?: { weathercode: number } };
        
        if (data && data.current_weather) {
           const code = data.current_weather.weathercode;
           
           // Based on WMO Weather interpretation codes
           if (code >= 51 && code <= 67) {
              setWeatherWindow({status: t("Lluvia ligera, posible operar", "Light rain, operation possible"), color: 'text-amber-500'});
           } else if (code >= 71 || (code >= 80 && code <= 99)) {
              setWeatherWindow({status: t("Alerta: Mal clima detectado", "Alert: Bad weather detected"), color: 'text-red-500'});
           } else if (code >= 1 && code <= 3) {
              setWeatherWindow({status: t("Condiciones parcialmente nubladas", "Partly cloudy conditions"), color: 'text-sky-500'});
           } else {
              setWeatherWindow({status: t("Condiciones ideales para trabajar", "Ideal conditions for work"), color: 'text-emerald-500'});
           }
        }
      } catch (err) {
        setWeatherWindow({status: t("Condiciones ideales para trabajar", "Ideal conditions for work"), color: 'text-emerald-500'});
      }
    };
    
    // Only run if we basically know where they are
    if (profile.location) {
        fetchWeather();
    }
  }, [language, profile.location, profile.lat, profile.lng]);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    // Initialize Firebase
    initFirebase().then(res => {
      if (res && res.auth) {
        setIsFirebaseReady(true);
        // Check and resolve any incoming OAuth redirect results immediately
        checkRedirectResult().then(redirectUser => {
          if (redirectUser) {
            setUser(redirectUser);
            setIsAuthLoading(false);
            localStorage.setItem('lf_authorized', 'true');
            setIsAuthorized(true);
            loadFromFirestore(redirectUser.uid);

            // Resume pending checkout if user initiated purchase before redirect sign-in
            const rawPending = sessionStorage.getItem('pending_checkout') || localStorage.getItem('pending_checkout');
            if (rawPending) {
              try {
                sessionStorage.removeItem('pending_checkout');
                localStorage.removeItem('pending_checkout');
                const { priceId, planType } = JSON.parse(rawPending);
                if (planType || priceId) {
                  setTimeout(() => {
                    handleCheckout(priceId, planType || 'monthly');
                  }, 600);
                }
              } catch (e) {
                console.warn("[App] Error restoring pending checkout after redirect auth:", e);
              }
            }
          }
        }).catch(err => {
          console.warn("[App] Redirect result check non-blocking warning:", err);
        });

        unsubscribe = onAuthStateChanged(res.auth, (usr: any) => {
          const previousUid = user?.uid;
          setUser(usr);
          setIsAuthLoading(false);
          if (usr) {
            // If logging in as a different user, reset in-memory state first to prevent cross-contamination
            if (previousUid && previousUid !== usr.uid) {
              setLeads([]);
              setClientTransactions([]);
            }
            // Load from Firestore if user logged in
            loadFromFirestore(usr.uid);

            // Resume pending checkout if pending in storage
            const rawPending = sessionStorage.getItem('pending_checkout') || localStorage.getItem('pending_checkout');
            if (rawPending) {
              try {
                sessionStorage.removeItem('pending_checkout');
                localStorage.removeItem('pending_checkout');
                const { priceId, planType } = JSON.parse(rawPending);
                if (planType || priceId) {
                  setTimeout(() => {
                    handleCheckout(priceId, planType || 'monthly');
                  }, 600);
                }
              } catch (e) {
                console.warn("[App] Error restoring pending checkout after onAuthStateChanged:", e);
              }
            }
            
            // Sync profile name if empty
            setProfile(prev => {
              if (!prev.name || prev.name === 'Tu Negocio' || prev.name === 'Local Business') {
                return { ...prev, name: usr.displayName || prev.name };
              }
              return prev;
            });
          } else {
            // Clear snapshot listener on logout / unauth
            if (profileUnsubscribeRef.current) {
              profileUnsubscribeRef.current();
              profileUnsubscribeRef.current = null;
            }
          }
        });
      } else {
        setIsAuthLoading(false);
      }
    }).catch(() => {
      setIsAuthLoading(false);
    });

    let urlBiz = null;
    let urlCity = null;
    try {
      const params = new URLSearchParams(window.location.search);
      urlBiz = params.get('biz');
      urlCity = params.get('city');
    } catch (e) {
      console.error(e);
    }

    // Load persisted data from LS as fallback
    const savedProfile = localStorage.getItem('lf_profile');
    let hasValidSavedProfile = false;
    let parsedProfile: any = null;

    if (urlBiz || urlCity) {
      // Prioritize URL parameters if they exist (for direct sales links)
      parsedProfile = savedProfile ? JSON.parse(savedProfile) : {};
      const finalName = urlBiz || parsedProfile.name || 'Local Business';
      const finalLoc = urlCity || parsedProfile.location || '';
      
      hasValidSavedProfile = true; 
      
      setProfile(prev => {
        const newProfile = { ...prev, name: finalName, location: finalLoc };
        localStorage.setItem('lf_profile', JSON.stringify(newProfile));
        return newProfile;
      });
    } else if (savedProfile) {
      try {
        parsedProfile = JSON.parse(savedProfile);
        const loc = parsedProfile.location ? parsedProfile.location.trim() : '';
        const isMockLocation = !loc || 
          loc.toLowerCase() === 'local area' || 
          loc.toLowerCase() === 'tu área' ||
          loc.toLowerCase() === 'tu area' ||
          loc.toLowerCase() === 'mi ciudad' ||
          loc.toLowerCase() === 'unknown';

        if (parsedProfile && parsedProfile.name && !isMockLocation) {
          setProfile(parsedProfile);
          hasValidSavedProfile = true;
        } else if (parsedProfile) {
          // Keep other saved fields, but trigger fresh location lookup
          setProfile(parsedProfile);
        }
      } catch (err) {
        console.error('Error parsing saved profile:', err);
      }
    }

    if (!hasValidSavedProfile) {
      // Only show onboarding if there is no URL biz AND no valid saved profile name
      if (!parsedProfile?.name || parsedProfile.name === 'Local Business') {
         if (!urlBiz && !urlCity) {
            setTimeout(() => setShowOnboarding(true), 1500);
         }
      }
      
      const runLocationFallback = async () => {
        // 1. Valores por defecto por si todo falla (Miami como fallback)
        const isEn = (language === 'en') || (localStorage.getItem('lf_lang') === 'en');
        const defaultLocation = isEn ? 'Miami, FL' : 'La Habana, Cuba';
        const defaultLat = isEn ? 25.7617 : 23.1136;
        const defaultLng = isEn ? -80.1918 : -82.3666;

        // Check if IP service is in 429 backoff
        const now = Date.now();
        const backoffUntil = Number(sessionStorage.getItem('bvelt_ip_backoff_until') || 0);
        if (now < backoffUntil) {
          applyDefaultLocation(defaultLocation, defaultLat, defaultLng);
          return;
        }

        try {
          const res = await fetch('/api/geolocalizar');
          
          if (!res.ok) {
            if (res.status === 429) {
              try {
                sessionStorage.setItem('bvelt_ip_backoff_until', String(Date.now() + 10 * 60 * 1000));
              } catch {}
              console.info("[Geo] IP service rate-limited (429). Using default location with 10m quiet backoff.");
            } else {
              console.debug(`[Geo] Servidor respondió con código de error: ${res.status}. Usando ubicación por defecto.`);
            }
            applyDefaultLocation(defaultLocation, defaultLat, defaultLng);
            return;
          }

          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.debug("[Geo] La respuesta no es un JSON válido. Usando ubicación por defecto.");
            applyDefaultLocation(defaultLocation, defaultLat, defaultLng);
            return;
          }

          const ipData = await res.json() as { city?: string, region?: string, latitude?: number, longitude?: number };

          if (ipData && ipData.city && ipData.region) {
            const detectedLocation = `${ipData.city}, ${ipData.region}`;
            const lat = ipData.latitude || defaultLat;
            const lng = ipData.longitude || defaultLng;

            setProfile(prev => {
              if (prev.location && prev.location.trim().length > 0 && prev.location !== 'Local Area') {
                return prev;
              }
              const newProfile = {
                ...prev,
                name: prev.name || 'Local Business',
                category: prev.category || 'Local Services',
                phone: prev.phone || '',
                gmbLink: prev.gmbLink || '',
                location: detectedLocation,
                locationSource: 'BROWSER_NETWORK' as const,
                lat: lat,
                lng: lng
              };
              localStorage.setItem('lf_profile', JSON.stringify(newProfile));
              return newProfile;
            });
          } else {
            applyDefaultLocation(defaultLocation, defaultLat, defaultLng);
          }

        } catch (error) {
          // Si hay un error de red duro (sin internet), se captura aquí de forma segura sin romper nada
          console.debug("[Geo] Error silencioso en geolocalizar:", error);
          applyDefaultLocation(defaultLocation, defaultLat, defaultLng);
        }
      };

      // Función auxiliar para no repetir código de guardado en App.tsx
      const applyDefaultLocation = (location: string, lat: number, lng: number) => {
        setProfile(prev => {
          if (prev.location && prev.location.trim().length > 0) {
            return prev;
          }
          const newProfile = {
            ...prev,
            name: prev.name || 'Local Business',
            category: prev.category || 'Local Services',
            phone: prev.phone || '',
            gmbLink: prev.gmbLink || '',
            location: location,
            locationSource: 'DEMO_EXAMPLE' as const,
            lat: prev.lat || lat,
            lng: prev.lng || lng
          };
          localStorage.setItem('lf_profile', JSON.stringify(newProfile));
          return newProfile;
        });
      };

      try {
        const getGPSPositionAndNominatim = (): Promise<{ detectedLocation: string; lat: number; lng: number }> => {
          return new Promise((resolve, reject) => {
            if (!navigator || !navigator.geolocation) {
              reject(new Error("Geolocation not supported"));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                try {
                  if (!position || !position.coords) {
                    reject(new Error("No coords returned"));
                    return;
                  }
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  try {
                    const res = await fetchWithRetry(`/api/nominatim?endpoint=reverse&format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
                    if (!res.ok) {
                      throw new Error(`Nominatim HTTP error! status: ${res.status}`);
                    }
                    const contentType = res.headers.get("content-type");
                    if (!contentType || !contentType.includes("application/json")) {
                      throw new TypeError("Nominatim response is not JSON");
                    }
                    const data = await res.json() as { address?: { city?: string, town?: string, village?: string, county?: string, state?: string } };
                    const cityInfo = data.address?.city || data.address?.town || data.address?.village || data.address?.county;
                    const stateInfo = data.address?.state;
                    const detectedLocation = cityInfo && stateInfo ? `${cityInfo}, ${stateInfo}` : cityInfo || stateInfo || '';
                    
                    if (detectedLocation) {
                      resolve({ detectedLocation, lat, lng });
                    } else {
                      reject(new Error("Nominatim location parse empty"));
                    }
                  } catch(e) {
                    // Fallback to Current Location with coordinates
                    const isEn = (language === 'en') || (localStorage.getItem('lf_lang') === 'en');
                    const defaultName = isEn ? 'Current Location' : 'Ubicación Actual';
                    resolve({ detectedLocation: defaultName, lat, lng });
                  }
                } catch (err) {
                  reject(err);
                }
              },
              (err) => reject(err),
              { timeout: 2000, enableHighAccuracy: false }
            );
          });
        };

        const timeoutPromise = new Promise<{ detectedLocation: string; lat: number; lng: number }>((_, reject) => {
          setTimeout(() => reject(new Error("GPS_TIMEOUT")), 2500);
        });

        if (navigator && navigator.geolocation) {
          Promise.race([getGPSPositionAndNominatim(), timeoutPromise])
            .then((result) => {
              setProfile(prev => {
                const newProfile = { 
                  ...prev, 
                  name: parsedProfile?.name || prev.name || 'Local Business',
                  category: parsedProfile?.category || prev.category || 'Local Services',
                  phone: parsedProfile?.phone || prev.phone || '',
                  gmbLink: parsedProfile?.gmbLink || prev.gmbLink || '',
                  location: result.detectedLocation, 
                  locationSource: 'DEVICE' as const,
                  lat: result.lat, 
                  lng: result.lng 
                };
                localStorage.setItem('lf_profile', JSON.stringify(newProfile));
                return newProfile;
              });
              console.log("[Geo] GPS and reverse geocoding resolved successfully before 2.5s timeout.");
            })
            .catch(async (err) => {
              console.log(`[Geo] GPS/Nominatim failed or timed out (${err?.message}). Running IP fallback...`);
              await runLocationFallback();
            });
        } else {
          runLocationFallback();
        }
      } catch (outerGeolocError) {
        console.error("Outer geoloc initialization failed:", outerGeolocError);
        try {
          runLocationFallback();
        } catch (fbErr) {
          console.error("Fail-safe runLocationFallback failed:", fbErr);
        }
      }
    }

    const savedLeads = localStorage.getItem('lf_leads');
    if (savedLeads) setLeads(JSON.parse(savedLeads));

    const savedTransactions = localStorage.getItem('lf_transactions');
    if (savedTransactions) setClientTransactions(JSON.parse(savedTransactions));

    const savedStreak = localStorage.getItem('lf_streak');
    if (savedStreak) setStreak(parseInt(savedStreak));

    const savedDarkPool = localStorage.getItem('lf_dark_pool');
    if (savedDarkPool) setDarkPool(JSON.parse(savedDarkPool));

    const savedTheme = localStorage.getItem('lf_theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const savedLang = localStorage.getItem('lf_lang') as 'es' | 'en';
    if (savedLang === 'es' || savedLang === 'en') {
      setLanguage(savedLang);
    } else {
      const detected = detectClientLanguage();
      setLanguage(detected);
      localStorage.setItem('lf_lang', detected);
    }

    const savedNiche = localStorage.getItem('lf_niche') as Niche;
    if (savedNiche) setNiche(savedNiche);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }
    };
  }, []);

  const syncToFirestoreRef = useRef<any>(null);
  useEffect(() => {
    syncToFirestoreRef.current = syncToFirestore;
  });

  // Monitor network connectivity and handle incoming service worker message actions
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (user && isFirebaseReady) {
        if (syncToFirestoreRef.current) syncToFirestoreRef.current();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC_FIRESTORE') {
        console.log('[App.tsx] Service Worker background sync triggered TRIGGER_SYNC_FIRESTORE');
        if (user && isFirebaseReady) {
          if (syncToFirestoreRef.current) syncToFirestoreRef.current();
        }
      } else if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        console.log('[App.tsx] Notification clicked, navigating with data:', event.data.data);
        const { tab, leadId, scanRadius, subRow, scrollId } = event.data.data || {};
        navigateTo({
          tab: tab || (leadId ? 'answer_leads' : 'notification'),
          subRow,
          leadId,
          scanRadius,
          scrollId
        });
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      
      // Attempt registration of background sync tag
      if ('SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg: any) => {
          if (reg.sync) {
            reg.sync.register('sync-pending-requests').catch((err: any) => {
              // Degrades silently inside sandboxed preview iframes where background sync is restricted
              console.debug('Background sync registration unavailable (expected in sandboxed frames):', err?.message || err);
            });
          }
        }).catch((err) => {
          console.warn('Service worker check failed:', err);
        });
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [user, isFirebaseReady]);

  // Global listener for unified navigateTo helper across Dashboard, ActionCenter, Sticky CTA & SW
  useEffect(() => {
    const handleBveltNavigate = (e: any) => {
      const detail = (e.detail || {}) as ResolvedNavigation;
      if (!detail) return;
      if (detail.targetTab) {
        if ((detail.targetTab as any) === 'reactivation' || (detail.targetTab as any) === 'retention') {
          setActiveTab('leads');
          setActiveSubRow(5);
        } else if (detail.targetTab === 'leads') {
          setActiveTab('leads');
          if (detail.targetSubRow !== undefined) {
            setActiveSubRow(detail.targetSubRow);
          } else {
            setActiveSubRow(4);
          }
        } else if (detail.targetTab === 'reviews') {
          setActiveTab('reviews');
          if (detail.targetSubRow !== undefined) {
            setActiveSubRow(detail.targetSubRow);
          } else {
            setActiveSubRow(0);
          }
        } else {
          setActiveTab(detail.targetTab as Tab);
          if (detail.targetSubRow !== undefined) {
            setActiveSubRow(detail.targetSubRow);
          }
        }
        setSelectedMobileView('tab');
      } else if (detail.targetSubRow !== undefined) {
        setActiveSubRow(detail.targetSubRow);
      }
      if (detail.targetLeadId) {
        try {
          localStorage.setItem('crm_open_lead_id', detail.targetLeadId);
          localStorage.setItem('crm_lead_filter', 'ALL');
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('bvelt_open_lead', { detail: { leadId: detail.targetLeadId } }));
        } catch (err) {}
      }
    };

    window.addEventListener('bvelt_navigate', handleBveltNavigate as EventListener);

    // Initial query params deep-linking
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get('tab');
        const urlLeadId = urlParams.get('leadId');
        const urlScanRadius = urlParams.get('scanRadius');
        const urlSubRow = urlParams.get('subRow');
        const triggerScan = urlParams.get('triggerScan') === 'true';
        if (urlTab || urlLeadId || urlScanRadius) {
          navigateTo({
            tab: urlTab || undefined,
            subRow: urlSubRow !== null ? parseInt(urlSubRow, 10) : undefined,
            leadId: urlLeadId || undefined,
            scanRadius: urlScanRadius ? parseInt(urlScanRadius, 10) : undefined,
            triggerScan
          });
        }
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('bvelt_navigate', handleBveltNavigate as EventListener);
    };
  }, []);

  const loadFromFirestore = async (uid: string) => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) {
      console.warn("loadFromFirestore blocked: No authenticated user in SDK.");
      return;
    }
    if (auth.currentUser.uid !== uid) {
      console.warn("loadFromFirestore blocked: UID mismatch.");
      return;
    }
    const db = getFirebaseDB();
    if (!db) return;

    try {
      const docRef = doc(db, 'profiles', uid);
      
      // Unsubscribe existing listener first if any
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }

      // Listen to profile updates in real-time
      recordFirestoreOp('listener', `profiles/${uid}`, 1);
      profileUnsubscribeRef.current = onSnapshot(docRef, (docSnap) => {
        if (docSnap && docSnap.exists()) {
          recordFirestoreOp('read', `profiles/${uid}`, 1);
          const data = docSnap.data();
          setProfile(data as BusinessProfile);
          
          if (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing') {
             setUserSubscription({
                status: data.subscriptionStatus,
                trialDaysLeft: data.trialStartDate ? Math.max(0, 7 - Math.ceil((new Date().getTime() - new Date(data.trialStartDate).getTime()) / (24 * 60 * 60 * 1000))) : 0,
                currentPeriodEnd: data.currentPeriodEnd || null,
                billingCycle: data.plan === 'yearly' ? 'yearly' : (data.plan === 'monthly' ? 'monthly' : null)
             });
          }
          
          localStorage.setItem('lf_profile', JSON.stringify(data));
          if (data.hasUsedTrial) {
            localStorage.setItem('lf_has_used_trial', 'true');
          }
          if (data.trialStartDate) {
            setTrialStartDate(data.trialStartDate);
            localStorage.setItem('lf_trial_start', data.trialStartDate);
          }
          if (data.trustPoints !== undefined) setTrustPoints(data.trustPoints);
          if (data.tasks !== undefined) {
            setTasks(data.tasks);
            localStorage.setItem('lf_tasks', JSON.stringify(data.tasks));
          }
        }
      }, (err) => {
        const errMsg = err?.message || String(err);
        const isQuota = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exhausted") || errMsg.toLowerCase().includes("resource-exhausted") || err?.code === "resource-exhausted";
        if (isQuota) {
          console.warn("Firestore quota exceeded for profile stream. Operating in offline/cached fallback mode.");
          setIsQuotaExceeded(true);
          return;
        }
        if (errMsg.toLowerCase().includes("offline") || errMsg.toLowerCase().includes("unreachable") || errMsg.toLowerCase().includes("could not reach") || err?.code === "unavailable") {
          console.warn("Firestore is offline or unreachable for profile stream. Operating in offline fallback mode.");
          return;
        }
        console.error("Error listening to profile in real-time:", err);
      });

      const leadsRef = collection(db, 'leads');
      const qLeads = query(leadsRef, where('userId', '==', uid), limit(100));
      const leadsSnap = await getDocs(qLeads).catch(err => {
        const errMsg = err?.message || String(err);
        const isQuota = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exhausted") || errMsg.toLowerCase().includes("resource-exhausted") || err?.code === "resource-exhausted";
        if (isQuota) {
          console.warn("Firestore quota exceeded for leads. Using local cache.");
          setIsQuotaExceeded(true);
          return { docs: [] } as any;
        }
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          console.warn("Firestore permission denied for leads. Using local cache.");
          const saved = localStorage.getItem('lf_leads');
          const cached = saved ? JSON.parse(saved) : [];
          setLeads(cached);
          return { docs: cached.map((l: any) => ({ id: l.id, data: () => l })) } as any;
        }
        if (errMsg.toLowerCase().includes("offline") || errMsg.toLowerCase().includes("unreachable") || errMsg.toLowerCase().includes("could not reach") || err?.code === "unavailable") {
          console.warn("Firestore is offline or unreachable for leads. Using local cache.");
          return { docs: [] } as any;
        }
        handleFirestoreError(err, OperationType.LIST, 'leads');
        throw err;
      });

      if (leadsSnap?.docs) {
        recordFirestoreOp('read', 'leads', leadsSnap.docs.length);
      }
      const leadsList = leadsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Lead));
      setLeads(leadsList);
      localStorage.setItem('lf_leads', JSON.stringify(leadsList));

      const transRef = collection(db, 'transactions');
      const qTrans = query(transRef, where('userId', '==', uid), limit(100));
      const transSnap = await getDocs(qTrans).catch(err => {
        const errMsg = err?.message || String(err);
        const isQuota = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exhausted") || errMsg.toLowerCase().includes("resource-exhausted") || err?.code === "resource-exhausted";
        if (isQuota) {
          console.warn("Firestore quota exceeded for transactions. Using local cache.");
          setIsQuotaExceeded(true);
          return { docs: [] } as any;
        }
        if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
          console.warn("Firestore permission denied for transactions. Using local cache.");
          const saved = localStorage.getItem('lf_transactions');
          const cached = saved ? JSON.parse(saved) : [];
          setClientTransactions(cached);
          return { docs: cached.map((t: any) => ({ id: t.id, data: () => t })) } as any;
        }
        if (errMsg.toLowerCase().includes("offline") || errMsg.toLowerCase().includes("unreachable") || errMsg.toLowerCase().includes("could not reach") || err?.code === "unavailable") {
          console.warn("Firestore is offline or unreachable for transactions. Using local cache.");
          return { docs: [] } as any;
        }
        handleFirestoreError(err, OperationType.LIST, 'transactions');
        throw err;
      });
      if (transSnap?.docs) {
        recordFirestoreOp('read', 'transactions', transSnap.docs.length);
      }
      const transList = transSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Transaction));
      setClientTransactions(transList);
      localStorage.setItem('lf_transactions', JSON.stringify(transList));

      const statsRef = doc(db, 'stats', uid);
      const statsSnap = await getDoc(statsRef).catch(err => {
        const errMsg = err?.message || String(err);
        const isQuota = errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("exhausted") || errMsg.toLowerCase().includes("resource-exhausted") || err?.code === "resource-exhausted";
        if (isQuota) {
          console.warn("Firestore quota exceeded for stats. Using local cache.");
          setIsQuotaExceeded(true);
          return null;
        }
        if (errMsg.toLowerCase().includes("offline") || errMsg.toLowerCase().includes("unreachable") || errMsg.toLowerCase().includes("could not reach") || err?.code === "unavailable" || err?.code === "permission-denied") {
          console.warn("Firestore is offline, unreachable or lacks permissions for stats. Using local cache.");
          return null;
        }
        throw err;
      });
      if (statsSnap && statsSnap.exists()) {
         const data = statsSnap.data();
         setStreak(data.streak || 0);
         localStorage.setItem('lf_streak', (data.streak || 0).toString());
         setGrowthStats(prev => {
           const next = {
             ...prev,
             reviews: data.reviews || prev.reviews,
             posts: data.posts || prev.posts,
             roi: data.roi !== undefined ? data.roi : prev.roi
           };
           localStorage.setItem('lf_growth', JSON.stringify(next));
           return next;
         });
      }
    } catch (e) {
      console.error("Error loading from Firestore:", e);
    }
  };

  async function syncToFirestore() {
    const db = getFirebaseDB();
    if (!user || !isFirebaseReady || !db) return;
    setSyncStatus('syncing');
    try {
      // Sync Profile
      const refCode = localStorage.getItem('bvelt_referred_by');
      logFirestoreWrite(`profiles/${user.uid}`);
      await setDoc(doc(db, 'profiles', user.uid), { 
        ...profile, 
        trustPoints,
        niche,
        tasks,
        referred_by: profile.referred_by || refCode || null,
        updatedAt: new Date().toISOString()
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `profiles/${user.uid}`);
        throw err;
      });

      // Sync Stats
      logFirestoreWrite(`stats/${user.uid}`);
      await setDoc(doc(db, 'stats', user.uid), {
        streak,
        reviews: growthStats.reviews,
        posts: growthStats.posts,
        leadsCount: leads.length,
        roi: growthStats.roi,
        lastSync: new Date().toISOString(),
        userId: user.uid
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `stats/${user.uid}`);
        throw err;
      });

      // Sync specific entities (Leads & Transactions)
      // Helper to identify local-only unsynced IDs (which are purely numeric timestamps generated via Date.now().toString())
      const isLocalId = (id: string) => /^\d+$/.test(id);

      const unsyncedLeads = leads.filter(l => isLocalId(l.id));
      const updatedLeadsMap: { [key: string]: string } = {};

      if (unsyncedLeads.length > 0) {
        const executingLeads = new Set<Promise<void>>();
        for (const lead of unsyncedLeads) {
          const p = (async () => {
            const { id, ...leadData } = lead;
            logFirestoreWrite('leads');
            try {
              const docRef = await addDoc(collection(db, 'leads'), { ...leadData, userId: user.uid });
              updatedLeadsMap[id] = docRef.id;
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, 'leads');
              throw err;
            }
          })();
          executingLeads.add(p);
          const clean = () => executingLeads.delete(p);
          p.then(clean).catch(clean);
          if (executingLeads.size >= 3) {
            await Promise.race(executingLeads);
          }
        }
        await Promise.all(executingLeads);
      }

      if (Object.keys(updatedLeadsMap).length > 0) {
        setLeads(prev => {
          const next = prev.map(l => {
            if (updatedLeadsMap[l.id] !== undefined) {
              return { ...l, id: updatedLeadsMap[l.id] };
            }
            return l;
          });
          localStorage.setItem('lf_leads', JSON.stringify(next));
          return next;
        });
      }

      const unsyncedTrans = clientTransactions.filter(t => isLocalId(t.id));
      const updatedTransMap: { [key: string]: string } = {};

      if (unsyncedTrans.length > 0) {
        const executingTrans = new Set<Promise<void>>();
        for (const trans of unsyncedTrans) {
          const p = (async () => {
            const { id, ...transData } = trans;
            logFirestoreWrite('transactions');
            try {
              const docRef = await addDoc(collection(db, 'transactions'), { ...transData, userId: user.uid });
              updatedTransMap[id] = docRef.id;
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, 'transactions');
              throw err;
            }
          })();
          executingTrans.add(p);
          const clean = () => executingTrans.delete(p);
          p.then(clean).catch(clean);
          if (executingTrans.size >= 3) {
            await Promise.race(executingTrans);
          }
        }
        await Promise.all(executingTrans);
      }

      if (Object.keys(updatedTransMap).length > 0) {
        setClientTransactions(prev => {
          const next = prev.map(t => {
            if (updatedTransMap[t.id] !== undefined) {
              return { ...t, id: updatedTransMap[t.id] };
            }
            return t;
          });
          localStorage.setItem('lf_transactions', JSON.stringify(next));
          return next;
        });
      }

      setSyncStatus('synced');
    } catch (e) {
      console.error("Error syncing to Firestore:", e);
      setSyncStatus('offline');
    }
  };

  const loadCreatorDemoData = () => {
    // Synth sound feedback
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        playTone(523.25, ctx.currentTime, 0.1);
        setTimeout(() => playTone(659.25, ctx.currentTime, 0.15), 100);
      }
    } catch (e) {
      console.log('Audio feedback skipped');
    }

    // 1. Business Profile for Florida HVAC
    const demoProfile: BusinessProfile = {
      name: 'Apex Pro HVAC Solutions',
      category: 'aire_acondicionado',
      location: 'Miami, FL',
      phone: '+1 (305) 555-0199',
      gmbLink: 'https://g.page/r/apex-hvac-miami',
      badges: ['same_day', 'background', 'licensed', 'emergency']
    };
    setProfile(demoProfile);
    localStorage.setItem('lf_profile', JSON.stringify(demoProfile));

    // 2. Leads - highly realistic
    const demoLeads: Lead[] = [
      { id: 'l1', date: 'Just now', text: 'Hi, we need an urgent AC repair at our house in Brickell (Miami). The cooling unit is blowing warm air and the indoor temperature is 85 degrees. Can you send someone this afternoon? Text me back at +1 (305) 555-0145.', urgency: 'Alta', size: 'Medium ($450)', action: 'pending', strategy: 'Fast diagnostic call + emergency replacement up-sell' },
      { id: 'l2', date: '30 mins ago', text: 'Looking to get an estimate for a complete duct cleaning and thermostat upgrade for a 3-bedroom house in Coral Gables.', urgency: 'Media', size: 'Large ($1,200)', action: 'pending', strategy: 'In-person inspection + smart home integration bundle' },
      { id: 'l3', date: '2 hours ago', text: 'Our office HVAC unit is making a loud squealing sound. Need a technician to inspect it before 5 PM today.', urgency: 'Alta', size: 'Medium ($600)', action: 'pending', strategy: 'B2B prioritisation + immediate service dispatch' },
      { id: 'l4', date: 'Yesterday', text: 'Regular maintenance service required for residential central AC unit in Coconut Grove. Please send quote.', urgency: 'Media', size: 'Small ($150)', action: 'pending', strategy: 'Pre-schedule on routine route + recurring maintenance contract' }
    ];
    setLeads(demoLeads);
    localStorage.setItem('lf_leads', JSON.stringify(demoLeads));

    // 3. Transactions / Quotes in USD
    const demoTransactions: Transaction[] = [
      { id: 't1', name: 'Johnathan Vance (AC Repair)', amount: 450, status: 'pendiente', date: '08/07/2026' },
      { id: 't2', name: 'Maria Gomez (System Install)', amount: 3200, status: 'pagado', date: '07/07/2026' },
      { id: 't3', name: 'Brickell Office Corp (Duct Cleaning)', amount: 850, status: 'pendiente', date: '06/07/2026' },
      { id: 't4', name: 'Coconut Grove HOA (Regular PM)', amount: 600, status: 'pagado', date: '05/07/2026' }
    ];
    setClientTransactions(demoTransactions);
    localStorage.setItem('lf_transactions', JSON.stringify(demoTransactions));

    // 4. Dark Pool (neighborhood allies) in English
    const demoDarkPool = [
      { id: 'dp1', text: 'Need 3 commercial rooftop AC units serviced and certified before tenant move-in on Friday. Budget $1,500.', date: '2 hours ago' },
      { id: 'dp2', text: 'Residential emergency condenser replacement in Kendall. Family with elderly relative, need same-day service.', date: '5 hours ago' },
      { id: 'dp3', text: 'Subcontracting duct installation for a new boutique shop in Wynwood. Starts next week.', date: 'Yesterday' }
    ];
    setDarkPool(demoDarkPool);
    localStorage.setItem('lf_dark_pool', JSON.stringify(demoDarkPool));

    // 5. Review replies state pre-fill with a negative review to reply to
    setReplyRawReview('Very disappointed. The technician arrived 40 minutes late for our emergency AC repair in Miami. They got it cooling eventually, but they left grease spots on my tiled floor and charged more than the initial phone estimate. Bad experience.');
    setReplyCity('Miami');
    setReplyService('Emergency AC Repair & Troubleshooting');
    setRevClientName('Johnathan Vance');
    setRevClientPhone('+1 (305) 555-0123');
    setRevGoogleLink('https://g.page/r/apex-hvac-miami');

    // 6. Social generator
    setSocialDesc('Completed custom HVAC installation with premium condenser replacement in Coral Gables.');
    setSocialContext('Miami Heat, AC Repair, Coral Gables, Apex Pro');

    // Niche HVAC
    setNiche('aire_acondicionado');
    localStorage.setItem('lf_niche', 'aire_acondicionado');

    // Language EN by default for USA VPN / creator recording
    setLanguage('en');
    localStorage.setItem('lf_lang', 'en');

    // Pre-fill the specific current lead analysis
    setCurrentLeadAnalysis({
      urgency: 'Alta',
      size: 'Medium ($450)',
      strategy: 'Fast emergency diagnostic call. Send a technician with standard capacitors and fan motors to resolve on the spot.'
    });

    showToast("⚡ Creator Demo Mode Loaded! Ready for video recording.", "success");
  };

  useEffect(() => {
    // Debounce local storage saves to prevent UI lag while typing
    const lsTimeout = setTimeout(() => {
      localStorage.setItem('lf_profile', JSON.stringify(profile));
      localStorage.setItem('user_profile', JSON.stringify(profile));
      localStorage.setItem('lf_leads', JSON.stringify(leads));
      localStorage.setItem('lf_transactions', JSON.stringify(clientTransactions));
      localStorage.setItem('lf_streak', streak.toString());
      localStorage.setItem('lf_dark_pool', JSON.stringify(darkPool));
      localStorage.setItem('lf_theme', isDarkMode ? 'dark' : 'light');
      localStorage.setItem('lf_lang', language);
      localStorage.setItem('bvelt_properties', JSON.stringify(properties));
      localStorage.setItem('localflow_properties', JSON.stringify(properties));
      localStorage.setItem('lf_tasks', JSON.stringify(tasks));
    }, 800);
    
    // Auto Cloud Sync REMOVED to prevent infinite loops and unneeded Firestore writes.
    // Cloud sync is now ONLY performed on explicit user button actions.

    // Apply theme class
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
    
    // Update stats
    const totalPotential = leads.length * 150; 
    setEstimatedEarnings(totalPotential + totalCobrado);

    // Save niche
    localStorage.setItem('lf_niche', niche);

    setGrowthStats(prev => ({
      ...prev,
      reviews: prev.reviews || 0,
      posts: prev.posts || 0,
      leads: leads.length,
      roi: totalCobrado
    }));

    return () => {
      clearTimeout(lsTimeout);
    };
  }, [profile, leads, clientTransactions, streak, darkPool, isDarkMode, user, properties, tasks]);

  useEffect(() => {
    localStorage.setItem('lf_growth', JSON.stringify(growthStats));
  }, [growthStats]);

  useEffect(() => {
    localStorage.setItem('lf_lang', language);
  }, [language]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) setShowScrollFab(true);
      else setShowScrollFab(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Strategy Handlers ($0 Spark Architecture) ---
  const triggerApifyScraperSim = async () => {
    const searchNiche = profile.niche || niche;
    if (!searchNiche || searchNiche.trim() === '') {
      alert(language === 'es' ? 'Por favor ingresa un nicho de negocio en la pestaña de Ajustes o Perfil antes de buscar.' : 'Please enter a business niche in the Settings or Profile tab before searching.');
      return;
    }

    setScrapingStatus('connecting');
    setScrapingProgress([
      language === 'es' 
        ? '[1/3] Resolviendo coordenadas geográficas...' 
        : '[1/3] Resolving geographic coordinates...',
    ]);
    
    try {
      let locationText = profile.location || 'Miami, FL';
      let coords = null;
      if (!profile.location && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) { console.warn("Geo error", e); }
      }

      setScrapingStatus('searching');
      setScrapingProgress(prev => [
        ...prev, 
        language === 'es'
          ? `[2/3] Buscando bases de datos de competidores locales para el nicho "${searchNiche}" en "${locationText}"...`
          : `[2/3] Querying local business registers for niche "${searchNiche}" in "${locationText}"...`
      ]);

      const realCompanies = await executeRealCompetitorScraping({
        niche: searchNiche,
        location: locationText,
        coords: coords,
        customGeminiKey: customGeminiKey
      });

      setScrapingStatus('saving');
      setScrapingProgress(prev => [
        ...prev, 
        language === 'es'
          ? `[3/3] Procesando y cargando ${realCompanies.length} competidores reales en el mapa local...`
          : `[3/3] Processing and loading ${realCompanies.length} real competitors onto the local map...`
      ]);

      await new Promise(r => setTimeout(r, 600));

      setScrappedLeads(realCompanies);
      setScrapingStatus('done');

      // Guardar en la caché del cliente (localStorage)
      try {
        const cacheKey = `scanned_leads_${locationText.toLowerCase().trim()}_${searchNiche.toLowerCase().trim()}`;
        window.localStorage.setItem(cacheKey, JSON.stringify(realCompanies));
      } catch (cacheErr) {
        console.warn("Could not save scanned leads to client cache:", cacheErr);
      }
      
      showToast(
        language === 'es' 
          ? `✨ Encontrados ${realCompanies.length} competidores reales en tu zona.`
          : `✨ Found ${realCompanies.length} real competitors in your area.`,
        "success"
      );
    } catch (err: any) {
      console.error(err);

      const isNetworkError = 
        err?.message?.toLowerCase().includes('failed to fetch') || 
        err?.message?.toLowerCase().includes('network error') ||
        err?.message?.toLowerCase().includes('networkerror') ||
        err instanceof TypeError;

      if (isNetworkError) {
        let locationText = profile.location || 'Miami, FL';
        const cacheKey = `scanned_leads_${locationText.toLowerCase().trim()}_${niche.toLowerCase().trim()}`;
        const cachedData = window.localStorage.getItem(cacheKey);
        
        if (cachedData) {
          try {
            const parsedLeads = JSON.parse(cachedData);
            setScrappedLeads(parsedLeads);
            setScrapingStatus('done');
            showToast(
              language === 'es' 
                ? `⚠️ Error de red. Cargando competidores de la caché guardada previamente en esta zona.`
                : `⚠️ Network error. Loading competitors from previously saved cache in this zone.`,
              "info"
            );
            return;
          } catch (jsonErr) {
            console.error("Failed to parse cached leads:", jsonErr);
          }
        } else {
          // Intentar coincidencia parcial para la misma ubicación
          const prefix = `scanned_leads_${locationText.toLowerCase().trim()}_`;
          let matchedKey = null;
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              matchedKey = key;
              break;
            }
          }
          if (matchedKey) {
            const cachedDataZone = window.localStorage.getItem(matchedKey);
            if (cachedDataZone) {
              try {
                const parsedLeads = JSON.parse(cachedDataZone);
                setScrappedLeads(parsedLeads);
                setScrapingStatus('done');
                showToast(
                  language === 'es' 
                    ? `⚠️ Error de red. Cargando competidores de una búsqueda previa en esta zona.`
                    : `⚠️ Network error. Loading competitors from a previous search in this zone.`,
                  "info"
                );
                return;
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
      }

      setScrapingStatus('error');
      setScrapingProgress(prev => [...prev, `❌ Error: ${err.message || 'Error en el escaneo'}`]);
      showToast(err.message || "Error al escanear competidores reales", "error");
    }
  };

  const generateCompetitorHash = (name: string): string => {
    const normalized = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `comp_${normalized.substring(0, 12)}_${Math.abs(hash)}`;
  };

  const importScrapedToCRM = async (company: any) => {
    if (!company?.name) return;

    const compHash = generateCompetitorHash(company.name);
    const normalizedCompName = company.name.trim().toLowerCase();

    // Validación de duplicados basada en el hash del nombre del competidor
    const isDuplicate = leads.some(lead => {
      if (lead.competitorHash && lead.competitorHash === compHash) return true;
      if (lead.text && lead.text.toLowerCase().includes(normalizedCompName)) return true;
      return false;
    });

    if (isDuplicate) {
      setImportedLeadIds(prev => new Set(prev).add(company.name));
      showToast(
        language === 'es'
          ? `⚠️ "${company.name}" ya está registrado en tu CRM de Leads.`
          : `⚠️ "${company.name}" is already registered in your Leads CRM.`,
        "info"
      );
      return;
    }

    const newLeadData = {
      text: `Oportunidad de Alianza B2B / Prospección con ${company.name} en ${profile.location || 'tu ciudad'}. Tel: ${company.phone || 'No disponible'}.`,
      urgency: 'Media',
      size: company.reviews > 80 ? 'Grande' : 'Medio',
      action: 'Enviar propuesta de servicio',
      strategy: 'Enfatizar automatización de reviews locales.',
      date: new Date().toISOString(),
      userId: user?.uid || 'anonymous',
      competitorHash: compHash
    };

    const newLead: Lead = {
      id: 'scraped-' + Date.now(),
      date: new Date().toLocaleDateString(),
      text: newLeadData.text,
      urgency: newLeadData.urgency as any,
      size: newLeadData.size as any,
      action: newLeadData.action,
      strategy: newLeadData.strategy,
      competitorHash: compHash
    };

    setLeads([newLead, ...leads]);
    setImportedLeadIds(prev => new Set(prev).add(company.name));

    if (isFirebaseReady && user?.uid) {
      try {
        logFirestoreWrite('leads');
        await addDoc(collection(db, 'leads'), {
          ...newLeadData,
          importedFrom: 'scraper'
        });
      } catch (err) {
        console.error("Error saving scraped lead to Firestore:", err);
      }
    }

    sendWebhookNotification(newLead);
    showToast(`¡Estupendo! "${company.name}" ha sido importado directamente al CRM de Leads Cache.`, "success");
  };

  const addUgcContribution = (e: any) => {
    e.preventDefault();
    if (!newUgcTask || !newUgcAvg) return;
    const avgVal = parseFloat(newUgcAvg);
    const newCost = {
      id: 'ugc-' + Date.now(),
      task: newUgcTask,
      average: avgVal,
      min: Math.round(avgVal * 0.85 * 100) / 100,
      max: Math.round(avgVal * 1.2 * 100) / 100,
      unit: newUgcUnit
    };
    setUgcCosts([...ugcCosts, newCost]);
    setNewUgcTask('');
    setNewUgcAvg('');
    setShowCostToast(true);
    setTimeout(() => setShowCostToast(false), 4000);
  };

  // --- Handlers ---

  const generateClosingMessage = async (leadId: string, agentStyle: 'elite' | 'ai' | 'friendly' = 'elite', customLeadText?: string) => {
    setIsAiLoading(true);
    setCloserAgentStyle(agentStyle);
    setShowCloserModal({ show: true, leadId });
    setCloserMessage('');
    
    let leadText = '';
    let urgency = 'Media';
    
    if (customLeadText) {
      leadText = customLeadText;
    } else if (leadId === 'temp_dark_lead') {
      leadText = tempLeadText || localStorage.getItem('lf_last_dark_lead') || '';
    } else {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        leadText = lead.text;
        urgency = lead.urgency;
      }
    }

    let systemInstruction = language === 'es' 
      ? "Eres un cerrador de ventas de élite."
      : "You are an elite sales closer.";
    let styleGuide = language === 'es'
      ? "Usa un tono profesional, altamente persuasivo, enfocado en cerrar el trato e incentivar la cita hoy. Sé directo y de alta conversión."
      : "Use a professional, highly persuasive tone focused on closing the deal and encouraging an appointment today. Be direct and high-converting.";
    
    if (agentStyle === 'ai') {
      systemInstruction = language === 'es'
        ? "Eres un especialista de atención al cliente educado, estructurado y altamente organizado para un negocio local."
        : "You are a polite, structured, and highly organized customer service specialist for a local business.";
      styleGuide = language === 'es'
        ? "Preséntate como el encargado de atención de [Negocio]. Sé súper estructurado, sumamente educado, directo y ayuda a coordinar los detalles o agendar una cita sin usar jergas corporativas ni clichés robóticos. PROHIBIDO usar palabras como IA, Agente, Bot o Asistente Virtual."
        : "Introduce yourself as the customer service coordinator for [Business]. Be highly structured, extremely polite, direct, and help coordinate details or schedule an appointment without corporate fluff. PROHIBITED from using words like AI, Agent, Bot, or Virtual Assistant.";
    } else if (agentStyle === 'friendly') {
      systemInstruction = language === 'es'
        ? "Eres el dueño o socio de un negocio local de servicios, con un tono súper amigable, humilde y de total confianza."
        : "You are the owner or partner of a local services business, with a super friendly, humble, and completely trustworthy tone.";
      styleGuide = language === 'es'
        ? "Escribe de forma 100% natural, casual, cercana, como si le escribieras a un vecino o amigo por chat de WhatsApp. Evita introducciones corporativas ni tonos de robot AI. Sé cálido, amigable e informal."
        : "Write in a 100% natural, casual, and warm way, as if you were writing to a neighbor or friend via WhatsApp chat. Avoid corporate introductions or robotic AI tones. Be warm, friendly, and informal.";
    }

    const prompt = language === 'es'
      ? `Como experto para un negocio de ${niche || 'servicios'} llamado "${profile.name || 'nuestro negocio'}", genera el primer mensaje de WhatsApp ideal para esta solicitud del cliente: "${leadText}".
    Urgencia del cliente: ${urgency}.
    Ubicación del negocio: ${profile.location || 'la zona local'}.
    
    Instrucciones de personalidad y estilo:
    ${styleGuide}

    Genera un único mensaje de texto listo para ser copiado o enviado por WhatsApp. Asegúrate de responder en el mismo idioma en el que está escrito el lead original (inglés si está en inglés, español si está en español).`
      : `As an expert for a ${niche || 'services'} business called "${profile.name || 'our business'}", generate the ideal first WhatsApp message for this client request: "${leadText}".
    Client urgency: ${urgency}.
    Business location: ${profile.location || 'the local area'}.
    
    Personality and style instructions:
    ${styleGuide}

    Generate a single text message ready to be copied or sent via WhatsApp. Make sure to respond in the same language as the original lead (English if in English, Spanish if in Spanish).`;

    try {
      const result = await handleAiCall(prompt, systemInstruction);
      setCloserMessage(result);
    } catch (err) {
      console.error("Error generating closing message:", err);
      setCloserMessage(language === 'es' ? 'Error al generar el mensaje. Por favor reintenta.' : 'Error generating message. Please retry.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const generatePitchForDarkLead = async (leadText: string) => {
    setTempLeadText(leadText);
    localStorage.setItem('lf_last_dark_lead', leadText);
    await generateClosingMessage('temp_dark_lead', 'elite', leadText);
  };

  const handleRewriteFollowUpTemplate = async (tone: 'directo' | 'amigable' | 'urgente' = followUpTone) => {
    setIsRewritingFollowUp(true);
    setFollowUpTone(tone);
    try {
      const systemInstruction = `[CAPA DE ROL: OPTIMIZADOR DE MENSAJES DE SEGUIMIENTO]
Tu objetivo es reescribir un mensaje de seguimiento de presupuesto (Follow-up) para el negocio "${profile.name}" (Categoría: ${profile.category || 'Servicios Locales'}).
Tono solicitado: ${tone.toUpperCase()}.

[CAPA DE ESTILO - HUMANO DE ALTA VELOCIDAD Y PROHIBICIÓN DE BOTS]
- Escribe como un profesional local experimentado redactando un mensaje de WhatsApp rápido desde su teléfono.
- PROHIBICIÓN ABSOLUTA DE PALABRAS: Queda estrictamente prohibido utilizar palabras como 'IA', 'AI', 'Agente', 'Agent', 'Bot', 'Robot', 'Asistente Virtual', 'Virtual Assistant', 'Neural', 'Algoritmo' o 'Inteligencia Artificial'.
- PROHIBIDO usar lenguaje robótico o muletillas de IA como "En el dinámico mundo de hoy", "Es fundamental", "Explora estas opciones", "Estimado cliente".
- Escribe en 1 o máximo 2 párrafos ultra-cortos (máximo 2-3 líneas cada uno).
- Introduce pausas naturales ("Hola 👋,", "Mira,", "Quería consultarte...").
- Devuelve ÚNICAMENTE el texto exacto del mensaje reescrito listo para enviar por WhatsApp o SMS en ${language === 'es' ? 'español' : 'inglés'}.`;

      const prompt = `Reescribe este mensaje de seguimiento de presupuesto en un tono ${tone}: "Hola, te envié un presupuesto hace unos días. ¿Tienes alguna pregunta o seguimos adelante? Mi agenda se llena rápido."`;
      const result = await handleAiCall(prompt, systemInstruction);
      if (result && !result.includes("Error")) {
        const cleaned = result.replace(/^["'«»]|["'«»]$/g, '').trim();
        setFollowUpTemplate(cleaned);
        showToast(t("¡Plantilla de seguimiento reescrita!", "Follow-up template rewritten!"), "success");
      }
    } catch (e) {
      console.error(e);
      showToast(t("Error al reescribir la plantilla", "Error rewriting template"), "error");
    } finally {
      setIsRewritingFollowUp(false);
    }
  };

  const handleRewriteReactivateTemplate = async (tone: 'directo' | 'amigable' | 'urgente' = reactivateTone) => {
    setIsRewritingReactivate(true);
    setReactivateTone(tone);
    try {
      const systemInstruction = `[CAPA DE ROL: OPTIMIZADOR DE MENSAJES DE REACTIVACIÓN]
Tu objetivo es reescribir un mensaje para reactivar un cliente frío (presupuesto no concretado en el pasado) para el negocio "${profile.name}" (${profile.category || 'Servicios Locales'}).
Tono solicitado: ${tone.toUpperCase()}.

[CAPA DE ESTILO - HUMANO DE ALTA VELOCIDAD Y PROHIBICIÓN DE BOTS]
- Escribe como un propietario de negocio local real escribiendo desde su celular a un antiguo cliente.
- PROHIBICIÓN ABSOLUTA DE PALABRAS: Queda strictly prohibido utilizar palabras como 'IA', 'AI', 'Agente', 'Agent', 'Bot', 'Robot', 'Asistente Virtual', 'Virtual Assistant', 'Neural', 'Algoritmo' o 'Inteligencia Artificial'.
- PROHIBIDO utilizar muletillas robóticas como "En el dinámico mundo de hoy", "Es fundamental", "Explora", "Estimado cliente".
- Párrafos súper breves (máximo 2 líneas cada uno).
- Da un motivo natural y orgánico (ej: "estaré trabajando en tu zona esta semana", "tengo un espacio libre en mi agenda", "descuento especial de temporada").
- Devuelve ÚNICAMENTE el texto exacto del mensaje reescrito listo para enviar en ${language === 'es' ? 'español' : 'inglés'}.`;

      const prompt = `Reescribe este mensaje para reactivar un cliente frío en un tono ${tone}: "Hola, no concretamos la última vez. Tengo un descuento flash esta semana en mi ruta por tu zona."`;
      const result = await handleAiCall(prompt, systemInstruction);
      if (result && !result.includes("Error")) {
        const cleaned = result.replace(/^["'«»]|["'«»]$/g, '').trim();
        setReactivateTemplate(cleaned);
        recordBveltEvent({
          uid: user?.uid || profile?.email,
          type: 'reactivate_generate',
          trade: profile?.category || niche,
          city: profile?.city || profile?.location || '',
          meta: { tone, source: 'handleRewriteReactivateTemplate' }
        });
        showToast(t("¡Plantilla de reactivación reescrita!", "Reactivation template rewritten!"), "success");
      }
    } catch (e) {
      console.error(e);
      showToast(t("Error al reescribir la plantilla", "Error rewriting template"), "error");
    } finally {
      setIsRewritingReactivate(false);
    }
  };

  const handleRewriteAutoResponderSms = async (tone: 'cercano' | 'ejecutivo' | 'rapido' = autoResponderTone) => {
    setIsRewritingAutoResponder(true);
    setAutoResponderTone(tone);
    try {
      const systemInstruction = `[CAPA DE ROL: AUTO-RESPONDER SMS DE LLAMADAS PERDIDAS]
Redacta una respuesta automática por SMS/WhatsApp para cuando el negocio "${profile.name}" (${profile.category || 'Servicios Locales'}) pierde una llamada telefónica de un cliente.
Estilo solicitado: ${tone.toUpperCase()}.

[CAPA DE ESTILO - HUMANO Y DIRECTO - PROHIBICIÓN DE BOTS]
- Suena 100% como un mensaje personal de respuesta rápida escrito por una persona real, no un bot corporativo rígido.
- PROHIBICIÓN ABSOLUTA DE PALABRAS: Queda estrictamente prohibido utilizar palabras como 'IA', 'AI', 'Agente', 'Agent', 'Bot', 'Robot', 'Asistente Virtual', 'Virtual Assistant', 'Neural', 'Algoritmo' o 'Inteligencia Artificial'.
- Longitud máxima: 150 caracteres para SMS.
- Pide el tipo de servicio o cómo ayudar para responder de inmediato.
- Devuelve ÚNICAMENTE el texto exacto del SMS listo para copiar en ${language === 'es' ? 'español' : 'inglés'}.`;

      const prompt = `Genera un mensaje de Auto-responder SMS para llamadas perdidas en estilo ${tone} para ${profile.name}.`;
      const result = await handleAiCall(prompt, systemInstruction);
      if (result && !result.includes("Error")) {
        const cleaned = result.replace(/^["'«»]|["'«»]$/g, '').trim();
        setAutoResponderSms(cleaned);
        showToast(t("¡SMS Auto-responder reescrito!", "SMS Auto-responder rewritten!"), "success");
      }
    } catch (e) {
      console.error(e);
      showToast(t("Error al reescribir el Auto-responder", "Error rewriting auto-responder"), "error");
    } finally {
      setIsRewritingAutoResponder(false);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'es' ? 'es-ES' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceAssistant = async (transcript: string) => {
    setShowVoiceModal(true);
    setVoiceState('processing');
    setIsAiLoading(true);

    try {
      // Natural Voice Understanding via AI JSON {intent, radiusKm?, reply}
      // Canonical intents: leads | scan | profile | reviews | quote | plans | website
      // Zero mandatory exact phrases
      const intentResult = await resolveVoiceIntent(transcript, {
        language: language as 'es' | 'en',
        profile
      });

      const { intent, radiusKm, reply } = intentResult;
      setVoiceCommandResult(reply);
      speakText(reply);

      // Execute intent action
      if (intent === 'scan') {
        const isPro = Boolean(profile?.isPro || profile?.subscriptionStatus === 'active' || userSubscription?.status === 'active');
        const { remainingToday } = getScanUsageInfo(isPro);

        if (remainingToday <= 0) {
          const limitMsg = isPro
            ? t("Has alcanzado tu límite diario de 30 escaneos Pro.", "You've reached your daily limit of 30 Pro scans.")
            : t("Has alcanzado tu límite de 5 escaneos diarios. Activa Pro para obtener 30 escaneos al día.", "You've reached your limit of 5 daily scans. Upgrade to Pro for 30 scans/day.");
          setVoiceCommandResult(limitMsg);
          setVoiceState('error');
          speakText(limitMsg);
          showToast(limitMsg, 'info');
          return;
        }

        recordScanUsage();
        if (radiusKm && radiusKm > 0) {
          setProfile((prev: any) => ({ ...prev, marketRadius: radiusKm }));
        }
        setActiveTab('business_scan');
        if (isMobile) setSelectedMobileView('tab');
        runOnboardingHookScan();
        runSeoAudit();
      } else if (intent === 'leads') {
        setActiveTab('leads');
        setActiveSubRow(4);
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'followup') {
        setActiveTab('leads');
        setActiveSubRow(5);
        if (isMobile) setSelectedMobileView('tab');
        window.dispatchEvent(new CustomEvent('bvelt_trigger_followup_generation'));
      } else if (intent === 'profile') {
        setActiveTab('profile');
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'reviews') {
        setActiveTab('reviews');
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'quote') {
        setActiveTab('estimator');
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'plans') {
        setActiveTab('profile');
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'website') {
        setActiveTab('website');
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'check_quote') {
        setActiveTab('leads');
        setActiveSubRow(5);
        if (isMobile) setSelectedMobileView('tab');
      } else if (intent === 'add_closing_line') {
        setActiveTab('leads');
        setActiveSubRow(5);
        if (isMobile) setSelectedMobileView('tab');
        if (intentResult.closeLine) {
          window.dispatchEvent(new CustomEvent('bvelt_apply_suggested_close_line', {
            detail: { closeLine: intentResult.closeLine }
          }));
        }
      }

      setVoiceState('idle');
      setTimeout(() => setShowVoiceModal(false), 2400);
    } catch (err: any) {
      console.warn("[Voice Assistant] Routing fallback:", err);
      const fallbackResult = parseLocalVoiceIntent(transcript, language as 'es' | 'en', {
        language: language as 'es' | 'en',
        profile
      });
      setVoiceCommandResult(fallbackResult.reply);
      speakText(fallbackResult.reply);

      if (fallbackResult.intent === 'scan') {
        setActiveTab('business_scan');
      } else if (fallbackResult.intent === 'leads') {
        setActiveTab('leads');
        setActiveSubRow(4);
      } else if (fallbackResult.intent === 'followup') {
        setActiveTab('leads');
        setActiveSubRow(5);
        window.dispatchEvent(new CustomEvent('bvelt_trigger_followup_generation'));
      } else if (fallbackResult.intent === 'profile') {
        setActiveTab('profile');
      } else if (fallbackResult.intent === 'reviews') {
        setActiveTab('reviews');
      } else if (fallbackResult.intent === 'quote') {
        setActiveTab('estimator');
      } else if (fallbackResult.intent === 'plans') {
        setActiveTab('profile');
      } else if (fallbackResult.intent === 'website') {
        setActiveTab('website');
      } else if (fallbackResult.intent === 'check_quote') {
        setActiveTab('leads');
        setActiveSubRow(5);
      } else if (fallbackResult.intent === 'add_closing_line') {
        setActiveTab('leads');
        setActiveSubRow(5);
        if (fallbackResult.closeLine) {
          window.dispatchEvent(new CustomEvent('bvelt_apply_suggested_close_line', {
            detail: { closeLine: fallbackResult.closeLine }
          }));
        }
      }
      if (isMobile) setSelectedMobileView('tab');
      setVoiceState('idle');
      setTimeout(() => setShowVoiceModal(false), 2400);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGroqCall = async (prompt: string, systemInstruction: string) => {
    const resp = await fetch('/api/ai/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemInstruction: getHumanizedSystemInstruction(systemInstruction, language, profile.location),
        language
      })
    });
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) {
      let errText = "";
      if (ct.includes('application/json')) {
        try {
          const errData = await resp.json() as { error?: string };
          errText = errData.error;
        } catch (_) {}
      }
      throw new Error(errText || `Groq Error (${resp.status})`);
    }
    const data = await resp.json().catch(() => ({ text: "" })) as { text?: string };
    return data.text;
  };

  const startVoiceAssistant = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('error');
      setShowVoiceModal(true);
      setVoiceCommandResult(t("El reconocimiento de voz no está soportado en este navegador.", "Voice speech recognition is not supported on this browser."));
      speakText(t("Reconocimiento de voz no disponible.", "Voice recognition not available."));
      return;
    }

    setVoiceState('listening');
    setIsRecording(true);
    setShowVoiceModal(true);
    setVoiceCommandResult(t("🎙️ Grabando audio... ¡Habla ahora!", "🎙️ Recording audio... Speak now!"));

    const rec = new SpeechRecognition();
    rec.lang = language === 'es' ? 'es-ES' : 'en-US';
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      handleVoiceAssistant(text);
      setIsRecording(false);
    };
    rec.onerror = (err: any) => {
      setIsRecording(false);
      setVoiceState('error');
      setVoiceCommandResult(t("Error al capturar audio. Revisa permisos del micrófono.", "Error capturing audio. Check microphone permissions."));
      speakText(t("Error de micrófono.", "Microphone error."));
    };
    rec.onend = () => {
      setIsRecording(false);
    };
    rec.start();
  };
  const handlePhotoToPost = async () => {
    if (!photoToPostImage) {
      showToast(t("Sube una foto primero", "Upload a photo first"), "info");
      return;
    }
    setIsAiLoading(true);
    try {
      const targetLangName = socialContentLanguage === 'es' ? 'SPANISH' : 'ENGLISH';
      const aiPrompt = `Analyze this photo of a completed job. Generate: 1. A Google My Business post. 2. An estimated budget. 
      Responde en JSON: {"post": "...", "budget": "..."}
      
      CRITICAL LANGUAGE INSTRUCTION:
      The "post" field MUST be written 100% in ${targetLangName} (including hooks, description, emojis, hashtags). No translation mixing.
      Generate the post output strict in ${targetLangName} unless the user explicit selects Spanish mode. Current target language: ${targetLangName}.`;

      const aiSystemInstruction = socialContentLanguage === 'es'
        ? "Eres un experto en servicios locales. Resalta la artesanía y alta calidad de trabajo. Responde en ESPAÑOL."
        : "You are a local services expert. Highlight high-quality craftsmanship and work. Respond in ENGLISH.";

      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': customGeminiKey || ''
        },
        body: JSON.stringify({
          image: photoToPostImage,
          prompt: aiPrompt,
          systemInstruction: aiSystemInstruction
        })
      });
      
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok || !ct.includes('application/json')) {
        if (resp.status === 429) {
          throw new Error("El sistema está procesando tu solicitud, intenta en unos segundos.");
        }
        let errText = "";
        if (ct.includes('application/json')) {
          try {
            const errData = await resp.json() as { error?: string };
            errText = errData.error;
          } catch (_) {}
        }
        throw new Error(errText || "Error en la generación automatizada.");
      }

      const data = await resp.json().catch(() => ({ text: "" })) as { text: string };

      try {
        const part = JSON.parse(data.text.replace(/```json|```/g, ''));
        setPhotoToPostResult(part);
      } catch {
        setPhotoToPostResult({ post: data.text, budget: "$0.00" });
      }
      setTrustPoints(p => p + 15);
    } catch (e: any) {
      showToast("Error en Motores: " + (e.message || "Error desconocido"), "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const publishToGMB = () => {
    showToast(t("Publicado exitosamente en Google My Business!", "Successfully posted to Google My Business!"), "success");
    setTrustPoints(p => p + 5);
    const count = parseInt(localStorage.getItem('bvelt_posts_created') || localStorage.getItem('localflow_posts_created') || '0', 10);
    localStorage.setItem('bvelt_posts_created', String(count + 1));
    localStorage.setItem('localflow_posts_created', String(count + 1));
    setPhotoToPostResult(null);
    setPhotoToPostImage(null);
  };

  const handleLeadAction = async (id: string, action: string) => {
    setLeads(leads.map(l => l.id === id ? { ...l, action } : l));
    if (action === 'acepto') {
        setTrustPoints(p => p + 20);
    }
  };

  const saveUserDataToCloud = async () => {
    const db = getFirebaseDB();
    if (!user || !db) return;
    const uid = user.uid;
    try {
      logFirestoreWrite(`profiles/${uid}`);
      await setDoc(doc(db, 'profiles', uid), { ...profile, trustPoints });
      logFirestoreWrite(`stats/${uid}`);
      await setDoc(doc(db, 'stats', uid), {
        streak,
        reviews: growthStats.reviews,
        posts: growthStats.posts,
        leads: leads.length,
        roi: growthStats.roi,
        lastActive: new Date().toISOString(),
        userId: uid
      });
      // We don't save leads/transactions in bulk here to avoid huge writes, 
      // they have their own add handlers, but on initial sync we could if needed.
    } catch (err) {
      console.error("Error saving to cloud:", err);
    }
  };

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      if (u) {
        setUser(u);
        
        // Sync profile name if empty
        setProfile(prev => {
          if (!prev.name || prev.name === 'Tu Negocio' || prev.name === 'Local Business') {
            return { ...prev, name: u.displayName || prev.name };
          }
          return prev;
        });

        if ((window as any).isFirebaseNewUser) {
          if (typeof (window as any).gtag === 'function') {
            (window as any).gtag('event', 'sign_up', {
              method: 'Google'
            });
          }
          (window as any).isFirebaseNewUser = false; // Reset after firing
        }

        loadFromFirestore(u.uid);
      }
    } catch (e: any) {
      console.error("Google login error:", e?.code || 'AUTH_ERROR');
      const msg = getHumanAuthErrorMessage(e, language);
      showToast(msg, e?.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
    }
  };

  const handleLogout = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await auth.signOut();
      setUser(null);
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }
      // Optional: clear local state or keep as cache
    }
  };

  const cleanAiResponseText = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    
    // Patterns to remove (case-insensitive)
    const patterns = [
      /^(en resumen|in summary|summary:?)[,.\s]*/gi,
      /^(como modelo de lenguaje|as an ai|as a large language model)[,.\s]*/gi,
      /^(basado en mi análisis|based on my analysis|according to my analysis)[,.\s]*/gi,
      /^(como un contratista experimentado|as an experienced contractor|as a professional contractor)[,.\s]*/gi,
      /^(estimado cliente|dear valued customer|dear client)[,.\s]*/gi,
      /^(espero que este correo se encuentre bien|i hope this email finds you well|hope you are doing well)[,.\s]*/gi,
      /como modelo de lenguaje que soy/gi,
      /como un contratista experimentado en/gi,
      /lamento las limitaciones/gi,
      /disculpe las molestias/gi,
      /no tengo acceso a/gi,
      /como inteligencia artificial/gi,
      /como ia/gi,
      /as an ai/gi,
      /mis disculpas, pero/gi,
      /lo siento, pero no puedo/gi
    ];

    let cleaned = text;
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Capitalize first letter of cleaned text if it was modified
    cleaned = cleaned.trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
  };

  const handleAiCall = async (prompt: string, systemInstruction: string, image?: string) => {
    if (!spendCredit()) {
      return "Upgrade to Pro to unlock unlimited AI.";
    }
    
    setIsAiLoading(true);
    try {
      const customizedSystemInstruction = getHumanizedSystemInstruction(systemInstruction, language, profile.location);

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': customGeminiKey || ''
        },
        body: JSON.stringify({ prompt, systemInstruction: customizedSystemInstruction, image })
      });
      
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) {
        if (res.status === 429) {
          parseRateLimitHeaders(res);
          updateQuotaFromServer(0);
          showToast(t("Límite diario alcanzado — mejora a Pro ($49/mes)", "Daily limit reached — upgrade to Pro ($49/mo)"), "error");
          return language === 'es' ? "Límite diario alcanzado — mejora a Pro ($49/mes) para continuar analizando mensajes." : "Daily limit reached — upgrade to Pro ($49/mo) to continue analyzing messages.";
        }
        let errText = "";
        if (ct.includes('application/json')) {
          try {
            const errData = await res.json() as { error?: string };
            errText = errData.error;
          } catch (_) {}
        }
        return errText || "Error al conectar con el servidor.";
      }

      const data = await res.json().catch(() => ({ text: "" })) as { text?: string };
      
      // usage_logs collection disabled to eliminate non-essential Firestore writes
      /*
      if (user) {
        try {
          logFirestoreWrite('usage_logs');
          await addDoc(collection(getFirebaseDB(), 'usage_logs'), {
            uid: user.uid,
            action: 'ai_call',
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          // ignore tracking error
        }
      }
      */
      
      return cleanAiResponseText(data.text);
    } catch (err) {
      console.error("Fetch Error:", err);
      return "Error de red o conexión con el servidor.";
    } finally {
      setIsAiLoading(false);
    }
  };
  const generateReviewMessage = async () => {
    if (!revClientName) {
      showToast(t("Ingresa el nombre del cliente", "Please enter the client's name"), "info");
      return;
    }
    const link = revGoogleLink || profile.gmbLink || "NO_LINK";
    const prompt = language === 'es'
      ? `Genera un mensaje cordial y transparente por WhatsApp para el cliente ${revClientName} invitándole a compartir su opinión sincera en este link: ${link}. Hazlo corto, profesional y sin condicionar la valoración.`
      : `Generate a cordial, transparent WhatsApp message for client ${revClientName} inviting them to share their honest review at this link: ${link}. Keep it short, professional, and without conditioning the rating.`;
    
    const systemInstruction = language === 'es'
      ? "Eres un asistente de comunicación profesional y ético. Cumple estrictamente con las normativas de reseñas: solicita opiniones sinceras sin exigir puntuaciones específicas de 5 estrellas ni realizar review gating."
      : "You are a professional and ethical communications assistant. Strictly follow review compliance policies: request honest feedback without mandating 5-star ratings or gating negative reviews.";

    const rawResult = await handleAiCall(prompt, systemInstruction);
    
    // Evaluate through Review Compliance Firewall
    const evaluation = ReviewComplianceFirewall.evaluateMessage(rawResult, language as 'es' | 'en');
    if (evaluation.decision === 'BLOCK') {
      const neutral = ReviewComplianceFirewall.neutralizeMessage(
        revClientName,
        profile.name || 'nuestro negocio',
        profile.category || 'servicio',
        profile.location || 'la zona',
        language as 'es' | 'en'
      );
      setReviewResult(neutral.whatsapp);
      showToast(
        t(
          "Esta acción fue bloqueada porque condicionaba la valoración. Se ha reemplazado por una versión neutral cumplidora.",
          "This action was blocked because it conditioned the review. Replaced with a neutral compliant version."
        ),
        "error"
      );
    } else if (evaluation.decision === 'MODIFY') {
      const neutral = ReviewComplianceFirewall.neutralizeMessage(
        revClientName,
        profile.name || 'nuestro negocio',
        profile.category || 'servicio',
        profile.location || 'la zona',
        language as 'es' | 'en'
      );
      setReviewResult(neutral.whatsapp);
      showToast(
        t(
          "Mensaje auditado y ajustado automáticamente a la política de reseñas éticas.",
          "Message audited and automatically adjusted to ethical review policy."
        ),
        "info"
      );
    } else {
      setReviewResult(rawResult);
    }

    recordBveltEvent({
      tenantId: user?.uid || profile?.email,
      type: 'review_draft_created',
      sourceType: 'reputation_system',
      sourceName: 'Google Reviews Requester',
      fetchedAt: new Date().toISOString(),
      provenance: 'USER_ACTION_INTENT',
      consentScope: 'private',
      trade: profile?.category || niche,
      city: profile?.city || profile?.location || '',
      meta: { clientName: revClientName, stars: selectedStars, hasLink: Boolean(link && link !== 'NO_LINK'), source: 'generateReviewMessage' }
    });
  };

  const generateSEOReply = async () => {
    if (!replyRawReview) {
      showToast(t("Pega la reseña primero", "Please paste the review first"), "info");
      return;
    }
    const locationStr = replyCity || profile.location || 'la zona';
    const serviceStr = replyService || profile.category || 'nuestros servicios';
    
    // Choose specific tone parameters based on replyTone
    let toneDescriptionEs = "";
    let toneDescriptionEn = "";
    
    if (replyTone === 'professional') {
      toneDescriptionEs = "altamente profesional, directo, serio pero sumamente cordial y educado. Mantén un enfoque corporativo e institucional.";
      toneDescriptionEn = "highly professional, direct, formal yet extremely warm and polite. Maintain a corporate and institutional approach.";
    } else if (replyTone === 'empathetic') {
      toneDescriptionEs = "cálido, sumamente agradecido, empático, cercano y amigable. Haz sentir al cliente como parte de la familia y sumamente valorado.";
      toneDescriptionEn = "warm, deeply grateful, empathetic, close, and friendly. Make the customer feel like family and highly valued.";
    } else if (replyTone === 'damage_control') {
      toneDescriptionEs = "enfocado en control de daños ante una reseña negativa o queja. Sé extremadamente educado, comprensivo, asume la responsabilidad con total elegancia y ofrece una vía directa de contacto para resolver el malentendido y compensar la experiencia sin discutir.";
      toneDescriptionEn = "focused on damage control for a negative or critical review. Be extremely polite, understanding, take responsibility with grace, and offer a direct channel of communication to resolve the misunderstanding and make things right without arguing.";
    }

    const prompt = language === 'es'
      ? `Responde a esta reseña de Google: "${replyRawReview}". 
    Ubicación del cliente o negocio: ${locationStr}. 
    Servicio realizado: ${serviceStr}.
    Tono deseado: ${toneDescriptionEs}
    
    Instrucción OBLIGATORIA: Escribe una respuesta altamente optimizada para SEO Local en Google Maps.
    - Menciona orgánicamente la ubicación exacta (ej. ${locationStr}) y el servicio realizado de forma sutil.
    - Agradece al cliente por el review (si es positivo) o valida sus frustraciones de forma diplomática (si es negativo / control de daños).
    - Sé directo y amable. NO uses saludos genéricos y robóticos.
    - Mantén el idioma en el que está escrita la reseña original (si es inglés, responde en inglés; si es español, en español).
    
    Solo devuelve el texto de la respuesta final lista para usar, sin saludos del sistema ni introducciones adicionales.`
      : `Reply to this Google review: "${replyRawReview}". 
    Client or business location: ${locationStr}. 
    Service performed: ${serviceStr}.
    Desired tone: ${toneDescriptionEn}
    
    MANDATORY Instruction: Write a response highly optimized for Local SEO on Google Maps.
    - Organically mention the exact location (e.g., ${locationStr}) and the service performed in a subtle way.
    - Thank the client for the review (if positive) or validate their frustrations diplomatically (if negative / damage control).
    - Be direct and warm. DO NOT use generic, robotic greetings.
    - Keep the language in which the original review is written (if English, reply in English; if Spanish, in Spanish).
    
    Only return the final reply text ready to use, with no extra introductions or system commentary.`;
    
    const systemInstruction = language === 'es'
      ? `Eres un experto en SEO Local, reputación online y gestión de marca. Generas respuestas profesionales de Google Maps para contratistas y negocios locales con tono ${replyTone}.`
      : `You are an expert in Local SEO, online reputation, and brand management. You generate professional Google Maps responses for contractors and local businesses with a ${replyTone} tone.`;

    const result = await handleAiCall(prompt, systemInstruction);
    setReplyResult(result);
  };

  const generateLeadPitch = async (company: any) => {
    const oppBiz: LocalBusinessOpportunityData = {
      id: company.id || `biz_${Date.now()}`,
      name: company.name || company.client || 'Negocio Local',
      category: company.category || company.niche || profile.category || 'Servicios locales',
      address: company.address || company.location || profile.location || '',
      location: company.location || company.address || profile.location || '',
      rating: company.rating !== undefined ? company.rating : 'N/D',
      reviews: company.reviews !== undefined ? company.reviews : 'N/D',
      website: company.website || (company.web ? 'Registrado' : ''),
      phone: company.phone || '',
      dataStatus: company.dataStatus || 'Verified',
      opportunityData: company.opportunityData || [],
      source: company.source || 'Client Acquisition Engine'
    };

    setActivePitchCompany(oppBiz);
    setPitchResult('');
    setStructuredPitch(null);
    setIsPitchLoading(true);
    setShowPitchModal(true);

    try {
      const rawRatingStr = String(oppBiz.rating || '').replace('★', '').trim();
      const ratingVal = rawRatingStr && rawRatingStr !== 'N/D' ? parseFloat(rawRatingStr) : undefined;
      const reviewsVal = oppBiz.reviews && oppBiz.reviews !== 'N/D' ? parseInt(String(oppBiz.reviews)) : undefined;

      const response = await fetch('/api/generate-lead-pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: oppBiz.name,
          category: oppBiz.category,
          rating: isNaN(ratingVal as number) ? undefined : ratingVal,
          reviews: isNaN(reviewsVal as number) ? undefined : reviewsVal,
          website: oppBiz.website,
          address: oppBiz.address,
          language: language
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate pitch');
      }

      const data = await response.json() as { shortMessage?: string, text?: string, emailSubject?: string, emailBody?: string, callScript?: string, opportunities?: string[] };
      const shortMsg = data.shortMessage || data.text || '';
      setPitchResult(shortMsg);
      setStructuredPitch({
        shortMessage: shortMsg,
        emailSubject: data.emailSubject || `Oportunidad para ${oppBiz.name}`,
        emailBody: data.emailBody || shortMsg,
        callScript: data.callScript || shortMsg,
        opportunities: data.opportunities || []
      });
    } catch (err: any) {
      console.error("Error generating pitch:", err);
      showToast(t("Error al generar pitch comercial", "Error generating pitch"), "error");
      const fallbackMsg = `Hola, estuve analizando el perfil de ${oppBiz.name} en Google Maps y me gustaría compartir un consejo rápido para captar más clientes locales sin costo.`;
      setPitchResult(fallbackMsg);
      setStructuredPitch({
        shortMessage: fallbackMsg,
        emailSubject: `Mejora de visibilidad local para ${oppBiz.name}`,
        emailBody: `Hola, vi su negocio ${oppBiz.name} en Google Maps. Noté puntos oportunos donde pueden aumentar las llamadas de clientes sin necesidad de anuncios costosos. ¿Podemos agendar 5 minutos para explicarle?`,
        callScript: `Hola, hablo con el dueño de ${oppBiz.name}? Vi su negocio en Maps y me gustaría compartir una sugerencia rápida para aumentar las solicitudes de presupuesto sin costo.`,
        opportunities: oppBiz.opportunityData || [!oppBiz.website ? "Sin sitio web detectado" : "Perfil registrado"]
      });
    } finally {
      setIsPitchLoading(false);
    }
  };

  const handleSaveLeadFromEngine = (leadPayload: any) => {
    setLeads(prev => {
      const exists = prev.some(l => l.id === leadPayload.id || (l.client && l.client.toLowerCase() === leadPayload.businessName.toLowerCase()));
      if (exists) {
        return prev.map(l => (l.id === leadPayload.id || (l.client && l.client.toLowerCase() === leadPayload.businessName.toLowerCase())) ? { ...l, ...leadPayload } : l);
      }
      return [leadPayload, ...prev];
    });
    setSavedLeadIds(prev => new Set(prev).add(leadPayload.id));
    showToast(t("¡Lead guardado en tu CRM!", "Lead saved to your CRM!"), "success");
  };

  const handleUpdateLeadStatus = (leadId: string, newStatus: LeadStatusType, lastContactDate?: string, extraData?: any) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const updatedDate = lastContactDate || l.lastContact || new Date().toLocaleDateString();
        let nextAct = extraData?.nextAction;
        if (!nextAct) {
          if (newStatus === 'CONTACTED') nextAct = 'Follow up in 3 days';
          else if (newStatus === 'RESPONDED') nextAct = 'Send quote or book demo';
          else if (newStatus === 'QUOTE_SENT') nextAct = 'Follow up on quote';
          else if (newStatus === 'FOLLOW_UP') nextAct = 'Check back with lead';
          else if (newStatus === 'WON' || newStatus === 'CLIENT') nextAct = 'Onboard client & collect review';
          else if (newStatus === 'LOST' || newStatus === 'DISMISSED') nextAct = 'Archive';
          else nextAct = 'Contact today';
        }

        const updatedLead = {
          ...l,
          status: newStatus,
          lastContact: updatedDate,
          nextAction: nextAct,
          ...(extraData || {})
        };

        // Record meaningful lead status outcome transition into BEM Memory (TENANT_PRIVATE)
        LeadQualityEngine.recordLeadOutcomeInBem(updatedLead, user?.uid).catch(err => {
          console.warn('[App] Non-blocking lead outcome BEM persistence warning:', err);
        });

        return updatedLead;
      }
      return l;
    }));
    showToast(t(`Estado del lead actualizado a ${newStatus}`, `Lead status updated to ${newStatus}`), "info");
  };

  const generateSocialPost = async () => {
    if (!socialDesc) {
      showToast(t("Describe el trabajo realizado", "Please describe the work done first"), "info");
      return;
    }
    const targetLanguageName = socialContentLanguage === 'es' ? 'SPANISH' : 'ENGLISH';
    const prompt = `Create a viral social media post (FB/IG) based on this: "${socialDesc}". 
    Specific location or city: "${socialContext || profile.location}".
    Use a persuasive tone, emojis, relevant tags, and a strong call to action.
    
    Generate the post output strict in ${targetLanguageName} unless the user explicit selects Spanish mode. Current target language: ${targetLanguageName}.`;

    const systemInstruction = socialContentLanguage === 'es'
      ? "Eres un excelente y creativo Community Manager."
      : "You are an excellent and creative Community Manager.";

    const result = await handleAiCall(prompt, systemInstruction, imgAfter || imgBefore || undefined);
    setSocialResult(result);
    setGrowthStats(prev => ({ ...prev, posts: prev.posts + 1 }));
  };

  // Video script generation logic removed

  const sendWebhookNotification = async (leadData: any) => {
    if (isWebhookEnabled && webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'new_lead_captured',
            niche: niche,
            location: profile.location,
            companyName: profile.name,
            timestamp: new Date().toISOString(),
            lead: leadData
          })
        });
        console.log("Zapier/Make Notification dispatched!");
      } catch (e) {
        console.error("Webhook notification delivery failed:", e);
      }
    }
  };

  const analyzeLead = async () => {
    const db = getFirebaseDB();
    if (!leadRawText) {
      showToast(t("Por favor pega el mensaje del prospecto", "Please paste the lead's message first"), "info");
      return;
    }
    const prompt = `You are a professional lead parser and sales analyst specializing in US home services (${profile.category || 'HVAC, plumbing, roofing, lawn-care, remodeling'}).
Analyze this incoming message or customer inquiry: "${leadRawText}".

FEW-SHOT EXAMPLES:
- Lead alert: "Angi Lead: Roof Repair needed for John Harrison at 123 Main St, ${profile.location || 'Naples, FL'}. Phone: 239-555-0144. Urgency: Immediate."
  Parsed JSON: {"client": "John Harrison", "phone": "239-555-0144", "city": "Naples", "urgency": "Alta", "size": "Grande", "action": "Call John Harrison immediately regarding local roof repair.", "strategy": "Premium residential target with emergency roof restoration pitch.", "draftResponse": "Hi John! Thanks for reaching out about your roof repair in Naples. We can send a technician today to inspect the damage and give you an exact quote. Does this afternoon work for a quick visit?"}

- Lead alert: "Thumbtack Lead: Sarah Smith needs HVAC diagnostic in Fort Myers, small rattling noise."
  Parsed JSON: {"client": "Sarah Smith", "phone": "", "city": "Fort Myers", "urgency": "Media", "size": "Mediano", "action": "Contact Sarah Smith to secure diagnostic slot in Fort Myers.", "strategy": "HVAC maintenance dispatch with prompt local replacement pitch.", "draftResponse": "Hi Sarah! Thanks for reaching out about your AC unit in Fort Myers. We have an open slot today to diagnose the rattling noise and make sure it runs smoothly. What time works best for you?"}

Formulate the results using the same fields. If client name, phone number, email, or city/location are present in the text, extract them accurately. If not present in text, leave as empty string.

Output Schema:
{"client": string, "phone": string, "email": string, "city": string, "urgency": "Alta" | "Media" | "Baja", "size": "Grande" | "Mediano" | "Pequeño", "action": "Clean, brief action suggestion", "strategy": "Actionable sales advice", "draftResponse": "Response ready for WhatsApp/SMS: <150 words, with a CTA to schedule/visit, without inventing fixed prices if the profile does not have them", "suggestedPriceRange": "Estimated directional range e.g. $180 - $450 or empty"}

Return ONLY the raw JSON string. Do not include any intro, markdown styling, or text outside the curly braces.`;

    const systemInstruction = language === 'en'
      ? "You are an elite sales assistant and business operations expert for local service companies. Requirements: response <150 words, ready for WhatsApp, with a CTA to schedule/visit, without inventing fixed prices if the profile does not provide them. Return ONLY valid JSON without markdown delimiters."
      : "Eres un analista de ventas experto en el mercado de contratistas y servicios locales. Exige: respuesta <150 palabras, lista para WhatsApp, con CTA de agendar/visitar, sin inventar precios fijos si el profile no tiene. Responde únicamente un JSON válido, sin delimitadores ``` ni texto adicional.";

    const result = await handleAiCall(prompt, systemInstruction);
    try {
      const parsed = JSON.parse(result.replace(/```json|```/g, ''));
      setCurrentLeadAnalysis(parsed);
      
      const draftResult = parsed.draftResponse || parsed.strategy || parsed.action || '';
      const phoneMatch = leadRawText.match(/(\+?\d[\d\s\-().]{7,}\d)/);
      const detectedPhone = parsed.phone || (phoneMatch ? phoneMatch[0] : '');

      const nicheLtv: Record<string, number> = {
        'jardineria': 4500,
        'limpieza': 3800,
        'plomeria': 1200,
        'aire_acondicionado': 8500,
        'HVAC': 8500,
        'pest_control': 3200,
        'construccion': 12000,
        'techado': 15000,
        'solar': 25000,
        'piscina': 4000,
        'nieve': 3000,
        'handyman': 1500,
        'mascotas': 2200,
        'mudanzas': 5000,
        'bienestar': 3500,
        'cerrajeria': 800,
        'arborista': 6000,
        'puertas_garaje': 4500,
        'electricidad': 5000,
        'lavado_presion': 3200,
        'limpieza_alfombras': 1800,
        'remocion_escombros': 3000,
        'restauracion': 18000,
        'gruas': 1200,
        'electrodomesticos': 1000,
        'detallado_autos': 2500,
        'pisos_epoxicos': 9000,
        'cercas': 7500,
        'concreto': 11000,
        'chimeneas': 1500,
        'ventanas_puertas': 13000,
        'otro': 2000
      };
      const estimatedLtv = nicheLtv[niche] || 2500;

      const rawCity = (parsed.city || '').trim();
      const userCity = profile?.city || profile?.location?.split(',')?.[0]?.trim() || '';
      const hasInferredCity = rawCity.length >= 3 && rawCity.toLowerCase() !== 'unknown' && rawCity.toLowerCase() !== 'n/a';
      const finalCity = hasInferredCity ? rawCity : (userCity || 'Local Area');
      const needsLocationConfirm = !hasInferredCity;

      const newLeadData = {
        date: new Date().toLocaleDateString(),
        text: leadRawText,
        rawText: leadRawText,
        name: parsed.client || parsed.name || '',
        client: parsed.client || parsed.name || '',
        phone: detectedPhone || parsed.phone || '',
        email: parsed.email || '',
        city: finalCity,
        location: hasInferredCity ? rawCity : (profile?.location || finalCity),
        needsLocationConfirm,
        urgency: parsed.urgency || 'Media',
        size: parsed.size || 'Mediano',
        action: parsed.action || '',
        strategy: parsed.strategy || '',
        draftResponse: draftResult,
        status: 'NEW',
        ltv: parsed.size === 'Grande' ? estimatedLtv * 1.5 : parsed.size === 'Pequeño' ? estimatedLtv * 0.5 : estimatedLtv,
        userId: user?.uid || 'local'
      };
      
      let createdLeadId = '';
      if (user && isFirebaseReady && db) {
        logFirestoreWrite('leads');
        const docRef = await addDoc(collection(db, 'leads'), newLeadData);
        createdLeadId = docRef.id;
        const lWithId = { id: docRef.id, ...newLeadData } as Lead;
        setLeads([lWithId, ...leads]);
        sendWebhookNotification(lWithId);
      } else {
        createdLeadId = Date.now().toString();
        const lWithId = { id: createdLeadId, ...newLeadData } as Lead;
        setLeads([lWithId, ...leads]);
        sendWebhookNotification(lWithId);
      }

      const suggestedPriceRange = parsed.suggestedPriceRange || parsed.suggestedRange || (parsed.size === 'Grande' ? '$500 - $1,500' : parsed.size === 'Pequeño' ? '$95 - $180' : '$180 - $450');

      setLastAnalyzedDraft({
        draft: draftResult,
        phone: detectedPhone,
        rawText: leadRawText,
        clientName: parsed.client || parsed.name || '',
        leadId: createdLeadId,
        urgency: parsed.urgency || 'Alta',
        suggestedRange: suggestedPriceRange
      });

      // Track successful analyze count
      try {
        const curCount = parseInt(localStorage.getItem('bvelt_successful_analyzes') || '0', 10);
        localStorage.setItem('bvelt_successful_analyzes', (curCount + 1).toString());
      } catch (e) {}

      notifyOwner({
        event: 'analyze_message_success',
        emailOrUid: user?.email || user?.uid || profile?.email,
        details: { niche: profile?.category || niche, location: profile?.location || finalCity }
      });

      recordBveltEvent({
        uid: user?.uid || profile?.email,
        type: 'analyze_message_success',
        trade: profile?.category || niche,
        city: profile?.location || finalCity,
        meta: { leadId: createdLeadId, source: 'dashboard', clientName: parsed.client || parsed.name || '' }
      });

      setLeadRawText('');
      
      showToast(t("¡Respuesta redactada lista para enviar!", "Ready response drafted!"), "success");
    } catch (e) {
      showToast(t("Error analizando el lead", "Error analyzing lead"), "error");
    }
  };

  
  const handleCompleteOnboarding = async (data: OnboardingData, deepLinkAction?: { targetTab?: string; taskCode?: string; action?: any }) => {
    try {
      if (!data.email || !data.email.trim()) {
        showToast(t("El correo electrónico es obligatorio para completar el onboarding.", "Email is required to complete onboarding."), "error");
        return;
      }

      const updatedProfile: BusinessProfile = {
        ...profile,
        name: data.name.trim(),
        category: data.category.trim(),
        niche: data.category.trim(),
        subNiche: data.subNiche?.trim() || "",
        address: data.address.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        country: data.country.trim(),
        phone: data.phone.trim(),
        email: data.email.trim().toLowerCase(),
        gmbLink: data.gmbLink?.trim() || profile.gmbLink || "",
        location: data.address ? (data.address + ", " + data.city).trim() : data.city.trim(),
        marketRadius: data.marketRadius || 5,
        isOnboarded: true,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingStep: 3,
        lat: data.lat ?? profile.lat,
        lng: data.lng ?? profile.lng
      };

      setProfile(updatedProfile);
      localStorage.setItem("lf_profile", JSON.stringify(updatedProfile));
      localStorage.setItem("user_profile", JSON.stringify(updatedProfile));
      localStorage.setItem("bvelt_onboarding_completed", "true");

      // Save processed onboarding lead to state and storage so user has exactly 1 opportunity (Rule 2)
      const onboardingData = data as any;
      if (onboardingData.clientMessage && onboardingData.clientMessage.trim()) {
        const clientName = onboardingData.leadDetails?.clientName || (language === 'es' ? 'Cliente de Onboarding' : 'Onboarding Client');
        const budgetVal = onboardingData.leadDetails?.amount ? Number(onboardingData.leadDetails.amount) : undefined;
        
        const newOnboardingLead: Lead = {
          id: 'lead_' + Date.now(),
          date: new Date().toLocaleDateString(),
          timestamp: new Date().toISOString(),
          text: onboardingData.clientMessage.trim(),
          urgency: 'Alta',
          size: budgetVal && budgetVal > 1000 ? 'Grande' : 'Medio',
          estimatedValue: budgetVal,
          ltv: budgetVal,
          action: language === 'es' ? 'Enviar respuesta por WhatsApp' : 'Send WhatsApp response',
          strategy: language === 'es' ? 'Respuesta redactada lista para cerrar el trato' : 'Drafted response ready to close the deal',
          client: clientName,
          phone: data.phone || '',
          email: '',
          status: 'NEW',
          city: data.city,
          category: data.category,
          isDemo: false, // Strict Rule 3: not fake, this is a real user input lead!
          draftResponse: onboardingData.draftResponse || ''
        };

        const updatedLeadsList = [newOnboardingLead, ...leads];
        setLeads(updatedLeadsList);
        localStorage.setItem('lf_leads', JSON.stringify(updatedLeadsList));

        // Save to firestore if authenticated
        if (user && isFirebaseReady && db) {
          try {
            const { collection, addDoc } = await import("firebase/firestore");
            await addDoc(collection(db, 'leads'), {
              ...newOnboardingLead,
              userId: user.uid
            });
          } catch (fsLeadErr) {
            console.warn("Direct Firestore onboarding lead sync:", fsLeadErr);
          }
        }
      }

      // Attempt server-side save with token if logged in
      if (user && isFirebaseReady) {
        try {
          const token = await getAccessToken();
          if (token) {
            await fetch("/api/profile/save-onboarding", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
              },
              body: JSON.stringify(data)
            });
          }
        } catch (apiErr) {
          console.warn("Backend save onboarding error, falling back to direct Firestore:", apiErr);
        }

        if (db) {
          try {
            const { doc, setDoc } = await import("firebase/firestore");
            const profileRef = doc(db, "profiles", user.uid);
            await setDoc(profileRef, updatedProfile, { merge: true });
          } catch (fsErr) {
            console.warn("Direct Firestore onboarding sync fallback:", fsErr);
          }
        }
      }

      setShowOnboarding(false);
      
      // Complete Day 1: Initial Market Audit on checklist since scan was performed
      try {
        const rawChecklist = localStorage.getItem('bvelt_first_week_checklist');
        if (rawChecklist) {
          const parsed = JSON.parse(rawChecklist);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((item: any) => item.id === 'day_1' ? { ...item, completed: true } : item);
            localStorage.setItem('bvelt_first_week_checklist', JSON.stringify(updated));
            window.dispatchEvent(new Event('storage'));
          }
        }
      } catch {}

      showToast(t("¡Configuración de Negocio completada con éxito!", "Business profile configured successfully!"), "success");
      
      if (deepLinkAction?.targetTab) {
        setActiveTab(deepLinkAction.targetTab as any);
      } else {
        setActiveTab("dashboard");
      }
      if (deepLinkAction?.action) {
        try {
          localStorage.setItem('bvelt_pending_executing_action', JSON.stringify(deepLinkAction.action));
        } catch {}
      }
    } catch (e: any) {
      console.error("Error saving onboarding data:", e);
      showToast(e?.message || t("Error al guardar onboarding", "Error saving onboarding"), "error");
    }
  };

  const loadDemoData = (cat: string) => {
    setIsAiLoading(true);
    const targetCity = profile?.city || (profile?.location ? profile.location.split(',')[0].trim() : '') || 'Naples';
    
    // Custom Leads based on category
    const demoLeadsMap: Record<string, Lead[]> = {
      'jardineria': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Limpieza de jardín completo, poda de árboles y preparación de mantas en casa residencial.', 'Full yard clean-up, tree trimming and mulch preparation in a residential home.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Llamar para agendar visita de estimación.', 'Call to schedule estimate visit.'), strategy: t('Destacar puntualidad y dejar todo el área limpia.', 'Highlight punctuality and leave the area clean.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Diseño e instalación de paisajismo con sistema de riego automático inteligente en condominio.', 'Landscape design and installation with smart automated irrigation system in a condo.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Preparar render 3D preliminar y cotización.', 'Prepare preliminary 3D rendering and quote.'), strategy: t('Ofrecer garantía de 1 año en plantas.', 'Offer 1-year warranty on plants.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Mantenimiento quincenal de césped incluyendo control de maleza y fertilización.', 'Bi-weekly lawn maintenance including weed control and fertilization.'), urgency: t('Baja', 'Low'), size: t('Pequeño', 'Small'), action: t('Enviar contrato de servicio recurrente.', 'Send recurring service contract.'), strategy: t('Ofrecer primer mes con 10% de descuento.', 'Offer first month with 10% discount.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'limpieza': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Limpieza profunda de mudanza (Move-out Cleaning) en casa de 4 habitaciones y 3 baños.', 'Deep move-out cleaning in a 4-bedroom, 3-bathroom house.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Confirmar disponibilidad para este sábado.', 'Confirm availability for this Saturday.'), strategy: t('Garantizar devolución de depósito por limpieza.', 'Ensure security deposit return through cleaning.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Servicio recurrente semanal de limpieza de oficinas corporativas (3 pisos, áreas comunes).', 'Weekly recurring corporate office cleaning service (3 floors, common areas).'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Agendar cita con el administrador del edificio.', 'Schedule appointment with building manager.'), strategy: t('Resaltar el uso de productos ecológicos ecofriendly.', 'Highlight eco-friendly products usage.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Limpieza profunda post-construcción en apartamento remodelado de 1,200 sq ft.', 'Deep post-construction cleaning in a 1,200 sq ft remodeled apartment.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Enviar presupuesto de tarifa plana.', 'Send flat rate quote.'), strategy: t('Mencionar remoción exhaustiva de polvo fine.', 'Mention thorough fine dust removal.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'plomeria': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Reparación de filtración severa en tubería de agua principal y cambio de válvula de paso.', 'Repair of severe leak in main water pipe and shutoff valve replacement.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Enviar plomero de emergencia de inmediato.', 'Dispatch emergency plumber immediately.'), strategy: t('Dar respuesta en menos de 1 hora.', 'Provide response in under 1 hour.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Instalación de calentador de agua sin tanque (Tankless) de alta eficiencia.', 'Installation of high-efficiency tankless water heater.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Llamar para coordinar entrega de calentador.', 'Call to coordinate heater delivery.'), strategy: t('Enfatizar ahorro energético a largo plazo.', 'Emphasize long-term energy savings.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Destape de drenaje general y limpieza con hidrolavado (Hydro-jetting).', 'Main drain unclogging and cleaning with hydro-jetting.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Enviar cotización del servicio de destape.', 'Send drain cleaning quote.'), strategy: t('Ofrecer garantía de 30 días contra nuevas obstrucciones.', 'Offer 30-day warranty against new clogs.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'aire_acondicionado': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Fallo total en sistema de aire acondicionado central (no enfría) en residencial.', 'Total failure in central AC system (not cooling) in residential.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Asignar técnico para diagnóstico.', 'Assign technician for diagnosis.'), strategy: t('Enfatizar servicio el mismo día.', 'Emphasize same-day service.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Reemplazo completo de unidad de condensadora de 5 toneladas y split interior.', 'Full replacement of 5-ton condenser unit and indoor split.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Programar instalación para el martes.', 'Schedule installation for Tuesday.'), strategy: t('Ofrecer financiamiento al 0% de interés.', 'Offer 0% interest financing.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Mantenimiento preventivo anual (Tune-up) de aire acondicionado.', 'Annual preventive maintenance (Tune-up) for air conditioning.'), urgency: t('Baja', 'Low'), size: t('Pequeño', 'Small'), action: t('Enviar enlace para agendar cita online.', 'Send online scheduling link.'), strategy: t('Sugerir membresía de mantenimiento anual.', 'Suggest annual maintenance membership.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'HVAC': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Fallo total en sistema de aire acondicionado central (no enfría) en residencial.', 'Total failure in central AC system (not cooling) in residential.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Asignar técnico para diagnóstico.', 'Assign technician for diagnosis.'), strategy: t('Enfatizar servicio el mismo día.', 'Emphasize same-day service.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Reemplazo completo de unidad de condensadora de 5 toneladas y split interior.', 'Full replacement of 5-ton condenser unit and indoor split.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Programar instalación para el martes.', 'Schedule installation for Tuesday.'), strategy: t('Ofrecer financiamiento al 0% de interés.', 'Offer 0% interest financing.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Mantenimiento preventivo anual (Tune-up) de aire acondicionado.', 'Annual preventive maintenance (Tune-up) for air conditioning.'), urgency: t('Baja', 'Low'), size: t('Pequeño', 'Small'), action: t('Enviar enlace para agendar cita online.', 'Send online scheduling link.'), strategy: t('Sugerir membresía de mantenimiento anual.', 'Suggest annual maintenance membership.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'construccion': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Remodelación completa de baño principal incluyendo azulejos, ducha italiana y tocador.', 'Complete master bathroom remodel including tiles, walk-in shower and vanity.'), urgency: t('Alta', 'High'), size: t('Grande', 'Large'), action: t('Programar reunión para revisar selección de materiales.', 'Schedule meeting to review material selection.'), strategy: t('Destacar diseño personalizado y acabados de lujo.', 'Highlight custom design and luxury finishes.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Instalación de deck exterior de madera compuesta y pérgola iluminada.', 'Installation of composite wood outdoor deck and lighted pergola.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Enviar cotización con desglose de materiales.', 'Send quote with materials breakdown.'), strategy: t('Prometer durabilidad de materiales compuestos sin mantenimiento.', 'Promise composite materials durability without maintenance.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-3', date: new Date().toLocaleDateString(), text: t('Reparación de drywall y pintura completa de sala de estar tras filtración.', 'Drywall repair and full living room painting after leak.'), urgency: t('Media', 'Medium'), size: t('Medio', 'Medium'), action: t('Enviar supervisor para medir paredes.', 'Send supervisor to measure walls.'), strategy: t('Asegurar integración de color 100% invisible.', 'Ensure 100% invisible color blending.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'piscina': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Mantenimiento semanal completo y balanceo químico de piscina de agua salada.', 'Complete weekly maintenance and chemical balancing of saltwater pool.'), urgency: t('Media', 'Medium'), size: t('Medio', 'Medium'), action: t('Enviar propuesta de servicio mensual.', 'Send monthly service proposal.'), strategy: t('Destacar transparencia en el reporte químico.', 'Highlight chemical report transparency.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Reparación de bomba de piscina y cambio de filtro de arena.', 'Pool pump repair and sand filter replacement.'), urgency: t('Alta', 'High'), size: t('Grande', 'Large'), action: t('Enviar técnico de reparación hoy mismo.', 'Send repair tech today.'), strategy: t('Mencionar garantía en piezas y mano de obra.', 'Mention warranty on parts and labor.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'solar': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Instalación de sistema solar residencial de 10kW con batería de respaldo.', '10kW residential solar system installation with battery backup.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Agendar consultoría energética presencial.', 'Schedule in-person energy consulting.'), strategy: t('Calcular ROI y ahorros proyectados a 10 años.', 'Calculate ROI and projected savings over 10 years.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Limpieza y mantenimiento de paneles solares en edificio comercial.', 'Solar panel cleaning and maintenance on a commercial building.'), urgency: t('Baja', 'Low'), size: t('Medio', 'Medium'), action: t('Enviar cotización por limpieza anual.', 'Send quote for annual cleaning.'), strategy: t('Explicar cómo la limpieza mejora la eficiencia en un 15%.', 'Explain how cleaning improves efficiency by 15%.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'nieve': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Remoción de nieve en driveway y aceras tras tormenta de 10 pulgadas.', 'Snow removal on driveway and sidewalks after a 10-inch storm.'), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Despachar equipo de limpieza de inmediato.', 'Dispatch cleaning crew immediately.'), strategy: t('Asegurar acceso seguro a la propiedad.', 'Ensure safe property access.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Contrato de salado preventivo para estacionamiento de centro comercial.', 'Preventive salting contract for a shopping mall parking lot.'), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Enviar contrato de temporada de invierno.', 'Send winter season contract.'), strategy: t('Enfatizar reducción de riesgos de resbalones.', 'Emphasize slip-and-fall risk reduction.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ],
      'handyman': [
        { id: 'dl-1', date: new Date().toLocaleDateString(), text: t('Montaje de muebles, instalación de TV y cambio de lámparas en apartamento.', 'Furniture assembly, TV mounting and light fixture replacement in apartment.'), urgency: t('Media', 'Medium'), size: t('Medio', 'Medium'), action: t('Confirmar lista de tareas para el viernes.', 'Confirm task list for Friday.'), strategy: t('Ofrecer tarifa por hora o por proyecto.', 'Offer hourly or per-project rate.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity },
        { id: 'dl-2', date: new Date().toLocaleDateString(), text: t('Reparación de cerraduras y ajuste de puertas que no cierran bien.', 'Lock repair and adjustment of doors that do not close properly.'), urgency: t('Alta', 'High'), size: t('Pequeño', 'Small'), action: t('Enviar presupuesto rápido por WhatsApp.', 'Send quick quote via WhatsApp.'), strategy: t('Mencionar rapidez y herramientas profesionales.', 'Mention speed and professional tools.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: targetCity }
      ]
    };

    const demoTransactionsMap: Record<string, Transaction[]> = {
      'jardineria': [
        { id: 'dt-1', name: t('Limpieza Completa Parcela', 'Full Yard Cleanup'), amount: 350, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Instalación Césped Premium', 'Premium Turf Installation'), amount: 1200, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Sistema de Riego HOA Verde', 'Green HOA Irrigation System'), amount: 2400, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'limpieza': [
        { id: 'dt-1', name: t('Servicio Limpieza Mensual Edificio', 'Monthly Building Cleaning Service'), amount: 1500, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Limpieza Profunda Residencia Sol', 'Sun Residence Deep Cleaning'), amount: 650, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Desinfección Oficinas Corporativas', 'Corporate Office Disinfection'), amount: 1200, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'plomeria': [
        { id: 'dt-1', name: t('Instalación Calentador Sin Tanque', 'Tankless Water Heater Installation'), amount: 1850, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Reparación Fuga Calzada', 'Driveway Leak Repair'), amount: 950, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Destape Drenajes Multi-residencia', 'Multi-home Drain Unclogging'), amount: 1400, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'aire_acondicionado': [
        { id: 'dt-1', name: t('Mantenimiento Completo Clínica', 'Clinic Comprehensive Maintenance'), amount: 2100, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Instalación Split 3 Toneladas', '3-Ton Split Installation'), amount: 3500, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Cambio de Compresor Exterior', 'Outdoor Compressor Replacement'), amount: 1600, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'HVAC': [
        { id: 'dt-1', name: t('Mantenimiento Completo Clínica', 'Clinic Comprehensive Maintenance'), amount: 2100, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Instalación Split 3 Toneladas', '3-Ton Split Installation'), amount: 3500, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Cambio de Compresor Exterior', 'Outdoor Compressor Replacement'), amount: 1600, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'construccion': [
        { id: 'dt-1', name: t('Remodelación Entrada Principal', 'Main Entrance Remodel'), amount: 4800, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Instalación Cubierta de Polímero', 'Polymer Decking Installation'), amount: 8000, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-3', name: t('Renovación Estructura Pérgola', 'Pergola Structure Renovation'), amount: 3500, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'piscina': [
        { id: 'dt-1', name: t('Servicio Mensual Platino', 'Platinum Monthly Service'), amount: 180, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Instalación Bomba Hayward', 'Hayward Pump Installation'), amount: 1200, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'solar': [
        { id: 'dt-1', name: t('Depósito Instalación 8kW', '8kW Installation Deposit'), amount: 5000, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Balance Final Proyecto Solar', 'Solar Project Final Balance'), amount: 15000, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'nieve': [
        { id: 'dt-1', name: t('Remoción de Nieve Comercial', 'Commercial Snow Removal'), amount: 600, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Servicio de Salado Estacionamiento', 'Parking Lot Salting Service'), amount: 350, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true }
      ],
      'handyman': [
        { id: 'dt-1', name: t('Montaje de Estructura TV', 'TV Frame Assembly'), amount: 120, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
        { id: 'dt-2', name: t('Reparaciones Generales Oficina', 'General Office Repairs'), amount: 450, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true }
      ]
    };

    const selectedCategory = cat || 'otro';
    const profileCityDefault = (profile?.city || (profile?.location ? profile.location.split(',')[0] : '') || 'Naples').trim();
    const rawCustomLeads = demoLeadsMap[selectedCategory] || [
      { id: 'dl-1', date: new Date().toLocaleDateString(), text: t(`Servicio estimado para cliente en ${profileCityDefault}.`, `Estimated service for client in ${profileCityDefault}.`), urgency: t('Alta', 'High'), size: t('Medio', 'Medium'), action: t('Estimar costo total del servicio.', 'Estimate total service cost.'), strategy: t('Enfatizar profesionalismo y garantía.', 'Emphasize professionalism and guarantee.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: profileCityDefault },
      { id: 'dl-2', date: new Date().toLocaleDateString(), text: t(`Proyecto de optimización y mantenimiento general adaptado.`, `Tailored optimization and general maintenance project.`), urgency: t('Media', 'Medium'), size: t('Grande', 'Large'), action: t('Agendar llamada técnica para coordinar.', 'Schedule technical call to coordinate.'), strategy: t('Dar presupuesto transparente.', 'Provide transparent pricing.'), isDemo: true, status: 'NEW', tag: 'DEMO', city: profileCityDefault }
    ];
    const customLeads = rawCustomLeads.map(l => ({
      ...l,
      isDemo: true,
      status: l.status || 'NEW',
      tag: 'DEMO',
      category: selectedCategory,
      city: profileCityDefault
    }));

    const rawCustomTransactions = demoTransactionsMap[selectedCategory] || [
      { id: 'dt-1', name: t('Servicio General Premium', 'Premium General Service'), amount: 450, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true },
      { id: 'dt-2', name: t('Instalación y Optimización', 'Installation & Optimization'), amount: 1250, status: 'pendiente', date: new Date().toLocaleDateString(), isDemo: true },
      { id: 'dt-3', name: t('Contrato Recurrente Mensual', 'Monthly Recurring Contract'), amount: 850, status: 'pagado', date: new Date().toLocaleDateString(), isDemo: true }
    ];
    const customTransactions = rawCustomTransactions.map(t => ({
      ...t,
      isDemo: true
    }));

    setTimeout(() => {
      setLeads(customLeads);
      setClientTransactions(customTransactions);
      setIsAiLoading(false);
      if (!hasActivatedTrial && !hasUsedTrial) {
        activateTrial();
        showToast(t("¡Excelentes noticias! Hemos cargado datos de demostración y activado tu prueba premium de 7 días.", "Excellent news! We have loaded demo data and activated your 7-day premium trial."), 'success');
      } else {
        showToast(t("¡Datos de demostración cargados con éxito!", "Demo data successfully loaded!"), 'success');
      }
    }, 1000);
  };

  const triggerDemoVideoSeed = () => {
    localStorage.setItem('lf_demo_video', 'true');
    
    // Set Profile with matching name & location
    const updatedProfile: BusinessProfile = {
      ...profile,
      name: "Premium Services Toronto",
      location: "Toronto, ON, Canada",
      category: "construccion",
      locationSource: 'DEMO_EXAMPLE'
    };
    setProfile(updatedProfile);
    localStorage.setItem('lf_profile', JSON.stringify(updatedProfile));

    // Set Streak to 18
    setStreak(18);
    localStorage.setItem('lf_streak', '18');

    // Set Trust Points to 1250
    setTrustPoints(1250);

    // Set Growth Stats: reviews to 42, leads to 30 (displays as +3 leads today), and ROI
    const stats = {
      reviews: 42,
      posts: 10,
      leads: 30,
      roi: 5240
    };
    setGrowthStats(stats);
    localStorage.setItem('lf_growth', JSON.stringify(stats));

    // Force tab to dashboard
    setActiveTab('dashboard');

    // Dispatch a custom event so other components (like DashboardView) reload their state instantly
    window.dispatchEvent(new Event('lf_demo_video_seeded'));

    showToast(t("¡Modo Demo Video Activado! Perfil, Racha y Métricas cargados.", "Demo Video Mode Activated! Profile, Streak and Metrics loaded."), "success");
  };

  const addTransaction = async () => {
    const db = getFirebaseDB();
    if (!newClientName || !newClientAmount) return;
    const tData = {
      name: newClientName,
      amount: parseFloat(newClientAmount),
      status: newClientStatus,
      date: new Date().toLocaleDateString(),
      userId: user?.uid || 'local'
    };
    
    if (user && isFirebaseReady && db) {
      logFirestoreWrite('transactions');
      const docRef = await addDoc(collection(db, 'transactions'), tData);
      setClientTransactions([{ id: docRef.id, ...tData } as Transaction, ...clientTransactions]);
    } else {
      setClientTransactions([{ id: Date.now().toString(), ...tData } as Transaction, ...clientTransactions]);
    }
    setNewClientName('');
    setNewClientAmount('');
  };

  const printInvoice = (trans: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast(t("Permite las ventanas emergentes para imprimir", "Please enable popups to print"), "error");
      return;
    }
    
    const subtotal = trans.amount;
    const taxValue = Number((subtotal * 0.07).toFixed(2));
    const cardSurcharge = trans.status === 'pendiente' ? Number((subtotal * 0.03).toFixed(2)) : 0;
    const grandTotal = Number((subtotal + taxValue + cardSurcharge).toFixed(2));

    printWindow.document.write(`
      <html>
        <head>
          <title>Factura - ${trans.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              padding: 40px;
              color: #1e293b;
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .logo-title {
              font-size: 24px;
              font-weight: 900;
              color: #4f46e5;
            }
            .invoice-tag {
              font-size: 14px;
              font-weight: 950;
              text-transform: uppercase;
              color: #ffffff;
              background: #0f172a;
              padding: 6px 15px;
              border-radius: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
              font-size: 12px;
              line-height: 1.5;
            }
            .info-section h3 {
              margin: 0 0 5px 0;
              font-size: 11px;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 1px;
            }
            .info-section p {
              margin: 0;
              font-weight: 700;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 35px;
              font-size: 12px;
            }
            .items-table th {
              border-bottom: 2px solid #e2e8f0;
              text-align: left;
              padding: 10px;
              color: #64748b;
              font-size: 10px;
              text-transform: uppercase;
            }
            .items-table td {
              padding: 12px 10px;
              border-bottom: 1px solid #f1f5f9;
            }
            .totals-container {
              margin-left: auto;
              width: 250px;
              font-size: 12px;
              line-height: 1.6;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
            }
            .total-row.grand {
              border-top: 2px solid #0f172a;
              font-weight: 900;
              font-size: 15px;
              padding-top: 10px;
              margin-top: 10px;
              color: #0f172a;
            }
            .footer-line {
              text-align: center;
              margin-top: 60px;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px dashed #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
              <div class="logo-title">${profile.name}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 500; margin-top: 3px;">${profile.category} • ${profile.location}</div>
            </div>
            <div class="invoice-tag">${trans.status === 'pagado' ? 'RECIBO DE PAGO' : 'FACTURA PENDIENTE'}</div>
          </div>

          <div class="info-grid">
            <div class="info-section">
              <h3>Emitido para:</h3>
              <p>${trans.name}</p>
            </div>
            <div class="info-section" style="text-align: right;">
              <h3>Fecha de Emisión:</h3>
              <p>${trans.date}</p>
              <h3 style="margin-top: 10px;">ID de Factura:</h3>
              <p style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">#INV-${trans.id}</p>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>{t('Descripción del Servicio', 'Service Description')}</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600;">Servicio Profesional Realizado - ${profile.category}</td>
                <td style="text-align: right; font-weight: 700;">$${subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals-container">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Impuestos (7%):</span>
              <span>$${taxValue.toFixed(2)}</span>
            </div>
            ${cardSurcharge > 0 ? `
            <div class="total-row" style="color: #64748b;">
              <span>Recargo por tarjeta (3%):</span>
              <span>$${cardSurcharge.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row grand">
              <span>Monto Total:</span>
              <span>$${grandTotal.toFixed(2)} USD</span>
            </div>
          </div>

          <div class="footer-line">
            ¡Muchas gracias por su negocio y confianza en nuestra empresa familiar!<br/>
            Si tiene alguna duda sobre este recibo, contáctenos al ${profile.phone}.
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyToClipboard = (text: string, category?: 'review' | 'quote' | 'post') => {
    navigator.clipboard.writeText(text);
    showToast(t("Copiado al portapapeles", "Copied to clipboard"), "success");
    if (category) {
      const finalKeyBvelt = category === 'review' ? 'bvelt_reviews_replied' : category === 'quote' ? 'bvelt_quotes_sent' : 'bvelt_posts_created';
      const finalKeyLocalflow = category === 'review' ? 'localflow_reviews_replied' : category === 'quote' ? 'localflow_quotes_sent' : 'localflow_posts_created';
      const count = parseInt(localStorage.getItem(finalKeyBvelt) || localStorage.getItem(finalKeyLocalflow) || '0', 10);
      localStorage.setItem(finalKeyBvelt, String(count + 1));
      localStorage.setItem(finalKeyLocalflow, String(count + 1));
      
      // Sync seamlessly with app level growth stats state
      if (category === 'review') {
        setGrowthStats(prev => ({ ...prev, reviews: (prev.reviews || 0) + 1 }));
      } else if (category === 'post') {
        setGrowthStats(prev => ({ ...prev, posts: (prev.posts || 0) + 1 }));
      }
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, type: 'before' | 'after' | 'photoToPost') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_width = 1200;

          if (width > max_width) {
            height = Math.round((height * max_width) / width);
            width = max_width;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          
          if (type === 'before') setImgBefore(dataUrl);
          else if (type === 'after') setImgAfter(dataUrl);
          else if (type === 'photoToPost') setPhotoToPostImage(dataUrl);
        };
        if (typeof event.target?.result === 'string') {
          img.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateSurcharges = () => {
    const base = parseFloat(calcBase) || 0;
    const tax = (parseFloat(calcTax) || 0) / 100;
    const stripeFee = 0.029 + 0.3 / (base || 1);
    return {
      base: base * (1 + tax),
      stripe: base * (1 + tax + stripeFee),
      bank: base * (1 + tax + 0.01)
    };
  };

  const calculateMarketGap = () => {
    if (!myReviews.trim() || !compReviews.trim()) {
      showToast(t("Por favor introduce el número de tus opiniones y de tu competidor para realizar la simulación real.", "Please enter your review count and competitor's review count to perform the real simulation."), "info");
      return;
    }
    setIsGapLoading(true);
    setGapResult(null);
    const steps = [
      t("Iniciando simulación de vecindario...", "Initializing neighborhood growth simulator..."),
      t("Extrayendo datos del perfil local...", "Extracting local profile data..."),
      t("Analizando al competidor #1 en Maps...", "Analyzing #1 Maps competitor..."),
      t("Calculando velocidad de adquisición de reseñas...", "Running Bvelt velocity algorithms...")
    ];
    
    let currentStep = 0;
    setGapLoadingStep(steps[0]);
    
    let simulatedMy = myReviews;
    let simulatedComp = compReviews;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setGapLoadingStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        const my = parseInt(simulatedMy) || 0;
        const comp = parseInt(simulatedComp) || 0;
        if (comp <= my) {
          setGapResult(t("🎉 ¡Estás ganando en visibilidad de Google Maps! Tu perfil se posiciona orgánicamente fuerte ante este competidor. ¡Sigue utilizando Bvelt para blindar tu liderazgo!", "🎉 You are winning in Google Maps visibility! Your profile is organically dominant against this competitor. Keep using Bvelt to bulletproof your local lead pipeline!"));
        } else {
          const gap = comp - my;
          const weeks = Math.ceil(gap / 3.5); // 3.5 reviews per week average with Bvelt
          setGapResult(t(`⚠️ Brecha de Mercado Detectada: Te faltan ${gap} reseñas genuinas de Google para superar al competidor líder de tu zona.\n\n🎯 Solución Bvelt: Consiguiendo un promedio sano de 3.5 opiniones auténticas por semana con el motor inteligente, tu negocio superará y rebasará esta brecha en aproximadamente ${weeks} semanas para escalar en el ranking del mapa.`,
                           `⚠️ Local Gap Detected: You need ${gap} more genuine Google reviews to match and surpass the local market leader.\n\n🎯 Bvelt Solution: By securing a healthy average of 3.5 genuine customer feedback loops per week through our automated system, you can close this gap in approximately ${weeks} weeks and climb the local map pack.`));
        }
        setIsGapLoading(false);
      }
    }, 800);
  };

  const publishDarkLead = () => {
    if (!darkLeadText || !darkLeadText.trim()) {
      showToast(t("Por favor escribe el mensaje o necesidad del cliente antes de derivar.", "Please enter the client request before forwarding."), "info");
      return;
    }
    const db = getFirebaseDB();
    const newLead = {
      id: Date.now().toString(),
      text: darkLeadText.trim(),
      date: t('Hace un momento', 'Just now')
    };
    setDarkPool(prev => [newLead, ...prev]);
    setDarkLeadText('');
    setTrustPoints(p => p + 25); // Reward for sharing
    showToast(t("¡Lead derivado con éxito a la Red de Aliados! Ganaste +25 puntos de confianza.", "Lead successfully forwarded to Partner Network! You earned +25 trust points."), "success");

    // Firebase Sync (background, non-blocking)
    if (user && db) {
      logFirestoreWrite('dark_pool');
      addDoc(collection(db, 'dark_pool'), { ...newLead, userId: user.uid }).catch(e => {
        console.warn("Dark pool background sync warning:", e);
      });
    }
  };

  const generateBudgetPdf = () => {
    const bName = profile.name;
    const content = `
      <html>
        <head>
          <title>Presupuesto ${bName}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #4f46e5; }
            .details { margin-bottom: 40px; }
            .footer { margin-top: 50px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .table { w-full; border-collapse: collapse; margin-bottom: 30px; }
            .table th { text-align: left; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; }
            .table td { padding: 10px; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${bName.toUpperCase()}</div>
            <p>Estimación de Proyecto - ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="details">
            <h3>Descripción del Trabajo:</h3>
            <p>${socialDesc || "Proyecto de mantenimiento local"}</p>
          </div>
          <table class="table" style="width: 100%">
            <thead>
              <tr>
                <th>{t('Concepto', 'Concept')}</th>
                <th>{t('Monto Estimado', 'Estimated Amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('Servicios Profesionales', 'Professional Services')}</td>
                <td>$${calcBase || "0.00"}</td>
              </tr>
              <tr>
                <td>Impuestos (${calcTax}%)</td>
                <td>$${((parseFloat(calcBase) || 0) * (parseFloat(calcTax) || 0) / 100).toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold">
                <td>TOTAL</td>
                <td>$${(parseFloat(calcBase) || 0 * (1 + (parseFloat(calcTax) || 0) / 100)).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p>* Este es un presupuesto preliminar generado por Bvelt.</p>
          <div class="footer">
            <p>Contacto: ${profile.phone}</p>
            <p>Ubicación: ${profile.location}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.close();
    }
  };

  const shareAchievement = () => {
    const text = `🚀 ¡Mis logros con Bvelt! 🚀
✅ Reviews: ${growthStats.reviews}
📝 Posts: ${growthStats.posts}
🎯 Leads: ${growthStats.leads}
💰 ROI: $${growthStats.roi}
🔥 Racha: ${streak} días

Descarga la app y crece tu negocio: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const testAiHealth = async () => {
    setAiStatus('testing');
    try {
      const result = await handleAiCall("Di 'funcionando' o 'correcto' si puedes escucharme.", "System health check.");
      if (result && result.trim().length > 0) {
        setAiStatus('online');
        alert("✅ El Sistema de Optimización está conectado y funcionando correctamente.\n\nResultado: " + result);
      } else {
        setAiStatus('error');
        alert("❌ Error: La respuesta del Sistema está vacía.");
      }
    } catch (e: any) {
      setAiStatus('error');
      const errMessage = e instanceof Error ? e.message : String(e);
      alert("❌ Error de conexión con los Sistemas de Optimización:\n\n" + errMessage + "\n\nPor favor, verifica la configuración en los Ajustes locales o contacta con soporte técnico.");
    }
  };

  const surcharges = calculateSurcharges();

  // --- Voice Dictation Simulation ---
  const startVoice = () => {
    setIsRecording(true);
    // Real browser API
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return alert("Tu navegador no soporta dictado");
    const rec = new SpeechRecognition();
    rec.lang = language === 'es' ? 'es-ES' : 'en-US';
    rec.onresult = (e: any) => {
      setSocialDesc(prev => prev + " " + e.results[0][0].transcript);
      setIsRecording(false);
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    rec.start();
  };

  const memoizedDashboardView = useMemo(() => {
    if (activeTab !== 'dashboard' && activeTab !== 'growth' && activeTab !== 'action_center' && activeTab !== 'ledger') return null;
    return (
      <DashboardView 
        activeTab={activeTab}
        language={language}
        profile={profile}
        t={t}
        setActiveTab={setActiveTab}
        setActiveSubRow={setActiveSubRow}
        setSelectedMobileView={setSelectedMobileView}
        setActiveSection={setActiveSection}
        streak={streak} 
        growthStats={growthStats} 
        db={db}
        user={user}
        leads={leads}
        clientTransactions={clientTransactions}
        showToast={showToast}
        clientTransactionsLength={clientTransactions.length}
        onLoadDemo={loadDemoData}
        onOpenOnboarding={() => setShowOnboarding(true)}
        onStartVoice={() => {
          startVoiceAssistant();
          setVoiceCommandResult(t("Guion sugerido para pedir reseña: 'Hola, soy [Nombre] de [Negocio]. Nos encantaría que nos compartieras tu experiencia en Google Maps. Si tienes un momento, te envío el enlace por SMS. ¡Gracias!'", "Suggested script to ask for a review: 'Hi, I'm [Name] from [Business]. We'd love for you to share your experience on Google Maps. If you have a moment, I'll send the link via SMS. Thanks!'"));
        }}
        onRunSeoAudit={runSeoAudit}
        onUpdateProfile={(updated: Partial<BusinessProfile>) => {
          setProfile(prev => {
            const next = { ...prev, ...updated };
            localStorage.setItem('lf_profile', JSON.stringify(next));
            localStorage.setItem('user_profile', JSON.stringify(next));
            if (user && isFirebaseReady && db) {
              try {
                const profileRef = doc(db, 'profiles', user.uid);
                setDoc(profileRef, next, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'profiles/' + user.uid));
              } catch (e) {
                // ignore
              }
            }
            return next;
          });
          if (!hasActivatedTrial && !hasUsedTrial) {
            activateTrial();
            showToast(t("¡Tu Prueba Premium de 7 Días ha sido activada con éxito!", "Your 7-Day Premium Trial has been successfully activated!"), 'success');
          }
        }}
        onAddTrustPoints={(pts: number) => {
          setTrustPoints(curr => {
            const updatedPoints = curr + pts;
            if (user && isFirebaseReady && db) {
              try {
                const profileRef = doc(db, 'profiles', user.uid);
                setDoc(profileRef, { 
                  trustPoints: updatedPoints,
                  updatedAt: new Date().toISOString()
                }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'profiles/' + user.uid));
              } catch (e) {
                console.error("Firestore update failed", e);
              }
            }
            return updatedPoints;
          });
        }}
      />
    );
  }, [activeTab, language, profile, streak, growthStats, db, user, leads, clientTransactions.length, hasActivatedTrial, hasUsedTrial, isFirebaseReady]);

  if (publicFunnelReportId) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicReportFunnelPage
            reportId={publicFunnelReportId}
            onActivateTrial={(bizName) => {
              const nowStr = new Date().toISOString();
              const newProfile = {
                ...profile,
                name: bizName || 'Tu Negocio',
                plan: 'trial',
                subscriptionStatus: 'trialing',
                hasUsedTrial: true,
                trialStartDate: nowStr
              };
              setProfile(newProfile);
              localStorage.setItem('lf_profile', JSON.stringify(newProfile));
              localStorage.setItem('user_profile', JSON.stringify(newProfile));
              localStorage.setItem('lf_authorized', 'true');
              if (!localStorage.getItem('lf_trial_start')) {
                localStorage.setItem('lf_trial_start', nowStr);
                localStorage.setItem('lf_has_used_trial', 'true');
              }
              setPublicFunnelReportId(null);
              setIsAuthorized(true);
              window.history.replaceState({}, document.title, '/');
              showToast(t("¡Prueba de 7 Días Activada! Recupera tu primera oportunidad sin coste.", "7-Day Trial Activated! Recover your first opportunity at zero cost."), "success");
            }}
            onNavigateHome={() => {
              setPublicFunnelReportId(null);
              window.history.replaceState({}, document.title, '/');
            }}
            showToast={showToast}
          />
        </div>
      </React.Suspense>
    );
  }

  if (publicSnapshotMode) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicSnapshotView
            language={language}
            setLanguage={setLanguage}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            t={t}
            showToast={showToast}
            onGoToSignup={(refId) => {
              setPublicSnapshotMode(false);
              if (refId) localStorage.setItem('bvelt_referred_by', refId);
              window.history.replaceState({}, document.title, '/?register=true');
            }}
          />
        </div>
      </React.Suspense>
    );
  }

  if (publicAboutMode) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <AboutPage 
            onNavigateHome={() => {
              setPublicAboutMode(false);
              window.history.pushState({}, document.title, '/');
            }} 
          />
        </div>
      </React.Suspense>
    );
  }

  if (publicVerifiedEntityId) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicVerifiedRecordPage 
          entityId={publicVerifiedEntityId} 
          lang={language}
          onNavigateHome={() => {
            setPublicVerifiedEntityId(null);
            window.history.replaceState({}, document.title, '/');
          }}
          onNavigateAudit={() => {
            setPublicVerifiedEntityId(null);
            setPublicAuditMode(true);
            window.history.replaceState({}, document.title, '/free-audit');
          }}
        />
        </div>
      </React.Suspense>
    );
  }

  if (publicAuditMode) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicFreeAuditPage 
          language={language}
          setLanguage={setLanguage}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          t={t}
          isFirebaseReady={isFirebaseReady}
          showToast={showToast}
          onGoToLogin={() => {
            setPublicAuditMode(false);
            window.history.replaceState({}, document.title, '/');
          }}
          onActivateTrial={(bizData) => {
            const nowStr = new Date().toISOString();
            const newProfile = { 
              ...profile, 
              name: bizData.name || 'Your Business', 
              location: bizData.location || 'Your Area', 
              category: bizData.category || 'Local Services',
              plan: 'trial',
              subscriptionStatus: 'trialing',
              hasUsedTrial: true,
              trialStartDate: nowStr
            };
            setProfile(newProfile);
            localStorage.setItem('lf_profile', JSON.stringify(newProfile));
            localStorage.setItem('user_profile', JSON.stringify(newProfile));
            localStorage.setItem('lf_authorized', 'true');
            if (!localStorage.getItem('lf_trial_start')) {
              localStorage.setItem('lf_trial_start', nowStr);
              localStorage.setItem('lf_has_used_trial', 'true');
            }
            trackBveltEvent('trial_activated', { niche: bizData.category, location: bizData.location });
            setPublicAuditMode(false);
            setIsAuthorized(true);
            window.history.replaceState({}, document.title, '/');
            showToast(t("¡Diagnóstico Activado! Prueba de 7 Días Iniciada con Éxito.", "Diagnosis Activated! 7-Day Free Trial Started."), "success");
          }}
        />
        </div>
      </React.Suspense>
    );
  }

  if (publicRateId) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <ReputationShieldPage 
            businessId={publicRateId} 
            db={db} 
            isFirebaseReady={isFirebaseReady} 
            language={language}
            t={t}
            customGeminiKey={customGeminiKey}
            showToast={showToast}
          />
        </div>
      </React.Suspense>
    );
  }

  if (publicTemplateSlug) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicTemplatePage 
            slug={publicTemplateSlug} 
            onGetStarted={() => {
              window.location.href = '/';
            }}
          />
        </div>
      </React.Suspense>
    );
  }

  if (publicSiteId) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicLandingPage 
            businessId={publicSiteId} 
            db={db} 
            isFirebaseReady={isFirebaseReady} 
            language={language}
            setLanguage={setLanguage}
            t={t}
          />
        </div>
      </React.Suspense>
    );
  }

  if (!isAuthorized && !isLoggedOut) {
    return (
      <React.Suspense fallback={<ViewLoadingFallback />}>
        <div className="w-full h-screen overflow-y-auto scroll-smooth">
          <PublicLandingPage 
            db={db} 
            isFirebaseReady={isFirebaseReady} 
            language={language}
            setLanguage={setLanguage}
            t={t}
          onGetStarted={(bizData) => {
            const nowStr = new Date().toISOString();
            const newProfile = { 
              ...profile, 
              name: bizData.name || 'Your Business', 
              location: bizData.location || 'Your Area', 
              category: bizData.category || 'Local Services',
              plan: 'trial',
              subscriptionStatus: 'trialing',
              hasUsedTrial: true,
              trialStartDate: nowStr
            };
            setProfile(newProfile);
            localStorage.setItem('lf_profile', JSON.stringify(newProfile));
            localStorage.setItem('user_profile', JSON.stringify(newProfile));
            localStorage.setItem('lf_authorized', 'true');
            if (!localStorage.getItem('lf_trial_start')) {
              localStorage.setItem('lf_trial_start', nowStr);
              localStorage.setItem('lf_has_used_trial', 'true');
            }
            trackBveltEvent('trial_activated', { niche: bizData.category, location: bizData.location });
            setIsAuthorized(true);
            showToast(t("¡Diagnóstico Activado! Prueba de 7 Días Iniciada con Éxito.", "Diagnosis Activated! 7-Day Free Trial Started."), "success");
          }}
          onLoginWithGoogle={async () => {
            try {
              const loggedUser = await loginWithGoogle();
              if (loggedUser) {
                setUser(loggedUser);
                localStorage.setItem('lf_authorized', 'true');
                setIsAuthorized(true);
              } else {
                showToast(t("No se pudo iniciar sesión con Google.", "Failed to sign in with Google."), "error");
              }
            } catch (e: any) {
              console.error("Error al acceder con Google:", e?.code || 'AUTH_ERROR');
              const msg = getHumanAuthErrorMessage(e, language);
              showToast(msg, e?.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
            }
          }}
          onExploreDemo={ () => {
            const defaultProfile = { ...profile, name: 'Apex Air Solutions', location: 'Austin, TX', category: 'HVAC & Cooling' };
            setProfile(defaultProfile);
            localStorage.setItem('lf_profile', JSON.stringify(defaultProfile));
            localStorage.setItem('user_profile', JSON.stringify(defaultProfile));
            localStorage.setItem('lf_authorized', 'true');
            setIsAuthorized(true);
            showToast(t("¡Dashboard de Demostración cargado!", "Demo dashboard loaded!"), "success");
          }}
        />
        </div>
      </React.Suspense>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-background text-foreground ${isDarkMode ? 'dark' : ''} antialiased selection:bg-purple-500/30 transition-colors duration-300`}>
      
      {/* Stripe Verification Overlay */}
      {isVerifyingSubscription && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex justify-center">
              <RefreshCw className="animate-spin text-indigo-600 dark:text-purple-400" size={40} />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">
              {t("Verificando suscripción...", "Verifying subscription...")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("Estamos confirmando tu pago con Stripe. Por favor, no cierres esta ventana.", "We are confirming your payment with Stripe. Please do not close this window.")}
            </p>
          </div>
        </div>
      )}

      {/* Voice Assistant Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full relative space-y-4 text-left">
            <button
              onClick={() => {
                setShowVoiceModal(false);
                if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl transition-all ${
                voiceState === 'listening'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : voiceState === 'error'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              }`}>
                {voiceState === 'listening' ? (
                  <Mic size={24} className="animate-bounce" />
                ) : voiceState === 'processing' ? (
                  <RefreshCw size={24} className="animate-spin" />
                ) : voiceState === 'error' ? (
                  <AlertTriangle size={24} />
                ) : (
                  <Mic size={24} />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {voiceState === 'listening' ? t("Escuchando...", "Listening...") :
                   voiceState === 'processing' ? t("Procesando...", "Processing...") :
                   voiceState === 'error' ? t("Error de Voz", "Voice Error") :
                   t("Asistente de Voz", "Voice Assistant")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {voiceState === 'listening' ? t("Habla claro con tu comando o pregunta", "Speak clearly with your command or question") : t("Director de Ruta Bvelt", "Bvelt Route Director")}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 min-h-[80px] whitespace-pre-line leading-relaxed">
              {voiceState === 'listening' ? (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>{t("Capturando tu voz en tiempo real...", "Capturing your voice in real time...")}</span>
                </div>
              ) : voiceState === 'processing' ? (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>{t("Analizando comando e iniciando acción...", "Analyzing command and starting action...")}</span>
                </div>
              ) : (
                voiceCommandResult || t("Listo para tu comando", "Ready for your command")
              )}
            </div>

            {/* Quick Helper Tip in field */}
            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
              {t("💡 Di 'Ayuda' para escuchar la lista de comandos rápidos.", "💡 Say 'Help' to list quick field commands.")}
            </div>
          </div>
        </div>
      )}

      {/* High-End Status Bar (Desktop Only) */}
      <div className="hidden lg:flex fixed top-0 right-0 left-64 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent z-[60] opacity-50"></div>
      
      {/* Scroll-to-Top FAB */}
      <ScrollToTopButton />

      {/* Global Floating Voice Assistant FAB */}
      <button
        onClick={startVoiceAssistant}
        aria-label={t("Asistente por Voz", "Voice Assistant")}
        title={t("Asistente por Voz", "Voice Assistant")}
        className={`fixed ${shouldShowStickyCta ? 'bottom-[calc(138px+env(safe-area-inset-bottom))]' : 'bottom-[calc(76px+env(safe-area-inset-bottom))]'} right-4 lg:bottom-6 lg:right-6 z-[80] w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 group ${
          voiceState === 'listening'
            ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-rose-600/40 animate-pulse'
            : voiceState === 'processing'
            ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-amber-600/40'
            : voiceState === 'error'
            ? 'bg-gradient-to-tr from-slate-700 to-slate-600 text-white shadow-slate-600/40'
            : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/40'
        }`}
      >
        {voiceState === 'listening' ? (
          <Mic size={22} className="animate-bounce text-white" />
        ) : voiceState === 'processing' ? (
          <RefreshCw size={22} className="animate-spin text-amber-100" />
        ) : voiceState === 'error' ? (
          <AlertTriangle size={22} className="text-rose-200" />
        ) : (
          <Mic size={22} className="text-white group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Sticky Primary CTA (Mobile Thumb-Zone when Tasks Pending) */}
      {shouldShowStickyCta && (
        <div className="fixed bottom-[calc(66px+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-3 pb-1 pointer-events-none">
          <div className="max-w-lg mx-auto bg-slate-900/95 dark:bg-slate-900/95 text-white p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-indigo-500/30 backdrop-blur-xl flex items-center justify-between gap-2.5 pointer-events-auto animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Zap size={16} className="text-amber-400 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300">
                    {t("ACCIÓN PRIORITARIA", "PRIORITY ACTION")}
                  </span>
                  {pendingPrimaryTask.badge && (
                    <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                      {pendingPrimaryTask.badge}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-white truncate leading-tight mt-0.5">
                  {pendingPrimaryTask.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleExecutePriorityAction}
                className="px-3.5 py-2 min-h-[44px] bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center gap-1 cursor-pointer"
              >
                <span>{pendingPrimaryTask.actionLabel}</span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={handleDismissPriorityAction}
                aria-label={t("Cerrar", "Dismiss")}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bvelt Short Mobile Onboarding Wizard Modal */}
      {showOnboarding && (
        <React.Suspense fallback={null}>
          <BveltOnboardingWizard
            isOpen={showOnboarding}
            onClose={() => setShowOnboarding(false)}
            onComplete={handleCompleteOnboarding}
            initialData={{
              name: profile.name,
              category: profile.category || profile.niche,
              city: profile.city,
              email: profile.email || user?.email || '',
              phone: profile.phone,
              address: profile.address,
              marketRadius: profile.marketRadius || 5
            }}
            userEmail={user?.email || profile.email || ''}
            userName={user?.displayName || profile.name || ''}
            t={t}
            language={language}
            setLanguage={setLanguage}
            showToast={showToast}
            onGoToPlans={() => { setShowOnboarding(false); setActiveTab('plans'); }}
            onStartTrial={activateTrial}
            hasUsedTrial={hasUsedTrial}
          />
        </React.Suspense>
      )}

      {/* Fixed Mobile Bottom Navigation Bar: Home | Actions | Leads | More */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#080b11]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 px-3 grid grid-cols-4 items-center shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
          {/* 1. Home */}
          <button 
             onClick={handleHomeClick}
             className={`flex flex-col items-center justify-center py-1 min-h-[48px] transition-colors rounded-xl ${activeTab === 'dashboard' && selectedMobileView === 'tab' ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/60 dark:bg-indigo-950/40' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
             <Home size={20} className={activeTab === 'dashboard' && selectedMobileView === 'tab' ? 'stroke-[2.5]' : 'stroke-2'} />
             <span className="text-[10px] font-bold tracking-tight mt-1">{t("Inicio", "Home")}</span>
          </button>

          {/* 2. Actions */}
          <button 
             onClick={() => { setActiveTab('action_center'); setSelectedMobileView('tab'); setActiveSection('action_center'); }}
             className={`flex flex-col items-center justify-center py-1 min-h-[48px] transition-colors rounded-xl ${(activeTab === 'action_center' || activeTab === 'growth') && selectedMobileView === 'tab' ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/60 dark:bg-indigo-950/40' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
             <Zap size={20} className={(activeTab === 'action_center' || activeTab === 'growth') && selectedMobileView === 'tab' ? 'stroke-[2.5] text-amber-500' : 'stroke-2'} />
             <span className="text-[10px] font-bold tracking-tight mt-1">{t("Acciones", "Actions")}</span>
          </button>

          {/* 3. Leads */}
          <button 
             onClick={() => { setActiveTab('leads'); setSelectedMobileView('tab'); setActiveSection('leads'); }}
             className={`flex flex-col items-center justify-center py-1 min-h-[48px] transition-colors rounded-xl relative ${activeTab === 'leads' && selectedMobileView === 'tab' ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/60 dark:bg-indigo-950/40' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
             <div className="relative">
               <Filter size={20} className={(activeTab === 'leads') && selectedMobileView === 'tab' ? 'stroke-[2.5]' : 'stroke-2'} />
               {pendingLeadsCount > 0 && (
                 <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center px-0.5">
                   {pendingLeadsCount}
                 </span>
               )}
             </div>
             <span className="text-[10px] font-bold tracking-tight mt-1">{t("Leads", "Leads")}</span>
          </button>

          {/* 4. More */}
          <button 
             onClick={() => { setSelectedMobileView('menu'); setShowQuickAction(false); }}
             className={`flex flex-col items-center justify-center py-1 min-h-[48px] transition-colors rounded-xl ${selectedMobileView === 'menu' ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/60 dark:bg-indigo-950/40' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
             <Menu size={20} className={selectedMobileView === 'menu' ? 'stroke-[2.5]' : 'stroke-2'} />
             <span className="text-[10px] font-bold tracking-tight mt-1">{t("Más", "More")}</span>
          </button>
        </div>
      )}

      {/* Trial Overlay */}
      <AnimatePresence>
        {isTrialLocked && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/95 dark:bg-slate-950/98 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-gradient-to-tr from-rose-600 to-red-500 p-4 rounded-2xl text-white shadow-xl shadow-red-500/20 mb-6">
              <Lock size={48} />
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-red-600 dark:from-red-400 to-rose-600 dark:to-rose-400 bg-clip-text text-transparent mb-2">{t("Tu Prueba Premium de 7 Días Expiró", "7-Day Premium Trial Ended")}</h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm mb-6 leading-relaxed">Tu período de prueba premium ha expirado. Activa tu plan profesional.</p>
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl mb-6 w-full max-w-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">{t('Identificador del Dispositivo', 'Device Identifier')}</span>
              <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">BVELT-PREM-{streak}-X42</span>
            </div>
            <button onClick={() => { setIsTrialLocked(false); setActiveTab('plans'); }} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-12 rounded-xl transition">{t('Ver Planes', 'View Plans')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`w-full lg:w-64 lg:shrink-0 bg-white dark:bg-[#080b11] border-r border-slate-200 dark:border-slate-800 p-5 h-full overflow-y-auto flex flex-col transition-colors duration-300 ${isMobile && selectedMobileView !== 'menu' ? 'hidden lg:flex' : 'flex pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-12'}`}>
        <div className="space-y-6 flex-1">
          {isMobile && (
            <button 
              onClick={handleGoBack}
              className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 py-3.5 px-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft size={16} />
              {t("Volver", "Back")}
            </button>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <AppIcon className="w-8 h-8 shadow-md rounded-lg" />
              <div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 dark:from-indigo-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">Bvelt</h1>
                <div className="flex flex-col items-start gap-1">
                  {hasActivatedTrial && getTrialDaysRemaining() > 0 ? (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                      {t("Prueba: Activa", "Trial: Active")} ({getTrialDaysRemaining()}d)
                    </span>
                  ) : hasUsedTrial ? (
                    <span 
                      onClick={() => setActiveTab('plans')}
                      className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 tracking-widest uppercase bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900/40 cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900 transition"
                    >
                      {t("Planes Pro", "Pro Plans")}
                    </span>
                  ) : (
                    <span 
                      onClick={() => setShowProModal(true)}
                      className="text-[9px] font-bold text-amber-600 dark:text-amber-400 tracking-widest uppercase bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/40 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900 transition"
                    >
                      {t("Activar Prueba", "Activate Trial")}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Trophy size={12} className="text-amber-500" />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{realTrustScore} {t("Confianza", "Trust")}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Language Switcher in Sidebar */}
            <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 text-[10px] font-black shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  localStorage.setItem('lf_lang', 'en');
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('es');
                  localStorage.setItem('lf_lang', 'es');
                }}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  language === 'es'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                aria-label="Cambiar a Español"
              >
                ES
              </button>
            </div>
          </div>

          {/* Mini Profile */}
          <div onClick={() => setActiveTab('profile')} className="group bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-900 transition-all active:scale-[0.98]">
            <div className="relative">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-10 h-10 rounded-xl shadow-md border border-slate-200 dark:border-slate-800" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md">
                  <User2 size={16} />
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user?.displayName || profile.name || "Tu Negocio"}</h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck size={8} /> GMB
                </span>
                <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tighter bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                  <Globe size={8} /> WEB
                </span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block mt-1 flex items-center gap-1">
                <MapPin size={8} className="text-rose-500 dark:text-rose-400" /> {profile.location || "Configurar"}
              </span>
            </div>
            <div className="text-slate-400 group-hover:text-indigo-500 transition-colors">
              <Settings size={16} />
            </div>
          </div>

          {/* PWA Install Button (Desktop Sidebar) */}
          <div className="hidden lg:block pt-1">
            <PWAInstallButton lang={language === 'en' ? 'en' : 'es'} variant="outline" className="w-full justify-center text-xs" />
          </div>

          {/* Streak & Settings */}
          <div className="space-y-3">
            {isOffline && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 text-amber-700 dark:text-amber-400 space-y-1 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider">{t("MODO OFFLINE ACTIVO", "OFFLINE MODE ACTIVE")}</span>
                </div>
                <p className="text-[9px] font-bold leading-normal text-slate-600 dark:text-slate-400">
                  {t("Estás operando con conectividad limitada. Bvelt guarda tus leads y transacciones automáticamente en la caché local para subirlos en cuanto recuperes señal.", "Operating with limited connectivity. Bvelt saves your leads and transactions securely in your local cache, and will synchronize with Firestore as soon as signal returns.")}
                </p>
              </div>
            )}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Gem size={40} />
              </div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1 block">{t('Oportunidad Estimada', 'Estimated Opportunity')}</span>
                  <div className="text-2xl font-black text-white leading-none">
                    {realProImpact > 0 ? `$${realProImpact.toLocaleString()}` : '$0'}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-[9px] text-white/50 font-bold uppercase tracking-tighter flex items-center gap-1">
                      <Zap size={8} className="text-amber-400" /> {t('Leads Activos:', 'Active Leads:')} <span className="text-white">
                        {(() => {
                          const activeCount = leads.filter(l => isBusinessLead(l, profile) && l.status !== 'LOST' && l.status !== 'ARCHIVED').length;
                          return activeCount > 0 ? `+${activeCount}` : '0';
                        })()}
                      </span>
                    </p>
                    <p className="text-[9px] text-white/50 font-bold uppercase tracking-tighter flex items-center gap-1">
                      <Activity size={8} className="text-emerald-400" /> {t('Conversión:', 'Conversion:')} <span className="text-white">{(() => {
                        const bizLeads = leads.filter(l => isBusinessLead(l, profile));
                        if (bizLeads.length === 0) return t('0.0% (Sin datos)', '0.0% (No data)');
                        const wonCount = bizLeads.filter(l => l.status === 'WON' || l.status === 'PAID' || l.status === 'ganado').length;
                        return `${((wonCount / bizLeads.length) * 100).toFixed(1)}%`;
                      })()}</span>
                    </p>
                  </div>
                </div>
                
                {/* Mini Sparkline SVG */}
                <div className="flex flex-col items-end gap-2">
                  <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M0,35 L10,32 L20,38 L30,25 L40,28 L50,15 L60,18 L70,5 L80,12 L90,2 L100,8" />
                  </svg>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                    {realProImpact > 0 ? `$${realProImpact.toLocaleString()}` : t('DERIVADO', 'DERIVED')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Flame size={12} className="text-amber-500" /> 
                  {t("Racha Actual", "Current Streak")}
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{streak}</div>
              </div>
              
              {/* Day Tracker */}
              <div className="flex items-center justify-between gap-1">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                  const isPast = idx < (streak % 7 || 7);
                  const isToday = idx === (new Date().getDay() + 6) % 7;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${isPast ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-slate-200 dark:bg-slate-800'} ${isToday ? 'animate-pulse scale-y-125' : ''}`} />
                      <span className={`text-[8px] font-black ${isToday ? 'text-amber-500' : 'text-slate-400'}`}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-900/40 p-2 rounded-xl flex items-center justify-end border border-slate-200 dark:border-slate-800">
               <div className="flex items-center gap-2">
                 {isOffline && (
                    <div className="w-6 h-6 flex items-center justify-center bg-amber-500/20 text-amber-500 rounded-lg animate-pulse" title={t("Modo Offline", "Offline Mode")}>
                      <CloudRain size={10} />
                    </div>
                 )}
                 <button aria-label={t("Cambiar tema", "Toggle theme")} onClick={() => setIsDarkMode(!isDarkMode)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-transparent">
                   {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
                 </button>
               </div>
            </div>
          </div>

          <nav className="flex flex-col gap-3 relative z-10">
                {/* 1. PRINCIPAL / HOME */}
                {enabledTabs.dashboard && (
                  <NavLink 
                    icon={<Home size={18} />} 
                    label={t("Resumen / Inicio", "Dashboard")} 
                    active={activeTab === 'dashboard'} 
                    onClick={() => { setActiveTab('dashboard'); setSelectedMobileView('tab'); }} 
                    color="text-indigo-500" 
                  />
                )}

                {/* 2. MARKET */}
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('market')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Store size={14} className="text-indigo-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Mercado", "Market")}
                      </span>
                    </div>
                    {collapsedNavSections.market ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.market && (
                    <div className="space-y-0.5">
                      {enabledTabs.business_scan && (
                        <NavLink 
                          icon={<Search size={18} />} 
                          label={t("Escaneo de Clientes Perdidos", "Lost Customer Scan")} 
                          active={activeTab === 'business_scan'} 
                          onClick={() => { setActiveTab('business_scan'); setSelectedMobileView('tab'); }} 
                          color="text-violet-500" 
                        />
                      )}
                      <NavLink 
                        icon={<MapIcon size={18} />} 
                        label={t("Mapa de Competidores", "Competitor Map")} 
                        active={false} 
                        onClick={() => { 
                          setActiveTab('dashboard'); 
                          setSelectedMobileView('tab');
                          window.dispatchEvent(new CustomEvent('bvelt_expand_map'));
                        }} 
                        color="text-indigo-400" 
                      />
                      {enabledTabs.estimator && (
                        <NavLink 
                          icon={<Camera size={18} />} 
                          label={t("Estimador Visual Espacial", "Visual Spatial Estimator")} 
                          active={activeTab === 'estimator'} 
                          onClick={() => { setActiveTab('estimator'); setSelectedMobileView('tab'); }} 
                          color="text-cyan-400" 
                        />
                      )}
                      {enabledTabs.tools && (
                        <NavLink 
                          icon={<Flame size={18} />} 
                          label={t("Fuga de Demanda Local", "Local Demand Leakage")} 
                          active={activeTab === 'tools' && activeSubRow === 0} 
                          onClick={() => { setActiveTab('tools'); setActiveSubRow(0); setSelectedMobileView('tab'); }} 
                          color="text-rose-500" 
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* 3. LEADS & CRM */}
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('leads')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Leads & CRM", "Leads & CRM")}
                      </span>
                    </div>
                    {collapsedNavSections.leads ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.leads && enabledTabs.leads && (
                    <div className="space-y-0.5">
                      <NavLink 
                        icon={<Filter size={18} />} 
                        label={t("Bandeja & CRM Leads", "Leads & CRM Inbox")} 
                        active={activeTab === 'leads' && activeSubRow !== 1 && activeSubRow !== 5} 
                        onClick={() => { setActiveTab('leads'); setActiveSubRow(4); setSelectedMobileView('tab'); }} 
                        color="text-emerald-400" 
                      />
                      <NavLink 
                        icon={<Zap size={18} />} 
                        label={t("Radar de Prospección", "Prospecting Radar")} 
                        active={activeTab === 'leads' && activeSubRow === 1} 
                        onClick={() => { setActiveTab('leads'); setActiveSubRow(1); setSelectedMobileView('tab'); }} 
                        color="text-amber-400" 
                      />
                      <NavLink 
                        icon={<Users size={18} />} 
                        label={t("Reactivación & Retención", "Reactivation & Retention")} 
                        active={activeTab === 'leads' && activeSubRow === 5} 
                        onClick={() => { setActiveTab('leads'); setActiveSubRow(5); setSelectedMobileView('tab'); }} 
                        color="text-indigo-400" 
                      />
                       {isFounderOrAdmin && (
                         <NavLink 
                           icon={<Sparkles size={18} />} 
                           label={t("Operador / Informes", "Operator Funnel")} 
                           active={activeTab === 'leads' && activeSubRow === 6} 
                           onClick={() => { setActiveTab('leads'); setActiveSubRow(6); setSelectedMobileView('tab'); }} 
                           color="text-purple-400" 
                         />
                       )}
                     </div>
                   )}
                  </div>
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('growth')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Crecimiento", "Growth")}
                      </span>
                    </div>
                    {collapsedNavSections.growth ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.growth && (
                    <div className="space-y-0.5">
                      {enabledTabs.reviews && (
                        <NavLink 
                          icon={<Star size={18} />} 
                          label={t("Reseñas de Google", "Google Reviews")} 
                          active={activeTab === 'reviews'} 
                          onClick={() => { setActiveTab('reviews'); setSelectedMobileView('tab'); }} 
                          color="text-amber-500" 
                        />
                      )}
                      {enabledTabs.social && (
                        <NavLink 
                          icon={<ImageIcon size={18} />} 
                          label={t("Anuncios y Ads", "Ads & Marketing")} 
                          active={activeTab === 'social'} 
                          onClick={() => { setActiveTab('social'); setSelectedMobileView('tab'); }} 
                          color="text-purple-400" 
                        />
                      )}
                      {enabledTabs.growth && (
                        <NavLink 
                          icon={<ChartLine size={18} />} 
                          label={t("SEO Local & Growth", "Local SEO & Growth")} 
                          active={activeTab === 'growth'} 
                          onClick={() => { setActiveTab('growth'); setSelectedMobileView('tab'); }} 
                          color="text-cyan-400" 
                        />
                      )}
                      {enabledTabs.action_center && (
                        <NavLink 
                          icon={<Zap size={18} />} 
                          label={t("Centro de Acciones", "Action Center")} 
                          active={activeTab === 'action_center'} 
                          onClick={() => { setActiveTab('action_center'); setSelectedMobileView('tab'); }} 
                          color="text-indigo-400" 
                        />
                      )}
                      {enabledTabs.website && (
                        <NavLink 
                          icon={<Globe size={18} />} 
                          label={t("Mi Sitio Web", "My Website")} 
                          active={activeTab === 'website'} 
                          onClick={() => { setActiveTab('website'); setSelectedMobileView('tab'); }} 
                          color="text-sky-400" 
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* 5. EXECUTE */}
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('execute')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-rose-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Ejecución", "Execute")}
                      </span>
                    </div>
                    {collapsedNavSections.execute ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.execute && (
                    <div className="space-y-0.5">
                      {enabledTabs.eod && (
                        <NavLink 
                          icon={<CheckCircle size={18} />} 
                          label={t("Cierre Diario (EOD)", "Daily EOD")} 
                          active={activeTab === 'eod'} 
                          onClick={() => { setActiveTab('eod'); setSelectedMobileView('tab'); }} 
                          color="text-yellow-500" 
                        />
                      )}
                      {enabledTabs.pricing && (
                        <NavLink 
                          icon={<Calculator size={18} />} 
                          label={t("Calculadora de Precios", "Pricing Calculator")} 
                          active={activeTab === 'pricing'} 
                          onClick={() => { setActiveTab('pricing'); setSelectedMobileView('tab'); }} 
                          color="text-rose-400" 
                        />
                      )}
                      {enabledTabs.tools && (
                        <NavLink 
                          icon={<Briefcase size={18} />} 
                          label={t("Herramientas de Negocio", "Business Tools")} 
                          active={activeTab === 'tools' && activeSubRow !== 0} 
                          onClick={() => { setActiveTab('tools'); if (activeSubRow === 0) setActiveSubRow(1); setSelectedMobileView('tab'); }} 
                          color="text-orange-400" 
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* 6. CHANNELS & AUTOMATIONS */}
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('channels')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <MessageCircle size={14} className="text-sky-500 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Canales & Automatización", "Channels & Automation")}
                      </span>
                    </div>
                    {collapsedNavSections.channels ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.channels && (
                    <div className="space-y-0.5">
                      <NavLink 
                        icon={<MessageCircle size={18} />} 
                        label={t("WhatsApp Business", "WhatsApp Business")} 
                        active={false} 
                        onClick={() => { 
                          showToast(t("Canal WhatsApp: No configurado. (Aplazado)", "WhatsApp Channel: Not configured. (Deferred)"), "info");
                        }} 
                        color="text-emerald-500" 
                        badge={t("No configurado", "Not configured")}
                        badgeColor="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                      />
                      <NavLink 
                        icon={<Smartphone size={18} />} 
                        label={t("Alertas SMS", "SMS Alerts")} 
                        active={false} 
                        onClick={() => { 
                          showToast(t("Alertas SMS: No configurado.", "SMS Alerts: Not configured."), "info");
                        }} 
                        color="text-sky-400" 
                        badge={t("No configurado", "Not configured")}
                        badgeColor="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                      />
                    </div>
                  )}
                </div>

                {/* 7. ACCOUNT */}
                <div className="space-y-1 pt-1">
                  <button 
                    type="button"
                    onClick={() => toggleNavSection('account')}
                    className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={14} className="text-slate-400 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        {t("Cuenta & Ajustes", "Account & Settings")}
                      </span>
                    </div>
                    {collapsedNavSections.account ? (
                      <ChevronRight size={12} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400" />
                    )}
                  </button>
                  {!collapsedNavSections.account && (
                    <div className="space-y-0.5">
                      {enabledTabs.accounting && (
                        <NavLink 
                          icon={<FileText size={18} />} 
                          label={t("Cuentas y Finanzas", "Finances")} 
                          active={activeTab === 'accounting'} 
                          onClick={() => { setActiveTab('accounting'); setSelectedMobileView('tab'); }} 
                          color="text-emerald-400" 
                        />
                      )}
                      {enabledTabs.plans && (
                        <NavLink 
                          icon={<Gem size={18} />} 
                          label={t("Planes Premium", "Pro Plans")} 
                          active={activeTab === 'plans'} 
                          onClick={() => { setActiveTab('plans'); setSelectedMobileView('tab'); }} 
                          color="text-amber-400" 
                        />
                      )}
                      {enabledTabs.profile && (
                        <NavLink 
                          icon={<Settings size={18} />} 
                          label={t("Negocio & Perfil", "Business Profile")} 
                          active={activeTab === 'profile'} 
                          onClick={() => { setActiveTab('profile'); setSelectedMobileView('tab'); }} 
                          color="text-slate-400" 
                        />
                      )}
                    </div>
                  )}
                </div>
              </nav>

              <div className="pt-4 px-2">
                <a 
                  href="/about" 
                  onClick={(e) => {
                    e.preventDefault();
                    setPublicAboutMode(true);
                    window.history.pushState({}, document.title, '/about');
                  }}
                  className="text-[11px] font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>{t("Sobre el creador", "About the creator")}</span>
                </a>
              </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800/60 space-y-3">

          {isCreatorMode && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Bolt size={18} className="text-slate-500" />
                 </div>
                 <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">{t("Consola técnica", "Technical console")}</h4>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">{t("Estado de subsistemas", "Subsystem status")}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={testAiHealth} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 hover:border-indigo-500/50 transition">
                    <CloudRain size={16} className={aiStatus === 'online' ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{t("Test Motor", "Test Motor")}</span>
                 </button>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 hover:border-rose-500/50 transition">
                    <Trash2 size={16} className="text-rose-500" />
                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{t("Hard Reset", "Hard Reset")}</span>
                 </button>
              </div>

              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-[2rem] space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${aiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{t("Conexión del Negocio", "Business sync")}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">{aiStatus === 'online' ? t('⚡ Sincronizado', '⚡ Synchronized') : t('Error de Enlace', 'Link Error')}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-500 font-bold">🔒 Secure</span>
                 </div>
                 
                 <div className="space-y-1.5">
                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                       <span>{t("Estatus de Seguridad", "Security Status")}</span>
                       <span>{t("PROTEGIDO", "EMCRYPTED")}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                       <div className="w-[100%] h-full bg-emerald-500"></div>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 h-full overflow-y-auto p-4 lg:p-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-12 max-w-7xl mx-auto w-full ${isMobile && selectedMobileView === 'menu' ? 'hidden lg:block' : 'block'}`}>
        
        {/* PWA Offline & Background Sync Indicator */}
        <OfflineIndicatorBanner lang={language === 'en' ? 'en' : 'es'} />

        {/* PWA Install Banner */}
        <PWAInstallBanner lang={language === 'en' ? 'en' : 'es'} />

        {/* Firebase Quota Exceeded Alert Banner */}
        {isQuotaExceeded && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fade-in text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl mt-0.5 md:mt-0">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-red-800 dark:text-red-300">
                  {t("¡Cuota Diaria de Base de Datos Excedida!", "Daily Database Quota Exceeded!")}
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                  {t(
                    "Se ha alcanzado el límite diario de la cuota gratuita de Firebase Firestore (Plan Spark). La aplicación continuará funcionando en modo local/desconectado guardando tus cambios de manera segura en tu navegador. Esta cuota se restablece de forma automática al comenzar el día siguiente.",
                    "The daily limit of the free Firebase Firestore quota (Spark Plan) has been reached. The application will continue to operate in offline/local mode, saving your changes securely in your browser. This quota resets automatically tomorrow."
                  )}
                </p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  <span>
                    {t("Más información en:", "Detailed quota information under Spark column in:")}{" "}
                    <a
                      href="https://firebase.google.com/pricing#cloud-firestore"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold hover:text-red-800 dark:hover:text-red-200"
                    >
                      firebase.google.com/pricing
                    </a>
                  </span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 w-full md:w-auto">
              <a
                href="https://console.firebase.google.com/project/localflowpro-20e3d/firestore/databases/(default)/data?openUpgradeDialog=true"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto text-center bg-red-600 hover:bg-red-500 dark:bg-red-900/50 dark:hover:bg-red-800/80 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm"
              >
                {t("Ver mi Base de Datos / Actualizar", "View Database / Upgrade")}
              </a>
            </div>
          </div>
        )}

        {/* Desktop Sticky Header with Back Button */}
        {!isMobile && historyStack.length > 1 && (
          <div className="sticky top-0 z-40 -mx-8 mb-6 px-8 py-3 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-sm animate-fade-in">
            <button 
              onClick={handleGoBack}
              className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 py-2 px-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
              <span>{t("Volver", "Back")}</span>
            </button>
            <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {getTabTitle(activeTab)}
            </div>
            <div className="w-24"></div>
          </div>
        )}

        {/* Mobile Sticky Top Header */}
        {isMobile && selectedMobileView === 'tab' && (
          <div className="sticky top-0 -mx-4 mb-6 px-4 py-3 z-40 flex items-center justify-between bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-900 shadow-sm animate-fade-in">
            <div className="flex-1 flex items-center gap-2 justify-start min-w-0">
              {historyStack.length > 1 ? (
                <button 
                  onClick={handleGoBack}
                  className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 py-1.5 px-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <ArrowLeft size={16} className="stroke-[2.5]" />
                  <span>{t("Volver", "Back")}</span>
                </button>
              ) : (
                <>
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || ""} 
                      className="w-10 h-10 rounded-full border-2 border-indigo-500 shadow-sm flex-shrink-0 cursor-pointer object-cover"
                      onClick={() => setActiveTab('profile')}
                    />
                  ) : (
                    <div 
                      onClick={() => setActiveTab('profile')}
                      className="w-10 h-10 rounded-full bg-[#242428] border border-[#3f3f46] flex items-center justify-center flex-shrink-0 cursor-pointer transition hover:opacity-80"
                    >
                      <svg className="w-5 h-5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-black text-[10px] tracking-tight text-slate-950 dark:text-white uppercase truncate">
                      {profile.name || "Bvelt"}
                    </span>
                    {user && (
                      <span className="text-[8px] text-slate-500 dark:text-slate-400 font-bold truncate">
                        {user.displayName}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="text-center flex-1">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                {activeTab === 'dashboard' ? t("Inicio", "Home") :
                 activeTab === 'business_scan' ? t("Business Scan", "Business Scan") :
                 activeTab === 'reviews' ? t("Reseñas", "Reviews") :
                 activeTab === 'social' ? t("Post Social", "Social Posts") :
                 activeTab === 'leads' ? t("CRM & Leads", "CRM & Leads") :
                 activeTab === 'estimator' ? t("Inspector Espacial", "Spatial Inspector") :
                 activeTab === 'pricing' ? t("Tarifas & Calculadora", "Pricing & Calc") :
                 activeTab === 'growth' ? t("SEO Local & Crecimiento", "Local SEO & Growth") :
                 activeTab === 'eod' ? t("Cierre Diario EOD", "Daily EOD") :
                 activeTab === 'tools' ? t("Herramientas", "Business Tools") :
                 activeTab === 'accounting' ? t("Cuentas & Finanzas", "Finances") :
                 activeTab === 'profile' ? t("Negocio & Perfil", "Business Profile") :
                 activeTab === 'website' ? t("Mi Sitio Web", "My Website") :
                 activeTab === 'ledger' ? t("Outcome Ledger", "Outcome Ledger") :
                 activeTab === 'plans' ? t("Suscripción & Planes", "Subscription & Plans") : activeTab}
              </span>
            </div>
            <div className="flex-1 flex justify-end items-center gap-1.5">
              <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 text-[10px] font-black shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    localStorage.setItem('lf_lang', 'en');
                  }}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-indigo-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  aria-label="Switch to English"
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('es');
                    localStorage.setItem('lf_lang', 'es');
                  }}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    language === 'es'
                      ? 'bg-indigo-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  aria-label="Cambiar a Español"
                >
                  ES
                </button>
              </div>
              <PWAInstallButton lang={language === 'en' ? 'en' : 'es'} variant="outline" className="text-[10px] py-1 px-2.5 border-indigo-500/30 text-indigo-400" />
              <button 
                onClick={() => { (hasActivatedTrial && getTrialDaysRemaining() > 0) || hasUsedTrial ? setActiveTab('plans') : setShowProModal(true); }} 
                className="text-[11px] font-bold tracking-wide bg-indigo-505/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full ring-1 ring-indigo-500/20 active:bg-indigo-500 active:text-white transition-colors"
              >
                {hasActivatedTrial && getTrialDaysRemaining() > 0 ? (
                  <>✨ {getTrialDaysRemaining()} {t("DÍAS DE PRUEBA", "TRIAL DAYS")}</>
                ) : hasUsedTrial ? (
                  <>⭐ {t("Ver Planes Pro", "View Pro Plans")}</>
                ) : (
                  <>🎁 {t("Probar Premium Gratis", "Try Premium Free")}</>
                )}
              </button>
            </div>
          </div>
        )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-[1400px] mx-auto px-1 md:px-6"
              >
                <React.Suspense fallback={<ViewLoadingFallback />}>
                {/* Sync Offline Status Banner */}
                {pendingMutationsCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm rounded-2xl mb-6 relative z-50 overflow-hidden"
                    title={t("Hay escrituras pendientes guardadas localmente en tu cola de IndexedDB.", "There are pending writes saved locally in your IndexedDB queue.")}
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold">
                        {t(
                          `Tienes ${pendingMutationsCount} cambio(s) guardado(s) offline.`,
                          `You have ${pendingMutationsCount} offline change(s) saved.`
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        syncPendingMutations();
                      }}
                      className="text-[10px] font-black uppercase tracking-wider bg-amber-200/60 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm border border-amber-300 dark:border-amber-800"
                    >
                      {t("Sincronizar ahora", "Sync Now")}
                    </button>
                  </motion.div>
                )}

                 {memoizedDashboardView}

                {activeTab === 'eod' && (
                  <section className="space-y-3 md:space-y-6 max-w-4xl mx-auto py-2 md:py-4 animate-fade-in">
                    <Header 
                      title={t("🌅 Cierre de Jornada Diaria", "🌅 Daily End of Day Wrap-up")} 
                      subtitle={t("Sincroniza tus logros locales, reclama tus Puntos de Confianza y genera tu reporte diario.", "Sync your local achievements, claim your Trust Points and generate your daily report.")} 
                    />
                    
                    {/* Immersive Sound & Audio Briefing Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-slate-900 dark:to-indigo-950 border border-indigo-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-xl relative overflow-hidden space-y-4 md:space-y-6">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 pb-4 md:pb-6 border-b border-indigo-100 dark:border-slate-800">
                        <div className="space-y-1 md:space-y-2">
                          <span className="text-[9px] md:text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{t("REPORTE SINTÉTICO ACTIVO", "ACTIVE SYNTHETIC REPORT")}</span>
                          <h3 className="text-base md:text-xl font-black text-slate-900 dark:text-white">{t("Escuchar Resumen Diario por Voz 🎙️", "Listen to Daily Voice Briefing 🎙️")}</h3>
                          <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 max-w-md">
                            {t("El sistema generó un resumen de audio interactivo sobre las métricas locales de hoy, reputación y conversión de clientes.", "The system generated an interactive audio summary of today's local metrics, reputation and client conversion.")}
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => {
                            if (eodPlaying) {
                              stopEodSynth();
                            } else {
                              startEodSynth();
                            }
                          }}
                          className={`w-full md:w-auto flex items-center justify-center gap-3 px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 ${eodPlaying ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-400/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
                        >
                          {eodPlaying ? (
                            <>
                              <Square size={14} fill="currentColor" />
                              {t("Pausar Audio", "Pause Audio")}
                            </>
                          ) : (
                            <>
                              <Play size={14} fill="currentColor" />
                              {t("Reproducir Audio", "Play Audio")}
                            </>
                          )}
                        </button>
                      </div>

                      {/* Waveform Visualization */}
                      {eodPlaying && (
                        <div className="bg-white dark:bg-slate-950/60 border border-indigo-100 dark:border-slate-800/80 p-3 md:p-4 rounded-2xl flex items-center justify-center gap-1 h-12 md:h-16 animate-pulse">
                          {eodWavOffset.map((height, idx) => (
                            <motion.div 
                              key={idx}
                              animate={{ height: isMobile ? height * 0.7 : height }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              className="w-1 bg-gradient-to-t from-indigo-600 via-indigo-400 to-emerald-400 rounded-full"
                              style={{ height: `${isMobile ? height * 0.7 : height}px` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Metrics Recap - Optimized to horizontal cols-3 on mobile to avoid scroll */}
                      <div className="grid grid-cols-3 gap-2 md:gap-4">
                        <div className="bg-white dark:bg-slate-950/40 border border-indigo-100 dark:border-slate-800/60 p-2 md:p-5 rounded-xl md:rounded-2xl text-center space-y-0.5 md:space-y-1 shadow-sm">
                          <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider truncate">{t("Reseñas", "Reviews")}</p>
                          <p className="text-base md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {localStorage.getItem('bvelt_reviews_replied') || localStorage.getItem('localflow_reviews_replied') || '0'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-slate-950/40 border border-indigo-100 dark:border-slate-800/60 p-2 md:p-5 rounded-xl md:rounded-2xl text-center space-y-0.5 md:space-y-1 shadow-sm">
                          <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider truncate">{t("Anuncios", "Posts")}</p>
                          <p className="text-base md:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            {localStorage.getItem('bvelt_posts_created') || localStorage.getItem('localflow_posts_created') || '0'}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-slate-950/40 border border-indigo-100 dark:border-slate-800/60 p-2 md:p-5 rounded-xl md:rounded-2xl text-center space-y-0.5 md:space-y-1 shadow-sm">
                          <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider truncate">{t("Precios", "Quotes")}</p>
                          <p className="text-base md:text-2xl font-black text-amber-600 dark:text-amber-400">
                            {localStorage.getItem('bvelt_quotes_sent') || localStorage.getItem('localflow_quotes_sent') || '0'}
                          </p>
                        </div>
                      </div>

                      {/* Main Big Gold Cierre Button */}
                      <div className="pt-2 md:pt-4 flex flex-col items-center justify-center text-center space-y-2 md:space-y-3">
                        <button 
                          onClick={() => {
                            const rAns = parseInt(localStorage.getItem('bvelt_reviews_replied') || localStorage.getItem('localflow_reviews_replied') || '0', 10);
                            const pCre = parseInt(localStorage.getItem('bvelt_posts_created') || localStorage.getItem('localflow_posts_created') || '0', 10);
                            const qSen = parseInt(localStorage.getItem('bvelt_quotes_sent') || localStorage.getItem('localflow_quotes_sent') || '0', 10);
                            
                            let points = rAns * 10 + pCre * 25 + qSen * 50;
                            if (points === 0) {
                              points = 85; 
                            }
                            setEodPoints(points);
                            setEodShowModal(true);
                            playEodCoinSound();
                          }}
                          className="w-full md:w-auto md:px-12 py-3.5 md:py-5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 text-slate-950 font-black rounded-xl md:rounded-2xl text-xs uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all shadow-xl shadow-yellow-500/10 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Zap size={14} className="fill-current" />
                          {t("Sincronizar y Cerrar Jornada Diaria", "Sync & Close Daily Business Day")}
                        </button>
                        <p className="text-[8px] md:text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                          {t("Sincronización segura con Google Business", "Secure synchronization with Google Business")}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === 'tools' && (
                  <div className="space-y-12">
                    <Header 
                      title={t("Herramientas de Marketing Local", "Local Marketing Tools")} 
                      subtitle={t("Aceleradores visuales y de proximidad para tu negocio.", "Visual and proximity accelerators for your business.")} 
                    />
                    
                    {renderSubTabs([
                      t("Simular Crecimiento", "Simulate Growth"),
                      t("Sello Visual GMB", "GMB Visual Seal"),
                      t("Vecindarios VIP", "VIP Neighborhoods"),
                      t("Auditoría Ficha Maps", "GBP Audit Checklist"),
                      t("Fotos de Campo PWA", "Field Proof Photos PWA")
                    ])}

                    <div className="pt-4">
                      {activeSubRow === 0 && (
                        <MarketGrowthView 
                          location={profile.location} 
                          niche={profile.category || profile.niche || 'Servicios Generales'} 
                          t={t} 
                          onActivatePro={() => setActiveTab('plans')}
                          onSaveGrowthAnalysis={(revenue) => {
                            // Update local state
                            setGrowthStats(curr => ({ ...curr, roi: curr.roi + revenue }));
                            setProfile(p => ({ ...p, lastBattleRevenue: revenue, lastGrowthRevenue: revenue }));
                            
                            // Save to Firestore if user is logged in
                            if (user) {
                              const profileRef = doc(db, 'profiles', user.uid);
                              setDoc(profileRef, { 
                                lastBattleRevenue: revenue,
                                lastGrowthRevenue: revenue,
                                roi: growthStats.roi + revenue,
                                updatedAt: new Date().toISOString()
                              }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'profiles/' + user.uid));
                            }
                            
                            showToast(t("¡Análisis de Crecimiento Guardado! Datos vinculados a tu perfil.", "Growth Analysis Saved! Data linked to your profile."), "success");
                          }} 
                        />
                      )}
                      {activeSubRow === 1 && (
                        <GMBPostCanvas 
                          profile={profile} 
                          t={t} 
                          showToast={showToast}
                          onPostCreated={() => {
                            setGrowthStats(curr => ({ ...curr, posts: curr.posts + 1 }));
                            if (user) {
                              const statsRef = doc(db, 'stats', user.uid);
                              setDoc(statsRef, { 
                                posts: growthStats.posts + 1,
                                updatedAt: new Date().toISOString()
                              }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, 'stats/' + user.uid));
                            }
                            showToast(t("¡Post optimizado! Has subido de nivel en autoridad.", "Post optimized! You've leveled up in authority."), "success");
                          }}
                        />
                      )}
                      {activeSubRow === 2 && <NeighborhoodDirectory location={profile.location} t={t} showToast={showToast} />}
                      {activeSubRow === 3 && (
                        <GBPAuditChecklist 
                          profile={profile} 
                          t={t} 
                          showToast={showToast} 
                          onNavigateTab={(tab) => setActiveTab(tab as any)}
                          gmbConnected={Boolean(profile?.gmbConnected || profile?.gbpConnectionStatus === 'CONNECTED')}
                        />
                      )}
                      {activeSubRow === 4 && (
                        <div className="max-w-3xl mx-auto py-2">
                          <ZeroPromptPhotoCapture
                            entityId={profile.name ? `ent_${profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : 'ent_current'}
                            lang={language === 'en' ? 'en' : 'es'}
                            onPhotoCaptured={(photo) => {
                              showToast(
                                language === 'en'
                                  ? 'Field photo and EXIF telemetry captured offline!'
                                  : '¡Foto de campo y telemetría EXIF capturadas offline!',
                                'success'
                              );
                            }}
                          />
                        </div>
                      )}

                      {/* TASK P3-1: Sealed Job Evidence Waitlist Card */}
                      <div className="pt-6">
                        <SealedJobEvidenceWaitlistCard
                          user={user}
                          profile={profile}
                          t={t}
                          showToast={showToast}
                        />
                      </div>
                    </div>
                  </div>
                )}
                

            {activeTab === 'business_scan' && (
              <BusinessScanView 
                language={language}
                t={t}
                setActiveTab={setActiveTab}
                setActiveSubRow={setActiveSubRow}
                handleActiveTab={(tabOrObj: any, sub?: number) => {
                  if (typeof tabOrObj === 'object') {
                    setActiveTab(tabOrObj.tab);
                    if (tabOrObj.subRow !== undefined) setActiveSubRow(tabOrObj.subRow);
                  } else {
                    setActiveTab(tabOrObj);
                    if (sub !== undefined) setActiveSubRow(sub);
                  }
                }}
                profile={profile}
                showToast={showToast}
              />
            )}

            {activeTab === 'reviews' && (
              <section className="space-y-4 md:space-y-6">
                <Header title={t("Potenciador de Google Maps y Reseñas", "Google Maps & Review Booster")} subtitle={t("Responde reseñas usando palabras clave estratégicas.", "Reply to reviews using strategic keywords.")} />
                {renderSubTabs([
                  t("Código QR y Link", "QR & Review Link"), 
                  t("Escribir Respuestas", "Write Replies"),
                  t("Escudo Reputación", "Reputation Shield")
                ])}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {activeSubRow === 2 ? (
                    <div className="lg:col-span-2">
                      <Card title={t("Escudo de Reputación Preventivo", "Preventive Reputation Shield")} icon={<ShieldCheck size={18} className="text-indigo-500" />}>
                        <div className="space-y-6 max-w-2xl">
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {t(
                              "Protege activamente tu promedio en Google Maps. Este sistema inteligente filtra el feedback de tus clientes en tiempo real:",
                              "Actively protect your Google Maps average. This intelligent system filters your client feedback in real-time:"
                            )}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-3">
                              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                                <Star size={16} className="fill-current" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black uppercase text-emerald-400">{t("Opinión 4 o 5 Estrellas", "4 or 5 Star Review")}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                  {t("Se redirige automáticamente al cliente para que publique su reseña públicamente en Google Maps.", "The customer is automatically redirected to publish their review publicly on Google Maps.")}
                                </p>
                              </div>
                            </div>

                            <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 flex items-start gap-3">
                              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
                                <AlertTriangle size={16} />
                              </div>
                              <div>
                                <h4 className="text-xs font-black uppercase text-red-400">{t("Opinión 1 a 3 Estrellas", "1 to 3 Star Review")}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                  {t("Se intercepta de forma privada con disculpas y reconciliación para resolverlo internamente y evitar dañar tu promedio.", "Intercepted privately with apologies and reconciliation to resolve it internally and avoid damaging your rating.")}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Tu Link Único del Escudo", "Your Unique Shield Link")}</label>
                            <div className="flex gap-2">
                              <input 
                                readOnly
                                type="text"
                                value={`${window.location.origin}/?view=shield&rate=${user?.uid || 'demo_bvelt'}`}
                                className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 select-all outline-none"
                              />
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/?view=shield&rate=${user?.uid || 'demo_bvelt'}`);
                                  showToast(t("¡Link copiado!", "Link copied!"), "success");
                                }}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                              >
                                {t("Copiar", "Copy")}
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/?view=shield&rate=${user?.uid || 'demo_bvelt'}`;
                                window.open(url, '_blank');
                              }}
                              className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider text-center cursor-pointer shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2"
                            >
                              <Play size={14} /> {t("Probar Filtro en Vivo", "Test Live Filter")}
                            </button>
                            <button
                              onClick={() => {
                                showToast(t("Escudo activo en todos tus flyers y solicitudes de reseñas.", "Shield active on all flyers and review requests."), "info");
                              }}
                              className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider text-center cursor-pointer flex items-center justify-center gap-2"
                            >
                              <ShieldCheck size={14} className="text-emerald-500" /> {t("Verificar Estado: ACTIVO", "Verify Status: ACTIVE")}
                            </button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <>
                      {(!isMobile || activeSubRow === 0) && (
                        <Card title={t("Solicitar Opinión de Clientes", "Request Customer Feedback")} icon={<Send size={16} className="text-emerald-400" />}>
                      <div className="space-y-4">
                        {/* Interactive Star Rating Selector with Bounce Animations */}
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 mb-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t("Calificación Objetivo para Solicitar", "Target Request Rating")}</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((starNum) => {
                              const isSelected = starNum <= selectedStars;
                              return (
                                <motion.button
                                  key={starNum}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStars(starNum);
                                    setClickedStarIndex(starNum);
                                    setTimeout(() => setClickedStarIndex(null), 600);
                                    showToast(t(`Objetivo establecido: ${starNum} estrellas!`, `Target set: ${starNum} stars!`), "success");
                                  }}
                                  animate={clickedStarIndex === starNum ? {
                                    y: [0, -12, 0, -6, 0],
                                    scale: [1, 1.25, 1.1, 1.15, 1]
                                  } : {}}
                                  transition={{
                                    duration: 0.5,
                                    ease: "easeInOut"
                                  }}
                                  whileHover={{ scale: 1.15 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="cursor-pointer focus:outline-none"
                                >
                                  <Star 
                                    size={28} 
                                    className={`${isSelected ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]' : 'text-slate-300 dark:text-slate-700'} transition-colors duration-150`} 
                                  />
                                </motion.button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-wider text-center">
                            {selectedStars === 5 
                              ? t("🏆 ¡Excelente! Solicitando el máximo nivel local en tu zona.", "🏆 Excellent! Requesting the highest local standard in your area.") 
                              : t(`⭐ Solicitando calificación de ${selectedStars} estrellas.`, `Requesting feedback rating of ${selectedStars} stars.`)}
                          </p>
                        </div>

                        <Input label={t("Nombre del Cliente", "Customer Name")} placeholder="Ej. Mark Harrison" value={revClientName} onChange={setRevClientName} />
                        <Input label={t("Número de Teléfono", "Phone Number")} placeholder="Ej. +12395550192" value={revClientPhone} onChange={setRevClientPhone} />
                        <Input label={t("Link de Reseña", "Review Link")} placeholder="Ej. https://g.page/r/..." value={revGoogleLink} onChange={setRevGoogleLink} />
                        <div className="grid grid-cols-1 gap-2">
                          <button onClick={generateReviewMessage} disabled={isAiLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                            {isAiLoading ? t('Generando...', 'Generating...') : <><MessageSquare size={16} /> {t("Enviar Link", "Send Link")}</>}
                          </button>
                        </div>
                        {reviewResult && (
                          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{reviewResult}</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                  onClick={() => {
                                    copyToClipboard(reviewResult, 'review');
                                    showToast(t("Mensaje copiado", "Message copied"), "success");
                                    const cleanedPhone = revClientPhone.replace(/\D/g, '');
                                    const wpUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(reviewResult)}`;
                                    window.open(wpUrl, '_blank');
                                  }} 
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Send size={14} />
                                  {t("Enviar por WhatsApp", "Send via WhatsApp")}
                                </button>
                                <button 
                                  onClick={() => {
                                    copyToClipboard(reviewResult, 'review');
                                    showToast(t("Mensaje copiado", "Message copied"), "success");
                                    const cleanedPhone = revClientPhone.replace(/[^+\d]/g, '');
                                    const smsUrl = `sms:${cleanedPhone}?body=${encodeURIComponent(reviewResult)}`;
                                    window.open(smsUrl, '_self');
                                  }} 
                                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <MessageSquare size={14} />
                                  {t("Enviar por SMS (EE.UU.)", "Send via SMS (USA)")}
                                </button>
                                <button 
                                  onClick={() => {
                                    copyToClipboard(reviewResult, 'review');
                                    showToast(t("Mensaje copiado", "Message copied"), "success");
                                    const mailUrl = `mailto:?subject=${encodeURIComponent(t("Tu opinión nos importa", "Your opinion matters"))}&body=${encodeURIComponent(reviewResult)}`;
                                    window.open(mailUrl, '_blank');
                                  }} 
                                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <FileText size={14} />
                                  {t("Enviar por Email", "Send via Email")}
                                </button>
                             </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                  
                  {(!isMobile || activeSubRow === 1) && (
                    <Card title={simpleMode ? t("✍️ Asistente de Respuestas", "✍️ Review Reply Assistant") : t("✍️ Asistente de Respuestas y SEO", "✍️ SEO Review Reply Assistant")} icon={<Wand2 size={16} className="text-indigo-600 dark:text-indigo-400" />}>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Reseña Recibida", "Review Received")}</label>
                        </div>
                        <textarea value={replyRawReview} onChange={e => setReplyRawReview(e.target.value)} rows={3} placeholder={t("Pega aquí el comentario de tu cliente...", "Paste client comment here...")} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-slate-200 resize-none outline-none focus:border-indigo-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <CityAutocomplete label={t("Ciudad / Área", "City / Area")} placeholder={t("Ej. Tu Ciudad", "e.g. Your City")} value={replyCity} onChange={setReplyCity} />
                        <NicheAutocomplete label={t("Trabajo Realizado", "Service Done")} placeholder={t("Ej. Mantenimiento", "e.g. Service Maintenance")} value={replyService} onChange={setReplyService} />
                      </div>

                      {/* SEO Keyword Harvester */}
                      <div className="bg-slate-50 dark:bg-[#080b11] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                          📡 {t("Palabras Clave SEO Recomendadas (1-Click)", "Recommended SEO Keywords (1-Click)")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            profile?.category ? profile.category : t("servicio", "service"),
                            profile?.location ? `${t("mejor", "best")} ${profile?.category || t("servicio", "service")} ${profile.location}` : t("mejor servicio profesional", "best professional service"),
                            profile?.location ? `${profile?.category || t("servicio", "service")} ${t("cerca de mí", "near me")}` : t("servicio cerca de mi", "service near me"),
                            t("calidad precio", "quality price"),
                            t("recomendable", "highly recommended")
                          ].map((kw, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setReplyRawReview(prev => prev ? `${prev} [SEO: ${kw}]` : `[SEO: ${kw}]`);
                                if (showToast) showToast(t("¡Palabra clave insertada!", "Keyword inserted!"), "success");
                              }}
                              className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2.5 py-1 rounded-md transition cursor-pointer"
                            >
                              + {kw}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button onClick={generateSEOReply} disabled={isAiLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer">
                        {isAiLoading ? t("Escribiendo respuesta...", "Writing reply...") : (simpleMode ? t("Generar Mensaje Cordial ✨", "Generate Friendly Message ✨") : t("Generar Respuesta Inteligente ✨", "Generate Smart Reply ✨"))}
                      </button>
                      {isAiLoading && (
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                          <div className="h-3 bg-slate-300 dark:bg-slate-800 rounded-full w-1/4"></div>
                          <div className="space-y-2">
                            <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-full"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-5/6"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-2/3"></div>
                          </div>
                          <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider flex items-center gap-1.5 pt-1">
                            ✨ {t("Sistema redactando respuesta...", "System composing reply...")}
                          </span>
                        </div>
                      )}
                      {replyResult && !isAiLoading && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)] space-y-4">
                          <div className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="text-emerald-500" />
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{t("SEO Local Optimizado", "Optimized Local SEO")}</span>
                             </div>
                          </div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800">"{replyResult}"</p>
                          <button onClick={() => copyToClipboard(replyResult, 'review')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]">
                             <Copy size={16} /> [ 📋 Copy & Inject to Google Maps ]
                          </button>
                        </div>
                      )}
                      <button className="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-[10px] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition cursor-pointer">
                        <EyeOff size={14} /> {t("Modo Incógnito para reseñas negativas", "Incognito Mode for negative reviews")}
                      </button>
                    </div>
                  </Card>
                  )}
                </>
              )}
                </div>
              </section>
            )}

            {activeTab === 'social' && (
              <section id="section-social" className="space-y-4 md:space-y-6">
                <Header 
                  title={simpleMode ? t("📸 Crear Publicidad Sencilla", "📸 Create Quick Ads") : t("📸 Creador de Publicidad Social", "📸 Social Content Creator")} 
                  subtitle={t("Genera publicaciones con fotos reales y estima cobros fácilmente.", "Generate posts with real photos and estimate budgets easily.")} 
                />
                  {renderSubTabs([
                    t("Escribir Anuncio", "Write Ad"), 
                    t("Sugerir Costo + Post", "Suggest Cost & Post"), 
                    t("Reporte de Cliente", "Client Report 🤝"),
                    t("Mis Referidos", "My Referrals 🚀")
                  ])}
                
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {activeSubRow === 0 && (
                    <Card title={simpleMode ? t("✏️ Escribir un Anuncio", "✏️ Build Advertisement") : t("✏️ Redactor de Publicidades", "✏️ Post Generator")} icon={<ImageIcon size={18} className="text-indigo-600 dark:text-indigo-400" />}>
                      <div className="space-y-5">
                        {/* Target Audience Language Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                          <div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {t("Idioma del Anuncio", "Ad Text Language")}
                            </span>
                            <p className="text-[10px] text-slate-500">
                              {t("Selecciona el idioma en el que se generará el contenido.", "Select the language in which the content will be generated.")}
                            </p>
                          </div>
                          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setSocialContentLanguage('en');
                                showToast(t("Idioma del anuncio cambiado a Inglés", "Ad target language set to English"), "info");
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${socialContentLanguage === 'en' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                              EN (English)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSocialContentLanguage('es');
                                showToast(t("Idioma del anuncio cambiado a Español", "Ad target language set to Spanish"), "info");
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${socialContentLanguage === 'es' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                              ES (Español)
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => {
                              setSocialTemplate('success');
                              setSocialDesc(t("Caso de éxito de trabajo terminado: Instalación de paneles en Park Shore.", "Success story: Panel installation in Park Shore."));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${socialTemplate === 'success' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                          >
                            🏆 {t("Caso Éxito", "Success Case")}
                          </button>
                          <button 
                            onClick={() => {
                              setSocialTemplate('promo');
                              setSocialDesc(t("Promoción de temporada: 20% de descuento en mantenimiento preventivo este mes.", "Seasonal promo: 20% off preventive maintenance this month."));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${socialTemplate === 'promo' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                          >
                            🔥 {t("Promoción", "Promo")}
                          </button>
                          <button 
                            onClick={() => {
                              setSocialTemplate('tip');
                              setSocialDesc(t("Consejo experto local: Cómo solucionar los problemas más comunes y extender nuestra garantía.", "Expert tip: How to solve common problems and extend system lifespan."));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${socialTemplate === 'tip' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                          >
                            💡 {t("Consejo SEO", "SEO Tip")}
                          </button>
                        </div>

                        <div className="space-y-2">
                           <div className="flex justify-between items-center">
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Describe el trabajo realizado", "Describe the work done")}</label>
                              <button onClick={startVoice} className={`text-xs px-3 py-1 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${isRecording ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                                <Mic size={14} /> {isRecording ? t("Escuchando...", "Listening...") : t("Dictar con voz", "Voice Dictate")}
                              </button>
                           </div>
                           <textarea value={socialDesc} onChange={e => setSocialDesc(e.target.value)} rows={3} placeholder={t("Ejemplo: Pintura completa de fachada de casa o corte de césped...", "Example: House exterior paint or lawn care in my area...")} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-base md:text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500" />
                        </div>

                        <div className="space-y-2">
                           <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Referencia Local / Barrio", "Local Landmark / Neighborhood")}</label>
                           <input type="text" value={socialContext} onChange={e => setSocialContext(e.target.value)} placeholder={t("Ej. Cerca de las áreas residenciales, vecindarios del norte...", "e.g. Near the best residential areas, northern neighborhoods...")} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-base md:text-sm text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <ImageUpload label={t("Foto del ANTES", "BEFORE Photo")} id="before" image={imgBefore} onUpload={f => handleImageUpload(f, 'before')} icon={<Camera size={24} />} />
                           <ImageUpload label={t("Foto del DESPUÉS", "AFTER Photo")} id="after" image={imgAfter} onUpload={f => handleImageUpload(f, 'after')} icon={<CheckCircle size={24} />} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button onClick={generateSocialPost} disabled={isAiLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer">
                            {isAiLoading ? t("Escribiendo anuncio...", "Writing ad...") : <><Wand2 size={18} /> {simpleMode ? t("Crear Texto de Anuncio ✨", "Create Ad Text ✨") : t("Generar Publicación ✨", "Build Post ✨")}</>}
                          </button>
                          <button onClick={() => {
                            if (!imgAfter) { showToast(t("Primero sube una foto del después", "Upload a 'after' photo first"), "info"); return; }
                            showToast(t("Analizando calidad de la foto...", "Analyzing photo quality..."), "info");
                            setVoiceCommandResult(t("Analizando calidad de la foto...", "Analyzing photo quality..."));
                            setTimeout(() => {
                               const resultMsg = t("✅ Optimizada: Iluminación 9/10, Encuadre 8/10. Excelente para tus clientes.", "✅ Optimized: Lighting 9/10, Framing 8/10. Great for your clients.");
                               showToast(resultMsg, "success");
                               setVoiceCommandResult(resultMsg);
                            }, 1500);
                          }} className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer">
                            <Activity size={18} /> {simpleMode ? t("Verificar Foto de Trabajo", "Check Work Photo") : t("Analizar Calidad SEO de Imagen", "Analyze Image SEO Quality")}
                          </button>
                        </div>
                        {voiceCommandResult && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2 mt-2"
                          >
                             <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                             <div>
                                <p className="font-bold">{t("Resultado de Análisis de Foto de Trabajo:", "Work Photo Analysis Result:")}</p>
                                <p className="mt-1">{voiceCommandResult}</p>
                             </div>
                          </motion.div>
                        )}
                        {isAiLoading && (
                          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                            <div className="h-3 bg-slate-300 dark:bg-slate-800 rounded-full w-1/5"></div>
                            <div className="space-y-2">
                              <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-full"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-11/12"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-800/80 rounded-full w-4/5"></div>
                            </div>
                            <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider flex items-center gap-1.5 pt-1">
                              ✨ {t("Redactando publicación integrada con geo-metatags...", "Composing post integrated with geo-metatags...")}
                            </span>
                          </div>
                        )}
                        {socialResult && !isAiLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line relative group">
                            <button onClick={() => copyToClipboard(socialResult)} className="absolute top-4 right-4 lg:opacity-0 lg:group-hover:opacity-100 transition p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-pointer"><Copy size={14} /></button>
                            {socialResult}
                          </motion.div>
                        )}
                      </div>
                    </Card>
                  )}

                  {(!isMobile || activeSubRow === 1) && (
                    <Card title={t("🔮 Sugerir Precio + Crear Publicación", "🔮 Suggest Price & Build Post")} icon={<Gem size={16} className="text-amber-500 animate-bounce" />}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                             <ImageUpload label={t("Sube foto del trabajo terminado", "Upload finished job photo")} id="photo-post" image={photoToPostImage} onUpload={f => handleImageUpload(f, 'photoToPost')} icon={<Camera size={26} />} />
                             <button 
                                onClick={handlePhotoToPost} 
                                disabled={isAiLoading || !photoToPostImage}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer"
                              >
                               {isAiLoading ? t("Analizando imagen...", "Analyzing image...") : <><Wand2 size={18} /> {t("Sugerir Precio + Crear Post ✨", "Suggest Price + Create Post ✨")}</>}
                             </button>
                          </div>
                          
                          {photoToPostResult && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 p-4 rounded-2xl space-y-3">
                              <div>
                                <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">{t("Estrategia de Anuncio", "Post Strategy")}</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic whitespace-pre-wrap">"{photoToPostResult.post}"</p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 p-2 rounded-xl flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500">{t("Sugerencia de Cobro", "Budget Suggestion")}</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{photoToPostResult.budget}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button onClick={publishToGMB} className="bg-emerald-600 text-white font-bold py-2 rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition">
                                    <CheckCircle size={14} /> GMB
                                </button>
                                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(photoToPostResult.post + " - Presupuesto: " + photoToPostResult.budget)}`, '_blank')} className="bg-green-600 text-white font-bold py-2 rounded-xl text-[10px] flex items-center justify-center gap-1.5">
                                    <MessageCircle size={14} /> WhatsApp
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}

                  {(!isMobile || activeSubRow === 2) && (
                    <Card title={t("🤝 Reporte 'Paz Mental' para Cliente", "🤝 'Peace of Mind' Client Report")} icon={<ThumbsUp size={18} className="text-emerald-500" />}>
                      <div className="space-y-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {t("Genera un resumen profesional del trabajo hecho para enviárselo al cliente de inmediato. Esto asegura recompra y opiniones auténticas.", "Generate a professional summary of the work done to send it to the client immediately. This easily builds trust and authentic reviews.")}
                        </p>
                        <div className="space-y-3">
                          <input 
                            type="text" 
                            placeholder={t("Ej. Reparación de AC y Filtros en Living Room", "E.g. AC Repair and Filter Change in Living Room")}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500"
                            id="job-report-input"
                          />
                          <button 
                            onClick={() => {
                               const val = (document.getElementById('job-report-input') as HTMLInputElement)?.value;
                               if(val) generateJobReport(val);
                               else showToast(t("Escribe qué hiciste hoy", "Write what you did today"), "info");
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                          >
                            <Send size={16} /> {t("Crear y Copiar Reporte ✨", "Create & Copy Report ✨")}
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {(!isMobile || activeSubRow === 3) && (
                    <Card title={t("🎁 Regala un Mes Gratis", "🎁 Give a Free Month")} icon={<Sparkles size={18} className="text-indigo-600" />}>
                      <div className="space-y-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {t("Invita a un colega contratista a usar Bvelt. Ellos reciben 1 mes gratis, ¡y tú también! Copia el enlace y compártelo directo por WhatsApp o SMS.", "Invite a fellow contractor to use Bvelt. They get 1 free month, and so do you! Copy the link and share it directly via WhatsApp or SMS.")}
                        </p>
                        
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
                          <div className="flex-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                            <span>https://bvelt.app/invite/{profile.name.toLowerCase().replace(/\s+/g, '')}</span>
                            <button onClick={() => { navigator.clipboard.writeText(`https://bvelt.app/invite/${profile.name.toLowerCase().replace(/\s+/g, '')}`); showToast(t("¡Enlace copiado!", "Link copied!"), "success"); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 p-1 cursor-pointer">
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                           <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(t(`¡Bro! Estoy usando esta app para conseguir reseñas en Google Maps y nos regalan 1 mes gratis a ambos si entras con mi link: https://bvelt.app/invite/${profile.name.toLowerCase().replace(/\s+/g, '')}`, `Hey! I'm using this app to get GMB reviews and we both get 1 free month if you join with my link: https://bvelt.app/invite/${profile.name.toLowerCase().replace(/\s+/g, '')}`))}`, '_blank')} className="bg-[#25D366] hover:bg-[#20b858] text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 cursor-pointer">
                             <MessageCircle size={18} /> {t("Enviar por WhatsApp", "Send WhatsApp")}
                           </button>
                           <button onClick={() => window.open(`sms:?body=${encodeURIComponent(t(`¡Bro! Estoy usando esta app para conseguir reseñas en Google Maps y nos regalan 1 mes gratis a ambos si entras con mi link: https://bvelt.app/invite/${profile.name.toLowerCase().replace(/\s+/g, '')}`, `Hey! I'm using this app to get GMB reviews and we both get 1 free month if you join with my link: https://bvelt.app/invite/${profile.name.toLowerCase().replace(/\s+/g, '')}`))}`, '_self')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer">
                             <Send size={18} /> {t("Enviar por SMS", "Send SMS")}
                           </button>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </section>
            )}

            {false && (
              <section className="space-y-6 flex flex-col h-full">
                <Header 
                  title={t("📍 Planificador de Rutas Inteligente", "📍 Smart Route Planner")} 
                  subtitle={t("Optimiza tus paradas y ahorra gasolina hoy.", "Optimize your stops and save on gas today.")} 
                />
                
                {renderSubTabs([t("Ver Mapa", "View Map"), t("Direcciones y Paradas", "Directions & Stops"), t("Ahorro y Enviar", "Savings & Share")])}
                
                {(!isMobile || activeSubRow === 0) && (
                  <div className="flex-1 min-h-[340px] bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-2xl">
                    <RouteLeafletMap
                      center={{ lat: profile.lat || 25.7617, lng: profile.lng || -80.1918 }}
                      properties={properties}
                      businessName={profile.businessName}
                      language={language}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {(!isMobile || activeSubRow === 1) && (
                    <div className="lg:col-span-2 space-y-4">
                       {/* Add Stop Form */}
                       <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-[2rem] space-y-4 shadow-sm">
                         <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{t("Añadir Parada a la Ruta de Trabajo", "Add Stop to Work Route")}</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <Input 
                             label={t("Dirección Completa", "Full Address")} 
                             placeholder="Ej. 123 Main Street" 
                             value={newStopAddress} 
                             onChange={setNewStopAddress} 
                           />
                           <Input 
                             label={t("Nombre del Cliente", "Customer Name")} 
                             placeholder="Ej. Mary Lane" 
                             value={newStopClient} 
                             onChange={setNewStopClient} 
                           />
                         </div>
                         <div className="flex justify-end">
                           <button 
                             onClick={addStop}
                             className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider"
                           >
                             <Plus size={14} /> {t("Añadir Dirección", "Add Address")}
                           </button>
                         </div>
                       </div>

                       {/* Stops list */}
                       <div className="space-y-3">
                         {properties.map(p => (
                           <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl flex items-center justify-between group hover:border-indigo-500 transition shadow-sm">
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-500'} group-hover:scale-110 transition`}>
                                    {p.status === 'completed' ? <CheckCircle size={20} /> : <MapPin size={20} />}
                                 </div>
                                 <div>
                                    <p className={`text-xs font-black ${p.status === 'completed' ? 'line-through opacity-50' : ''}`}>{p.address}</p>
                                    <p className="text-[10px] text-slate-500">{p.client}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <button
                                   onClick={() => setProperties(properties.map(item => item.id === p.id ? {...item, status: item.status === 'completed' ? 'pending' : 'completed'} : item))}
                                   className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${p.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'}`}
                                 >
                                    {p.status === 'completed' ? t("Listo", "Done") : t("Finalizar", "Finish")}
                                 </button>
                                 <button 
                                   onClick={() => removeStop(p.id)}
                                   className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-55 dark:hover:bg-rose-950/25 rounded-lg transition"
                                   title={t("Eliminar Parada", "Delete Stop")}
                                 >
                                   <X size={14} />
                                 </button>
                              </div>
                           </div>
                         ))}
                         {properties.length === 0 && (
                           <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-center text-slate-400">
                             <MapIcon className="mx-auto mb-2 text-slate-300 dark:text-slate-700" size={32} />
                             <p className="text-xs font-bold">{t("No hay paradas en tu ruta todavía", "No stops in your route yet")}</p>
                           </div>
                         )}
                       </div>
                    </div>
                  )}

                  {(!isMobile || activeSubRow === 2) && (
                    <div className="space-y-6">
                       <Card title={t("Ahorro de Gasolina", "Gas Savings")} icon={<Bolt size={16} className="text-amber-500" />}>
                          <div className="text-center py-4 space-y-4">
                             <div>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">${(properties.length * 3.10).toFixed(2)}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-black">{t("Ahorro Estimado Hoy", "Estimated Savings Today")}</p>
                             </div>
                             <p className="text-[11px] font-bold text-indigo-600 leading-relaxed italic">{t("\"Esta ruta evita hasta un 15% de tiempo muerto en tráfico local.\"", "\"This route avoids up to 15% of idle time in local traffic.\"")}</p>
                             
                             <div className="space-y-2 pt-2">
                               <button onClick={openMapsDirectionsUrl} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-indigo-600/10">
                                  <MapIcon size={16} /> {t("Iniciar Navegación GPS", "Start GPS Navigation")}
                               </button>
                               <button onClick={() => shareRouteToWorker('whatsapp')} className="w-[48%] inline-flex mr-[4%] bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl items-center justify-center gap-2 transition text-xs cursor-pointer">
                                  <MessageCircle size={14} /> {t("WhatsApp", "WhatsApp")}
                               </button>
                               <button onClick={() => shareRouteToWorker('sms')} className="w-[48%] inline-flex bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl items-center justify-center gap-2 transition text-xs cursor-pointer">
                                  <MessageSquare size={14} /> {t("Enviar por SMS 💬", "Send via SMS 💬")}
                               </button>
                             </div>
                          </div>
                       </Card>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'leads' && (
               <section id="section-leads" className="space-y-6">
                 <Header 
                   title={simpleMode ? t("Bandeja CRM de Clientes", "🎯 CRM Leads Inbox") : t("Bandeja CRM & Control de Leads", "🎯 Leads CRM & Client Inbox")} 
                   subtitle={t("Registra clientes interesados y responde en un solo toque.", "Log potential customers and reply in a single tap.")} 
                 />
                 
                 {renderSubTabs([
                   t("Analizar Mensaje", "Analyze Msg"),
                   t("Escanear Zona", "Scan Area"),
                   t("Red de Aliados", "Partner Network"),
                   t("Plantillas SMS", "SMS Templates"),
                   t("Bandeja CRM", "CRM Inbox"),
                   t("Retención", "Retention"),
                    ...(isFounderOrAdmin ? [t("Operador / Informes", "Operator Funnel")] : [])
                 ])}
                 
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {activeSubRow !== 5 && (!isMobile || (activeSubRow >= 0 && activeSubRow <= 2)) && (
                     <div className="lg:col-span-1 space-y-6">
                        {/* Card 1: Analizar Mensaje */}
                         {(!isMobile || activeSubRow === 0) && (
                          <Card title={lastAnalyzedDraft ? t("Respuesta Lista para Enviar", "Ready-to-Send Response") : t("Analizar Mensaje", "Analyze Message")}>
                            {lastAnalyzedDraft ? (
                              <div className="space-y-4">
                                {/* Analysis Draft Card with Urgency, Price Range & Output */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5 relative">
                                  {/* Badges: Urgency + Suggested Price Range */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/60 pb-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <MessageSquare size={12} />
                                        {t("BORRADOR LISTO", "READY DRAFT")}
                                      </span>
                                      {/* Urgency */}
                                      {(() => {
                                        const urg = (lastAnalyzedDraft.urgency || '').toLowerCase();
                                        const isHigh = urg.includes('alt') || urg.includes('high');
                                        const isLow = urg.includes('baj') || urg.includes('low');
                                        return (
                                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                            isHigh
                                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                              : isLow
                                                ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                          }`}>
                                            {isHigh ? '🔥 ' : isLow ? 'ℹ️ ' : '⚡ '}
                                            {t("Urgencia:", "Urgency:")} {lastAnalyzedDraft.urgency || t("Alta", "High")}
                                          </span>
                                        );
                                      })()}
                                    </div>

                                    {/* Client info if found */}
                                    {lastAnalyzedDraft.clientName && (
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                                        {lastAnalyzedDraft.clientName}
                                      </span>
                                    )}
                                  </div>

                                  {/* Suggested Price Range (Clear Estimate Disclaimer) */}
                                  {lastAnalyzedDraft.suggestedRange && (
                                    <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                                        <span>💰 {t("Rango Sugerido para este Trabajo:", "Suggested Range for this Job:")}</span>
                                        <span className="text-indigo-600 dark:text-indigo-400">{lastAnalyzedDraft.suggestedRange}</span>
                                      </div>
                                      <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 italic">
                                        {t("Estimación orientativa, no ingreso garantizado", "Directional estimate, not guaranteed revenue")}
                                      </span>
                                    </div>
                                  )}

                                  {/* Verified Fact vs Estimate Tag */}
                                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                      <CheckCircle size={10} />
                                      {t("Hecho Verificado:", "Verified Fact:")} {t("Mensaje directo recibido de prospecto interesado", "Direct inquiry received from active customer")}
                                    </span>
                                  </div>

                                  {/* Ready-to-Send Reply */}
                                  <div className="p-3 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed selection:bg-indigo-500 selection:text-white">
                                      {lastAnalyzedDraft.draft}
                                    </p>
                                  </div>

                                  {/* Action Buttons: One tap copy & WhatsApp */}
                                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(lastAnalyzedDraft.draft);
                                        showToast(t("¡Borrador copiado al portapapeles!", "Draft copied to clipboard!"), "success");
                                      }}
                                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                                    >
                                      <Copy size={13} />
                                      {t("Copiar respuesta (1 toque)", "Copy reply (1 tap)")}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cleanPhone = (lastAnalyzedDraft.phone || "").replace(/\D/g, "");
                                        if (cleanPhone && cleanPhone.length >= 7) {
                                          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lastAnalyzedDraft.draft)}`, "_blank", "noopener,noreferrer");
                                        } else {
                                          navigator.clipboard.writeText(lastAnalyzedDraft.draft);
                                          showToast(t("¡Borrador copiado! No se detectó teléfono en el mensaje para abrir directo.", "Draft copied! No phone number detected in message to open directly."), "info");
                                        }
                                      }}
                                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                                    >
                                      <Phone size={13} />
                                      {t("Enviar por WhatsApp", "Send via WhatsApp")}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setLastAnalyzedDraft(null)}
                                      className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition ml-auto cursor-pointer"
                                    >
                                      {t("Analizar otro mensaje", "Analyze another message")}
                                    </button>
                                  </div>
                                </div>

                                {/* Next Best Actions Block (Max 3 Items) */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                      <Zap size={12} className="text-amber-500 fill-current" />
                                      {t("Siguientes Mejores Acciones", "Next Best Actions")}
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                      {t("Max 3 pasos", "Max 3 steps")}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {/* Action 1: Reply composer / Send */}
                                    <div className="p-3 bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                          {t("1. Enviar presupuesto o respuesta ahora", "1. Send ready reply to customer now")}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                          {t("Responder en menos de 15 minutos triplica la tasa de cierre del trabajo.", "Replying in under 15 minutes triples your chance to win this job.")}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(lastAnalyzedDraft.draft);
                                          showToast(t("¡Respuesta copiada! Lista para enviar por WhatsApp o SMS.", "Reply copied! Ready to paste in WhatsApp or SMS."), "success");
                                        }}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Copy size={12} />
                                        <span>{t("Copiar respuesta", "Copy reply")}</span>
                                      </button>
                                    </div>

                                    {/* Action 2: Review request tool */}
                                    <div className="p-3 bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                          {t("2. Pedir reseña a tu último cliente satisfecho", "2. Request review from last happy customer")}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                          {t("3 reseñas recientes en Maps te colocan por encima de competidores locales.", "3 recent reviews on Google Maps place you ahead of nearby competition.")}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigateTo({ tab: 'reviews', subRow: 0 });
                                          setActiveTab('reviews');
                                          setActiveSubRow(0);
                                          setSelectedMobileView('tab');
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-lg shrink-0 flex items-center justify-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                                      >
                                        <span>{t("Pedir reseña", "Request review")}</span>
                                        <ArrowRight size={12} />
                                      </button>
                                    </div>

                                    {/* Action 3: Reactivation CRM tool */}
                                    <div className="p-3 bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                          {t("3. Dar seguimiento a presupuestos anteriores", "3. Follow up on past quotes that went quiet")}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                          {t("Recupera trabajos atrasados y clientes antiguos sin gastar un solo dólar en anuncios.", "Recover unscheduled jobs and repeat business with zero ad spend.")}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigateTo({ tab: 'leads', subRow: 5, tool: 'estimate_followup', scrollId: 'estimate-followup-section' });
                                          setActiveTab('leads');
                                          setActiveSubRow(5);
                                          setSelectedMobileView('tab');
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-lg shrink-0 flex items-center justify-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                                      >
                                        <span>{t("Seguimiento a Presupuestos", "Follow-up Quotes")}</span>
                                        <ArrowRight size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Pro Upgrade Block */}
                                <div className="p-4 sm:p-5 bg-gradient-to-tr from-amber-500/15 via-indigo-500/10 to-amber-500/15 border-2 border-amber-500/40 rounded-2xl shadow-sm text-left space-y-3.5">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                                      <Zap size={20} className="fill-current" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                                        {t("Pro is $49/mo", "Pro is $49/mo")}
                                      </h4>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-1">
                                        {t("One paid job pays for Bvelt.", "One paid job pays for Bvelt.")}
                                      </p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                                        {t(
                                          "Desbloquea escaneos profundos de mapas ilimitados, prospectos automáticos calificados en tu radio y asistentes de venta integrados.",
                                          "Unlock unlimited deep map scans, automated qualified prospects in your radius, and built-in sales assistants."
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setActiveTab("plans")}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
                                  >
                                    <Sparkles size={14} className="text-amber-300" />
                                    <span>{t("Activar Pro ($49/mes)", "Upgrade to Pro ($49/mo)")}</span>
                                    <ArrowRight size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLastAnalyzedDraft(null);
                                      setActiveTab("dashboard");
                                    }}
                                    className="w-full py-1 text-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition underline cursor-pointer"
                                  >
                                    {t("Continuar al dashboard", "Continue to dashboard")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <textarea id="onboarding-textarea" value={leadRawText} onChange={e => setLeadRawText(e.target.value)} rows={4} placeholder={t("Pega el mensaje del cliente aquí...", "Paste the client's message here...")} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500" />
                                {/* Real-Time Inline Validation Feedback */}
                                {leadRawText.trim().length > 0 && leadRawText.trim().length < 10 && (
                                  <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1.5">
                                    <AlertTriangle size={13} /> {t("⚠️ El mensaje es corto. Agrega más detalles o un número telefónico para un mejor análisis.", "⚠️ Short message. Add details or phone number for better analysis.")}
                                  </p>
                                )}
                                {leadRawText.trim().length >= 10 && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                                    <CheckCircle size={13} /> {t("✓ Mensaje adecuado para clasificar urgencia, presupuesto e intención", "✓ Message suitable to classify urgency, budget, and intent")}
                                  </p>
                                )}

                                <div className="space-y-2">
                                  <button id="onboarding-analyze-btn" onClick={analyzeLead} disabled={isAiLoading || leadRawText.trim().length === 0} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-xs">
                                     <Wand2 size={14} /> {isAiLoading ? t("Analizando...", "Analyzing...") : t("Analizar e Importar", "Analyze & Import")}
                                  </button>
                                  <button onClick={() => setShowManualLeadModal(true)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 rounded-xl transition flex items-center justify-center gap-2 text-xs cursor-pointer border border-slate-200 dark:border-slate-700">
                                     <Plus size={14} className="text-indigo-500" /> {t("Ingreso Manual Estructurado", "Structured Manual Lead Entry")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Card>
                        )}
    
                       {/* Card 2: Apify On-Demand Local Scanner & Prospecting Radar */}
                       {(!isMobile || activeSubRow === 1) && (
                         <div className="space-y-4">
                           <ProspectingRadar 
                             category={profile.category || 'Servicios Generales'}
                             location={profile.location || 'Miami, FL'}
                             latitude={(profile as any)?.latitude}
                             longitude={(profile as any)?.longitude}
                             leads={leads}
                             onAddLead={(newLead) => {
                               setLeads(prev => [newLead, ...prev]);
                               showToast(t(`Lead "${newLead.businessName || newLead.client}" agregado al CRM`, `Lead "${newLead.businessName || newLead.client}" added to CRM`), 'success');
                             }}
                             onUpdateLeadStatus={handleUpdateLeadStatus}
                             onNavigateTab={(tab) => {
                               setActiveTab(tab);
                             }}
                             t={t}
                           />
                         </div>
                       )}
    
                       {/* Card 3: Aliados Locales Lead Sharing */}
                       {(!isMobile || activeSubRow === 2) && ( // GROWTH_RADAR_SECTION_START 
                         <Card title={t("🤝 Red de Aliados Locales", "🤝 Local Partner Network")} icon={<Filter size={16} className="text-rose-600 dark:text-rose-400" />}>
                           <div className="space-y-3">
                             <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("Deriva clientes que no puedes atender y gana comisiones. Evita decirle 'NO' a un cliente.", "Forward clients you can't serve to trusted partners and earn commissions. Never say 'no' to a client.")}</p>
                             <textarea value={darkLeadText} onChange={e => setDarkLeadText(e.target.value)} rows={2} placeholder={t("Ej: Cliente necesita servicio mañana, estoy lleno. ¿Alguien disponible?", "Ej: Client needs service tomorrow, I'm booked.")} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[10px] text-slate-900 dark:text-slate-200 outline-none" />
                             <button onClick={publishDarkLead} className="w-full bg-rose-100 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[10px] font-bold py-2 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-600/30 transition">{t("Derivar Cliente (Lead)", "Forward Lead")}</button>
                             
                             <div className="mt-4 space-y-2">
                               <h4 className="text-[10px] font-black uppercase text-slate-500">{t('Board Global', 'Global Board')}</h4>
                               <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                 {darkPool.map(p => (
                                   <div key={p.id} className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 relative group shadow-sm flex flex-col gap-2">
                                     <p className="text-[10px] text-slate-700 dark:text-slate-300 pr-5">{p.text}</p>
                                     <div className="flex justify-between items-center mt-1">
                                       <span className="text-[8px] text-slate-400">{p.date}</span>
                                       <button onClick={() => generatePitchForDarkLead(p.text)} className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                                         <Zap size={10} /> {t("Auto Pitch", "Auto Pitch")}
                                       </button>
                                     </div>
                                     <button onClick={() => setDarkPool(darkPool.filter(dp => dp.id !== p.id))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition" title="Dismiss"><X size={12} /></button>
                                   </div>
                                 ))}
                                 {darkPool.length === 0 && <p className="text-[9px] text-slate-500 italic">No hay leads en el board.</p>}
                               </div>
                             </div>
                           </div>
                         </Card>
                       )}
                     </div>
                   )}
                   
                   {/* Plantillas SMS */}
                   {(!isMobile || activeSubRow === 3) && (
                     <div className="lg:col-span-2 space-y-6">
                       <Card title={t("✉️ Plantillas Rápidas (Inbound / Seguimiento)", "✉️ Quick Templates (Inbound / Follow-up)")} icon={<MessageSquare size={16} className="text-indigo-500" />}>
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                              <p className="text-xs text-slate-500">{t("Plantillas optimizadas para enviar respuestas o revivir contactos con 1-clic.", "Templates optimized to send replies or revive contacts with 1-click.")}</p>
                              <span className="shrink-0 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                <Sparkles size={11} className="text-amber-500" /> {t("Redacción Lista", "Writing Ready")}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {/* Plantilla 1: Follow-up Presupuesto */}
                               <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between h-auto gap-3">
                                  <div>
                                     <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-[10px] uppercase font-black text-emerald-500">{t("Follow-up Presupuesto", "Quote Follow-up")}</h5>
                                        <span className="text-[9px] font-bold text-slate-400 capitalize">{followUpTone}</span>
                                     </div>

                                     <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 min-h-[60px]">
                                       "{followUpTemplate || t('Hola 👋, te envié el presupuesto hace unos días. ¿Pudiste revisarlo o te quedó alguna duda? La semana que viene me quedan pocos espacios. Avísame si agendamos. Saludos.', 'Hi 👋, I sent you the quote a few days ago. Were you able to review it or do you have any questions? I have few spaces left next week. Let me know if we schedule. Regards.')}"
                                     </p>

                                     {/* Tones selector & AI Rewrite */}
                                     <div className="space-y-2 mb-2">
                                        <div className="flex items-center justify-between">
                                           <span className="text-[9px] font-bold text-slate-400 uppercase">{t("Tono / Estilo:", "Tone / Style:")}</span>
                                           <div className="flex gap-1">
                                              {(['directo', 'amigable', 'urgente'] as const).map(tone => (
                                                <button
                                                  key={tone}
                                                  onClick={() => handleRewriteFollowUpTemplate(tone)}
                                                  disabled={isRewritingFollowUp}
                                                  className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize transition ${
                                                    followUpTone === tone 
                                                      ? 'bg-emerald-500 text-white' 
                                                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                                                  }`}
                                                >
                                                  {tone}
                                                </button>
                                              ))}
                                           </div>
                                        </div>

                                        <button 
                                          onClick={() => handleRewriteFollowUpTemplate(followUpTone)}
                                          disabled={isRewritingFollowUp}
                                          className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold text-[10px] py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                                        >
                                          <Sparkles size={12} className={isRewritingFollowUp ? 'animate-spin text-amber-500' : 'text-amber-500'} />
                                          {isRewritingFollowUp ? t("Reescribiendo...", "Rewriting...") : t("✨ Reescribir (Diferente versión)", "✨ Rewrite (Fresh version)")}
                                        </button>
                                     </div>
                                  </div>

                                  <button 
                                    onClick={() => {
                                      const textToSend = followUpTemplate || t('Hola 👋, te envié el presupuesto hace unos días. ¿Pudiste revisarlo o te quedó alguna duda? La semana que viene me quedan pocos espacios. Avísame si agendamos. Saludos.', 'Hi 👋, I sent you the quote a few days ago. Were you able to review it or do you have any questions? I have few spaces left next week. Let me know if we schedule. Regards.');
                                      window.open(`https://wa.me/?text=${encodeURIComponent(textToSend)}`, '_blank');
                                    }} 
                                    className="w-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] py-2.5 rounded-xl hover:bg-emerald-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <MessageCircle size={14} /> {t("Enviar por WhatsApp", "Send via WhatsApp")}
                                  </button>
                               </div>

                               {/* Plantilla 2: Reactivar Lead Frío */}
                               <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between h-auto gap-3">
                                  <div>
                                     <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-[10px] uppercase font-black text-rose-500">{t("Reactivar Lead Frío", "Reactivate Cold Lead")}</h5>
                                        <span className="text-[9px] font-bold text-slate-400 capitalize">{reactivateTone}</span>
                                     </div>

                                     <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-3 min-h-[60px]">
                                       "{reactivateTemplate || t(`Hola! Quería avisarte que esta semana estaré trabajando por tu zona. Si aún necesitas ayuda con el servicio que hablamos, te puedo ofrecer un precio especial si lo hacemos estos días. Avísame si te sirve y pasamos. Saludos! - ${profile.name}`, `Hi! I wanted to let you know that I will be working in your area this week. If you still need help with the service we talked about, I can offer you a special price if we do it these days. Let me know if it works for you. Regards! - ${profile.name}`)}"
                                     </p>

                                     {/* Tones selector & AI Rewrite */}
                                     <div className="space-y-2 mb-2">
                                        <div className="flex items-center justify-between">
                                           <span className="text-[9px] font-bold text-slate-400 uppercase">{t("Tono / Estilo:", "Tone / Style:")}</span>
                                           <div className="flex gap-1">
                                              {(['directo', 'amigable', 'urgente'] as const).map(tone => (
                                                <button
                                                  key={tone}
                                                  onClick={() => handleRewriteReactivateTemplate(tone)}
                                                  disabled={isRewritingReactivate}
                                                  className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize transition ${
                                                    reactivateTone === tone 
                                                      ? 'bg-rose-500 text-white' 
                                                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                                                  }`}
                                                >
                                                  {tone}
                                                </button>
                                              ))}
                                           </div>
                                        </div>

                                        <button 
                                          onClick={() => handleRewriteReactivateTemplate(reactivateTone)}
                                          disabled={isRewritingReactivate}
                                          className="w-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-bold text-[10px] py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                                        >
                                          <Sparkles size={12} className={isRewritingReactivate ? 'animate-spin text-amber-500' : 'text-amber-500'} />
                                          {isRewritingReactivate ? t("Reescribiendo...", "Rewriting...") : t("✨ Reescribir (Diferente versión)", "✨ Rewrite (Fresh version)")}
                                        </button>
                                     </div>
                                  </div>

                                  <button 
                                    onClick={() => {
                                      const textToSend = reactivateTemplate || t(`Hola! Quería avisarte que esta semana estaré trabajando por tu zona. Si aún necesitas ayuda with el servicio que hablamos, te puedo ofrecer un precio especial si lo hacemos estos días. Avísame si te sirve y pasamos. Saludos! - ${profile.name}`, `Hi! I wanted to let you know that I will be working in your area this week. If you still need help with the service we talked about, I can offer you a special price if we do it these days. Let me know if it works for you. Regards! - ${profile.name}`);
                                      window.open(`https://wa.me/?text=${encodeURIComponent(textToSend)}`, '_blank');
                                    }} 
                                    className="w-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-[11px] py-2.5 rounded-xl hover:bg-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <MessageCircle size={14} /> {t("Enviar por WhatsApp", "Send via WhatsApp")}
                                  </button>
                               </div>
                            </div>
                         </div>
                      </Card>
                     </div>
                   )}

                   {/* Column 2: Bandeja CRM */}
                   {activeSubRow !== 5 && (!isMobile || activeSubRow === 4) && (
                     <div className="lg:col-span-2 space-y-6">
                       <Card title={t("Bandeja CRM & Oportunidades de Clientes", "CRM Inbox & Client Opportunities")}>
                         <div className="mb-6">
                           <ClientAcquisitionLeadList 
                             leads={leads} 
                             profile={profile}
                             onUpdateStatus={handleUpdateLeadStatus}
                             onDeleteLead={(id) => setLeads(prev => prev.filter(item => item.id !== id))}
                             onNavigateToEstimator={() => setActiveTab('estimator')} tenantUid={user?.uid || null}
                             t={t}
                           />
                         </div>
                         {isAiLoading && (
                           <div className="mb-4 space-y-2">
                             <ListSkeleton count={2} />
                           </div>
                         )}
                         {currentLeadAnalysis && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                               <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="text-[10px] font-bold text-slate-500 uppercase">{t('Urgencia', 'Urgency')}</span>
                                     <span className={`text-[10px] font-black px-2 py-0.5 rounded ${currentLeadAnalysis.urgency === 'Alta' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>{currentLeadAnalysis.urgency.toUpperCase()}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                     <span className="text-[10px] font-bold text-slate-500 uppercase">{t('Negocio', 'Business')}</span>
                                     <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{currentLeadAnalysis.size}</span>
                                  </div>
                               </div>
                               <div className="bg-indigo-50 dark:bg-indigo-600/10 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block mb-1">{t('Estrategia sugerida', 'Suggested Strategy')}</span>
                                  <p className="text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">{currentLeadAnalysis.strategy}</p>
                               </div>
                             </div>
                         )}
                         
                         <div className="overflow-x-auto">
                           <table className="w-full text-xs text-left">
                             <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                                  <th className="pb-3 px-2">{t("Fecha", "Date")}</th>
                                  <th className="pb-3 px-2">{t("Extracto", "Excerpt")}</th>
                                  <th className="pb-3 px-2">{t("Urgencia", "Urgency")}</th>
                                  <th className="pb-3 px-2">{t("Acción", "Action")}</th>
                                  <th className="pb-3 px-2"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                <AnimatePresence initial={false}>
                                 {leads.slice(0, leadsPageSize).map(l => (
                                   <LeadSwipeableRow
                                     key={l.id}
                                     l={l}
                                     t={t}
                                     onGenerateClosing={generateClosingMessage}
                                     onAccept={(id) => handleLeadAction(id, 'acepto')}
                                     onDelete={(id) => setLeads(prev => prev.filter(item => item.id !== id))}
                                   />
                                 ))}
                                </AnimatePresence>
                              </tbody>
                            </table>
                          </div>
                          {leads.length > leadsPageSize && (
                            <button 
                              onClick={() => setLeadsPageSize(prev => prev + 12)}
                              className="w-full mt-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-850 text-indigo-500 font-extrabold text-center py-2.5 rounded-xl border border-dashed border-slate-200/60 dark:border-slate-800 text-[10px] uppercase tracking-wider transition cursor-pointer"
                            >
                              {t("🔽 Cargar más leads (+12)", "🔽 Show more leads (+12)")}
                            </button>
                          )}
                        </Card>
                      </div>
                    )}
                    
                    {activeSubRow === 5 && (
                      <div className="lg:col-span-3 space-y-6">
                        {/* Win-Back & Past Clients Reactivation */}
                        <ReactivationCRM 
                          t={t}
                          language={language}
                          customGeminiKey={customGeminiKey}
                          businessName={profile.name}
                          businessCategory={profile.category}
                          showToast={showToast}
                          reactivateTemplate={reactivateTemplate}
                          setReactivateTemplate={setReactivateTemplate}
                          reactivateTone={reactivateTone}
                          setReactivateTone={setReactivateTone}
                          handleRewriteReactivateTemplate={handleRewriteReactivateTemplate}
                          isRewritingReactivate={isRewritingReactivate}
                          leads={leads}
                        />

                        {/* Missed Call Auto-responder Script */}
                        <div className="max-w-2xl mx-auto pt-2">
                          <Card title={t("🤖 Text-Back: Llamadas Perdidas", "🤖 Text-Back: Missed Calls")} icon={<MessageCircle size={16} className="text-emerald-500" />}>
                             <div className="space-y-4">
                               <p className="text-xs text-slate-500">{t("Si no respondes una llamada, cópialo a tu Auto-Responder de SMS/WhatsApp. Puedes reescribirlo para sonar 100% humano.", "If you miss a call, copy this to your phone's auto-responder. You can rewrite it to sound 100% human.")}</p>
                               <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-3">
                                 <div className="flex justify-between items-center">
                                   <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">{t("Auto-Responder SMS", "SMS Auto-Responder")}</p>
                                   <span className="text-[9px] font-bold text-slate-400 capitalize">
                                     {autoResponderTone === 'cercano' ? t('Cercano', 'Friendly') : autoResponderTone === 'ejecutivo' ? t('Ejecutivo', 'Professional') : t('Rápido', 'Fast')}
                                   </span>
                                 </div>

                                 <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                   "{autoResponderSms || t("Hola, soy el asistente virtual. Lamento no poder atender tu llamada ahora. ¿En qué servicio necesitas ayuda? Te respondemos enseguida.", "Hi, I am the virtual assistant. I'm sorry I can't answer your call right now. What service do you need help with? We'll reply right away.")}"
                                 </p>

                                 {/* Style selector & Rewrite button */}
                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase">{t("Estilo:", "Style:")}</span>
                                      <div className="flex gap-1">
                                         {(['cercano', 'ejecutivo', 'rapido'] as const).map(tone => (
                                           <button
                                             key={tone}
                                             onClick={() => handleRewriteAutoResponderSms(tone)}
                                             disabled={isRewritingAutoResponder}
                                             className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize transition ${
                                               autoResponderTone === tone 
                                                 ? 'bg-emerald-600 text-white' 
                                                 : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200'
                                             }`}
                                           >
                                             {tone === 'cercano' ? t('Cercano', 'Friendly') : tone === 'ejecutivo' ? t('Ejecutivo', 'Professional') : t('Rápido', 'Fast')}
                                           </button>
                                         ))}
                                      </div>
                                   </div>

                                   <button 
                                     onClick={() => handleRewriteAutoResponderSms(autoResponderTone)}
                                     disabled={isRewritingAutoResponder}
                                     className="w-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 font-bold text-[10px] py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                                   >
                                     <Sparkles size={12} className={isRewritingAutoResponder ? 'animate-spin text-amber-500' : 'text-amber-500'} />
                                     {isRewritingAutoResponder ? t("Reescribiendo SMS...", "Rewriting SMS...") : t("✨ Reescribir SMS (Nueva variante)", "✨ Rewrite SMS (Fresh variant)")}
                                   </button>
                                 </div>

                                 <button onClick={() => {
                                   const textToCopy = autoResponderSms || t("Hola, soy el asistente virtual. Lamento no poder atender tu llamada ahora. ¿En qué servicio necesitas ayuda? Te respondemos enseguida.", "Hi, I am the virtual assistant. I'm sorry I can't answer your call right now. What service do you need help with? We'll reply right away.");
                                   navigator.clipboard.writeText(textToCopy);
                                   showToast(t("¡SMS Auto-responder Copiado!", "Auto-responder SMS Copied!"), "success");
                                 }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                                   📋 {t("Copiar para Auto-Responder", "Copy for Auto-Responder")}
                                 </button>
                               </div>
                             </div>
                          </Card>
                        </div>
                      </div>
                    )}
                    {isFounderOrAdmin && activeSubRow === 6 && (
                      <div className="lg:col-span-3">
                        <OperatorProspectFunnel 
                          t={t} 
                          showToast={showToast} 
                          onNavigateReport={(repId) => {
                            setPublicFunnelReportId(repId);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'pricing' && (
               <section className="space-y-4 md:space-y-6">
                 <Header 
                   title={simpleMode ? t("💸 Calculadora Sencilla de Precios", "💸 Simple Price Calculator") : t("💸 Cotizador y Recargos", "💸 Estimator & Markups")} 
                   subtitle={t("Crea presupuestos en un toque, asegura tus márgenes y revisa tarifas locales.", "Create quick estimates, ensure profit margins and check local rates.")} 
                 />
                 
                 {renderSubTabs([
                   t("Presupuesto Exprés", "Quick Estimate"),
                   t("Recargo de Pasarela", "Gateway Fees"),
                   t("Brecha Competitiva", "Market Gap"),
                   t("Precios del Mercado", "Market Index")
                 ])}
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                   {(!isMobile || activeSubRow === 0) && (
                     <Card title={t("Presupuesto en WhatsApp", "WhatsApp Estimate")} icon={<Send size={16} className="text-emerald-500" />}>
                       <div className="space-y-4">
                         <div className="space-y-1">
                           <Input label={t("Nombre del Cliente", "Client Name")} value={estClientName} onChange={setEstClientName} placeholder={t("Ej. Ana García", "e.g. Jane Doe")} />
                           {estClientName.length > 0 && estClientName.trim().length < 2 && (
                             <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                               <AlertTriangle size={12} /> {t("⚠️ Ingrese un nombre de cliente válido (mín. 2 letras)", "⚠️ Enter a valid client name (min 2 letters)")}
                             </p>
                           )}
                         </div>
                         
                         <div className="space-y-1">
                           <Input label={t("Detalles del Trabajo", "Job Details")} value={estDetails} onChange={setEstDetails} placeholder={t("Ej. Pintura exterior de casa + Hidrolavado", "e.g. Exterior house painting + Pressure washing")} />
                           {estDetails.length > 0 && estDetails.trim().length < 3 && (
                             <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                               <AlertTriangle size={12} /> {t("⚠️ Detalle el trabajo a realizar (mín. 3 caracteres)", "⚠️ Detail the job (min 3 chars)")}
                             </p>
                           )}
                         </div>
                         
                         <div className="space-y-1">
                           <Input prefix="$" label={t("Total Estimado", "Estimated Total")} type="number" value={estPrice} onChange={setEstPrice} placeholder="1200.00" />
                           {estPrice !== '' && (Number(estPrice) <= 0 || isNaN(Number(estPrice))) && (
                             <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                               <AlertTriangle size={12} /> {t("⚠️ El precio estimado debe ser mayor a $0", "⚠️ Estimated total must be > $0")}
                             </p>
                           )}
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <button onClick={() => {
                             if(!estClientName || !estPrice || !estDetails) { showToast(t("Llena todos los campos", "Fill all fields"), "info"); return; }
                             const text = `Hola *${estClientName}* 👋,\n\nTe comparto el presupuesto estimado para:\n*${estDetails}*\n\n💰 *Total estimado:* $${estPrice}\n\nQuedo a tu disposición si tienes alguna duda.\nAtentamente, *${profile.name}*`;
                             window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                           }} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 text-xs">
                             <MessageCircle size={16} /> {t("WhatsApp", "WhatsApp")}
                           </button>
                           <button onClick={() => {
                             if(!estClientName || !estPrice || !estDetails) { showToast(t("Llena todos los campos", "Fill all fields"), "info"); return; }
                             const text = `Hola ${estClientName} 👋,\n\nTe comparto el presupuesto estimado para:\n${estDetails}\n\n💰 Total estimado: $${estPrice}\n\nQuedo a tu disposición si tienes alguna duda.\nAtentamente, ${profile.name}`;
                             window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
                           }} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-600/20 text-xs">
                             <MessageSquare size={16} /> {t("Enviar por SMS 💬", "Send via SMS 💬")}
                           </button>
                         </div>
                       </div>
                     </Card>
                   )}

                   {(!isMobile || activeSubRow === 1) && (
                     <Card title={simpleMode ? t("Calculadora de Comisiones", "Fee Calculator") : t("Calculadora de Recargo de Pasarelas", "Gateway Surcharge Calculator")}>
                       <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <Input prefix="$" label={t("Monto Base", "Base Amount")} type="number" value={calcBase} onChange={setCalcBase} />
                             {calcBase !== '' && (Number(calcBase) <= 0 || isNaN(Number(calcBase))) && (
                               <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-1">
                                 <AlertTriangle size={12} /> {t("⚠️ Monto > $0", "⚠️ Amount > $0")}
                               </p>
                             )}
                           </div>
                           <div>
                             <Input label={t("Impuesto / IVA (%)", "Tax / VAT (%)")} type="number" value={calcTax} onChange={setCalcTax} />
                             {calcTax !== '' && (Number(calcTax) < 0 || Number(calcTax) > 50 || isNaN(Number(calcTax))) && (
                               <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-1">
                                 <AlertTriangle size={12} /> {t("⚠️ Impuesto 0%-50%", "⚠️ Tax 0%-50%")}
                               </p>
                             )}
                           </div>
                         </div>
                         <div className="space-y-3">
                           <PriceRow label="Zelle / Cash" amount={surcharges.base} color="text-emerald-600 dark:text-emerald-400" />
                           <PriceRow label="Stripe / Card (Fee Inc)" amount={surcharges.stripe} color="text-indigo-600 dark:text-indigo-400" />
                           <PriceRow label="Bank Transfer" amount={surcharges.bank} color="text-amber-600 dark:text-amber-400" />
                         </div>
                         <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-black text-center">{t("Protege tu margen de ganancia", "Protect your profit margin")}</p>
                       </div>
                     </Card>
                   )}
  
                   {(!isMobile || activeSubRow === 2) && (
                     <Card title={simpleMode ? t("Comparar con la Competencia", "Compare to Competitors") : t("Simulador de Brecha en el Mercado", "Market Gap Simulator")} icon={<Calculator size={16} className="text-rose-600 dark:text-rose-400" />}>
                        <div className="space-y-5">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("Compara tus opiniones/reseñas con tu competidor más cercano para estimar tu tiempo de liderazgo.", "Compare your review stats with your nearest competitor to see when you will lead.")}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <Input label={t("Mis Reseñas", "My Reviews")} placeholder="Ej. 12" value={myReviews} onChange={setMyReviews} />
                            <Input label={t("Competidor / Competencia", "Competitor Reviews")} placeholder="Ej. 45" value={compReviews} onChange={setCompReviews} />
                          </div>
                          <button onClick={calculateMarketGap} disabled={isGapLoading} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50">{isGapLoading ? t("Ejecutando Simulador...", "Running Simulator...") : t("Simular Oportunidad", "Simulate Opportunity")}</button>
                          {isGapLoading && (
                            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center animate-pulse space-y-2 mt-4">
                              <div className="w-6 h-6 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mx-auto"></div>
                              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold tracking-wide">{gapLoadingStep}</p>
                            </div>
                          )}
                          {gapResult && !isGapLoading && (
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl mt-4">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 text-center">{gapResult}</p>
                            </div>
                          )}
                         </div>
                      </Card>
                   )}
                 </div>
    
                 {/* Competitive Price Insight Thermometer */}
                 {(!isMobile || activeSubRow === 3) && estPrice && Number(estPrice) > 0 && (
                   <div className="mt-6 mb-6">
                     <Card title={t("🌡️ Termómetro de Competitividad", "🌡️ Competitiveness Thermometer")}>
                        <div className="space-y-6">
                          <p className="text-xs text-slate-500">{t("Análisis pasivo: Según tarifas de tu categoría, ¿estás cobrando caro o barato para tu zona?", "Passive Analysis: Based on rates in your category, are you pricing high or low for your area?")}</p>
                          <div className="relative pt-6 pb-2">
                             <div className="h-4 bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 rounded-full w-full relative">
                                {/* Marker */}
                                <div 
                                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-8 bg-slate-900 dark:bg-white rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] border-2 border-white dark:border-slate-900"
                                  style={{ left: `${Math.min(100, Math.max(0, (Number(estPrice) / 2000) * 100))}%` }}
                                ></div>
                                <div 
                                  className="absolute -top-7 -translate-x-1/2 font-black text-xs text-slate-700 dark:text-slate-300 transition-all font-mono bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-200 dark:border-slate-700"
                                  style={{ left: `${Math.min(100, Math.max(0, (Number(estPrice) / 2000) * 100))}%` }}
                                >
                                  ${estPrice}
                                </div>
                             </div>
                             <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mt-3 px-1">
                                <span>{t("Económico", "Budget")}</span>
                                <span>{t("Promedio Local", "Local Avg")}</span>
                                <span>{t("Premium", "Premium")}</span>
                             </div>
                          </div>
                        </div>
                     </Card>
                   </div>
                 )}

                 {/* Dynamic Local UGC / Crowdsourcing Price Index */}
                 {(!isMobile || activeSubRow === 3) && (
                   <div className="mt-6">
                     <Card 
                       title={simpleMode 
                         ? t(`📊   Tarifas de Referencia en ${profile.location || profile.city || 'tu mercado local'}`, `📊   Reference Pricing in ${profile.location || profile.city || 'your local market'}`)
                         : t(`📊   Índice de Precios para ${profile.category || 'Servicios'} en ${profile.location || profile.city || 'tu mercado local'}`, `📊   Price Index for ${profile.category || 'Services'} in ${profile.location || profile.city || 'your local market'}`)
                       } 
                       icon={<Star className="text-rose-500 animate-pulse" />}
                     >
                        <div className="space-y-6">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-black">
                            {simpleMode 
                              ? t("Muestra tarifas promedio recopiladas localmente de manera segura y totalmente confidencial.", "Shows local average prices compiled securely and confidentially.")
                              : t(`Este índice dinámico unifica tarifas del mercado de ${profile.category || 'servicios'} en ${profile.location || profile.city || 'tu mercado local'} de manera 100% anónima para calcular márgenes reales.`, `This dynamic index unifies pricing in the ${profile.category || 'services'} market around ${profile.location || profile.city || 'your local market'} 100% anonymously to estimate true margins.`)
                            }
                          </p>
    
                          {showCostToast && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl text-[10px] text-emerald-400 font-bold animate-bounce flex items-center gap-2">
                              <CheckCircle size={12} className="text-emerald-500 shrink-0" /> {t("¡Tarifa agregada con éxito! Tu colaboración fue guardada en el mercado local unificado de ${profile.location || profile.city || 'tu mercado local'}.", "Rate added successfully! Your contribution was saved to the unified local ${profile.location || profile.city || 'your local market'} market.")}
                            </div>
                          )}
    
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Costs index list */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                                  {profile?.location 
                                    ? t(`Precios de Referencia del Sector (${profile.location})`, `Industry Benchmark Rates (${profile.location})`)
                                    : t("Precios de Referencia del Sector", "Industry Benchmark Rates")}
                                </h4>
                                <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                  {t("MODELADO", "MODELED")}
                                </span>
                              </div>
                              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                                {ugcCosts.map((item) => {
                                  let taskName = item.task;
                                  if (item.task === 'Revestimiento y Acabados de Superficies' || item.task === 'Surface Coating & Finishing') {
                                    taskName = t('Revestimiento y Acabados de Superficies', 'Surface Coating & Finishing');
                                  } else if (item.task === 'Servicio Mantenimiento Técnico Preventivo' || item.task === 'Preventive Technical Maintenance') {
                                    taskName = t('Servicio de Mantenimiento Técnico Preventivo', 'Preventive Technical Maintenance');
                                  } else if (item.task === 'Soporte y Monitoreo Recurrente Mensual' || item.task === 'Monthly Recurring Support & Monitoring') {
                                    taskName = t('Soporte y Monitoreo Recurrente Mensual', 'Monthly Recurring Support & Monitoring');
                                  } else if (item.task === 'Instalación de Iluminación LED Inteligente' || item.task === 'Smart LED Lighting Installation') {
                                    taskName = t('Instalación de Iluminación LED Inteligente', 'Smart LED Lighting Installation');
                                  } else if (item.task === 'Diagnóstico de Distribución y Reparación' || item.task === 'Distribution & Repair Diagnostics') {
                                    taskName = t('Diagnóstico de Distribución y Reparación', 'Distribution & Repair Diagnostics');
                                  }

                                  let unitName = item.unit;
                                  if (item.unit === 'sq ft') {
                                    unitName = t('sq ft', 'sq ft');
                                  } else if (item.unit === 'hora' || item.unit === 'hour') {
                                    unitName = t('hora', 'hour');
                                  } else if (item.unit === 'mes' || item.unit === 'month') {
                                    unitName = t('mes', 'month');
                                  } else if (item.unit === 'unidad' || item.unit === 'unit') {
                                    unitName = t('unidad', 'unit');
                                  } else if (item.unit === 'visita' || item.unit === 'visit') {
                                    unitName = t('visita', 'visit');
                                  }

                                  return (
                                    <div key={item.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl flex flex-col gap-1 shadow-sm font-mono">
                                      <div className="flex justify-between items-center text-[11px] font-sans">
                                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{taskName}</span>
                                        <span className="font-extrabold text-indigo-400 shrink-0">${item.average.toFixed(2)} <span className="text-[8px] font-normal text-slate-500 font-sans">/{unitName}</span></span>
                                      </div>
                                      <div className="flex justify-between items-center text-[9px] text-slate-500">
                                        <span>{t("Mín local", "Local Min")}: ${item.min?.toFixed(2) || '1.10'}</span>
                                        <span>{t("Máx local", "Local Max")}: ${item.max?.toFixed(2) || '2.90'}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
    
                            {/* Add contribution form */}
                            <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-850 p-5 rounded-[2rem] space-y-4 font-sans">
                              <h4 className="text-[10px] uppercase font-black tracking-wider text-slate-400">{t("Contribuir Nueva Tarifa (UGC Anónimo)", "Contribute New Rate (Anonymous UGC)")}</h4>
                              <form onSubmit={addUgcContribution} className="space-y-3">
                                <div>
                                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1 font-sans">{t("Nombre del Servicio o Tarea", "Service or Task Name")}</label>
                                  <input 
                                    type="text" 
                                    placeholder={t("Ej. Trimming de Sea Grapes", "e.g. Sea Grapes Trimming")} 
                                    value={newUgcTask} 
                                    onChange={e => setNewUgcTask(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-505"
                                    required
                                 />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">{t("Costo Promedio ($)", "Average Cost ($)")}</label>
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      placeholder={t("Ej. 75", "e.g. 75")} 
                                      value={newUgcAvg} 
                                      onChange={e => setNewUgcAvg(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-55"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">{t("Unidad de Medida", "Unit of Measurement")}</label>
                                    <select 
                                      value={newUgcUnit} 
                                      onChange={e => setNewUgcUnit(e.target.value)}
                                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
                                    >
                                      <option value="sq ft">{t("sq ft (Pies Cuadrados)", "sq ft (Square Feet)")}</option>
                                      <option value="tree">{t("tree (Por Planta/Árbol)", "tree (per Plant/Tree)")}</option>
                                      <option value="cu yd">{t("cu yd (Yarda Cúbica)", "cu yd (Cubic Yard)")}</option>
                                      <option value="month">{t("month (Contrato Mensual)", "month (Monthly Contract)")}</option>
                                      <option value="hour">{t("hour (Costo por Hora)", "hour (Hourly Rate)")}</option>
                                    </select>
                                  </div>
                                </div>
    
                                <button 
                                  type="submit" 
                                  className="w-full mt-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-rose-600/10 text-xs cursor-pointer"
                                >
                                  📤 {t("Enviar Datos de Tarifa", "Submit Rate Data")}
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                     </Card>
                   </div>
                 )}
               </section>
             )}

             {activeTab === 'growth' && (
               <section className="space-y-6">
                 {/* HERRAMIENTA 3-EN-1: DIAGNÓSTICO, ANUNCIOS Y RESPUESTAS A RESEÑAS */}
                 <Card title={t("⚡ Generador Automático de Clientes y Reputación Google Maps", "⚡ Automatic Google Maps Client & Reputation Generator")} icon={<Sparkles size={20} className="text-indigo-600 animate-pulse" />}>
                   <div className="space-y-6">
                     <div className="bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 p-5 rounded-2xl border border-indigo-500/20">
                       <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                         {t(
                           "Con 1 solo clic analizamos cómo está posicionado tu negocio en Google Maps, calculamos cuánto dinero estás perdiendo frente a tu competencia y creamos al instante tus anuncios persuasivos para redes sociales y tus respuestas optimizadas para reseñas.",
                           "With 1 single click, we analyze your Google Maps positioning, calculate lost revenue compared to local competitors, and instantly generate persuasive social media ads and SEO-optimized review replies."
                         )}
                       </p>
                     </div>

                     {/* AGENTE 9: DEMO INTERACTIVA Y PERSONALIZADOR DE ONBOARDING */}
                     <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                           ⚡ {t("Demo Instantánea: Gancho de Conversión Onboarding", "Instant Demo: Onboarding Conversion Hook")}
                         </span>
                         <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full uppercase">
                           {t("Ultra Rápido (Lightweight)", "Ultra Fast (Lightweight)")}
                         </span>
                       </div>
                       <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                         {t(
                           "Genera al instante frases gancho psicológicas súper persuasivas y un resumen estratégico adaptado a tu ciudad para tus clientes potenciales en segundos. Sin necesidad de esperar el escaneo completo.",
                           "Instantly generate highly persuasive psychological hooks and a strategic market summary customized for your prospect in seconds. No need to wait for a full scan."
                         )}
                       </p>

                       {isOnboardingHookLoading ? (
                         <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex flex-col items-center justify-center text-center space-y-2 py-6">
                           <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                           <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 animate-pulse">{onboardingLoadingStep}</p>
                         </div>
                       ) : onboardingHookResult ? (
                         <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-indigo-100 dark:border-indigo-950">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                             <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                               <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                                 🎯 {t("Gancho Universal (Reseñas):", "Universal Hook (Reviews):")}
                               </span>
                               <p className="italic text-slate-700 dark:text-slate-300">"{onboardingHookResult.hook_universal}"</p>
                             </div>
                             <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-lg border border-indigo-100/50 dark:border-indigo-900/10 space-y-1">
                               <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                                 🔥 {t("Gancho Específico de Nicho:", "Niche-Specific Hook:")}
                                </span>
                               <p className="italic text-slate-700 dark:text-slate-300">"{onboardingHookResult.hook_niche_specific}"</p>
                             </div>
                           </div>
                           <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                             <span className="font-black text-indigo-600 dark:text-indigo-400 block">
                               📈 {t("Resumen de Mercado y Plan Competitivo:", "Market Summary & Competitive Plan:")}
                             </span>
                             <p className="text-slate-700 dark:text-slate-300">{onboardingHookResult.competitive_teaser}</p>
                           </div>
                           <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-lg border border-emerald-100/30 dark:border-emerald-950/20 text-xs space-y-1">
                             <span className="font-black text-emerald-700 dark:text-emerald-400 block">
                               🚀 {t("Llamado a la Acción Recomendado:", "Recommended Call to Action:")}
                             </span>
                             <p className="text-emerald-700 dark:text-emerald-400 font-bold">{onboardingHookResult.suggested_action_call}</p>
                           </div>

                           <div className="pt-2 flex flex-col sm:flex-row gap-2">
                             <button
                               onClick={runOnboardingHookScan}
                               className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer"
                             >
                               🔄 {t("Regenerar Gancho", "Regenerate Hook")}
                             </button>
                             <button
                               onClick={runMultiAgentGrowthEngine}
                               className="flex-1 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/15 relative overflow-hidden"
                               style={{ boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}
                             >
                               {t("🚀 Gatillar Escaneo Completo", "🚀 Trigger Full Scan")}
                             </button>
                           </div>
                         </motion.div>
                       ) : (
                         <button
                           onClick={runOnboardingHookScan}
                           className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs"
                         >
                           <Sparkles size={14} />
                           <span>{t("✨ Generar Gancho Demostrativo Instantáneo", "✨ Generate Instant Demo Hook")}</span>
                         </button>
                       )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                           {t("💬 Última reseña de un cliente:", "💬 Latest customer review:")}
                         </label>
                         <textarea
                           value={sampleReviewForAgent}
                           onChange={(e) => setSampleReviewForAgent(e.target.value)}
                           rows={3}
                           placeholder={t("Ejemplo: Excelente servicio instalando la tubería de mi casa, muy puntuales...", "Example: Great service fixing my kitchen sink, very professional...")}
                           className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                         />
                       </div>

                       <div>
                         <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                           {t("📲 Objeción o Mensaje de WhatsApp:", "📲 Lead Objection or WhatsApp message:")}
                         </label>
                         <textarea
                           value={whatsappMessageForAgent}
                           onChange={(e) => setWhatsappMessageForAgent(e.target.value)}
                           rows={3}
                           placeholder={t("Ejemplo: Su presupuesto es un poco elevado comparado con la otra compañía local...", "Example: Your estimate is quite a bit higher than the other company...")}
                           className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                         />
                       </div>
                     </div>

                     <button
                       onClick={runMultiAgentGrowthEngine}
                       disabled={isMultiAgentLoading}
                       className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/10 transition cursor-pointer text-sm"
                     >
                       {isMultiAgentLoading ? (
                         <>
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           <span>{t("Analizando tu mercado y creando estrategias...", "Analyzing market and building strategies...")}</span>
                         </>
                       ) : (
                         <>
                           <Zap size={18} />
                           <span>{t("✨ Analizar Mi Negocio y Crear Estrategia Ahora", "✨ Analyze My Business & Create Strategy Now")}</span>
                         </>
                       )}
                     </button>

                     {multiAgentResult && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                         {/* Cache and Rate Limit Status Indicators (Phase E) */}
                         {multiAgentResult.message && (
                           <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                             multiAgentResult.isRateLimited 
                               ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200"
                               : "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/40 text-sky-900 dark:text-sky-200"
                           }`}>
                             <span className="text-lg">{multiAgentResult.isRateLimited ? "⚠️" : "ℹ️"}</span>
                             <div className="space-y-1">
                               <p className="text-xs font-black uppercase tracking-wider">
                                 {multiAgentResult.isRateLimited ? t("Límite de Consultas / Saturación de IA", "API Rate Limit / AI Saturation") : t("Información del Sistema", "System Information")}
                               </p>
                               <p className="text-xs leading-relaxed opacity-90">{multiAgentResult.message}</p>
                             </div>
                           </div>
                         )}

                         {multiAgentResult.fromCache && (
                           <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                             <span className="text-sm">⚡</span>
                             <span className="text-xs font-semibold">
                               {t("Resultados cargados instantáneamente desde la caché inteligente de hoy.", "Results loaded instantly from today's smart cache.")}
                             </span>
                           </div>
                         )}

                         {/* Diagnóstico de Mercado */}
                         <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-2">
                           <div className="flex items-center justify-between">
                             <span className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                               📊 {t("1. Diagnóstico Inteligente de Tu Mercado", "1. Smart Market Diagnosis")}
                             </span>
                             <span className="text-xs font-black bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 rounded-full">
                               {scrappedLeads && scrappedLeads.length === 0
                                 ? t("Sin competidores: $0/semana", "0 competitors: $0/week")
                                 : `${t("Dinero en Juego:", "Revenue at Risk:")} $${multiAgentResult.audit?.loss_estimate || 0}/semana`}
                             </span>
                           </div>
                           <p className="text-xs text-slate-700 dark:text-slate-300">
                             <strong>{t("Competidor Líder en tu Zona:", "Leading Competitor in Area:")}</strong>{" "}
                             {scrappedLeads && scrappedLeads.length === 0
                               ? t("Sin competidores detectados (Liderazgo total)", "No competitors detected (Total leadership)")
                               : multiAgentResult.audit?.target_competitor || "—"}{" "}
                             ({scrappedLeads && scrappedLeads.length === 0 ? t("Dificultad: Baja", "Difficulty: Low") : multiAgentResult.audit?.market_difficulty || "—"})
                           </p>
                           <div className="text-xs text-slate-700 dark:text-slate-300">
                             <strong>{t("Oportunidades Inmediatas para Rebasarlo:", "Immediate Opportunities to Surpass Them:")}</strong>
                             <ul className="list-disc pl-5 mt-1 space-y-0.5">
                               {scrappedLeads && scrappedLeads.length === 0 ? (
                                 <li>{t("¡Excelente! Al no tener competidores locales directos en esta categoría, puedes consolidar tu presencia registrando publicaciones periódicas y optimizando tu perfil con Bvelt para blindar tu zona.", "Excellent! With no direct local competitors in this category, you can secure your domain by publishing regular updates and optimizing your profile with Bvelt.")}</li>
                               ) : (
                                 multiAgentResult.audit?.critical_gaps?.map((gap, idx) => (
                                   <li key={idx}>{gap}</li>
                                 ))
                               )}
                             </ul>
                           </div>
                         </div>

                         {/* Anuncio Listo para Facebook / Instagram */}
                         <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-2xl space-y-2">
                           <div className="flex items-center justify-between">
                             <span className="text-xs font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                               📢 {t("2. Tu Anuncio Persuasivo (Listo para Publicar)", "2. Your Persuasive Ad (Ready to Post)")}
                             </span>
                             <button
                               onClick={() => copyToClipboard(multiAgentResult.adCopy)}
                               className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                             >
                               <Copy size={12} /> {t("Copiar Anuncio", "Copy Ad")}
                             </button>
                           </div>
                           <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 font-medium">
                             {multiAgentResult.adCopy}
                           </p>
                         </div>

                         
                          {/* Respuesta para Reseña en Google Maps */}
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                             <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                               ⭐ {t("3. Respuesta Optimizada para Google Maps", "3. Optimized Google Maps Review Reply")}
                             </span>
                             <button
                               onClick={() => copyToClipboard(multiAgentResult.reputationReply)}
                               className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                             >
                               <Copy size={12} /> {t("Copiar Respuesta", "Copy Reply")}
                             </button>
                           </div>
                           <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900 font-medium">
                             {multiAgentResult.reputationReply}
                            </p>
                          </div>

                          {/* Publicación SEO para Google Business Profile */}
                          {multiAgentResult.gbpPost && (
                            <Accordion 
                                title={t("4. Publicación SEO para Google Business Profile", "4. Google Business Profile SEO Post")}
                                contentToCopy={multiAgentResult.gbpPost}
                                t={t}
                            >
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900 font-medium">
                                    {multiAgentResult.gbpPost}
                                </p>
                            </Accordion>
                          )}
                          {/* Correo B2B de Captación de Clientes */}
                          {multiAgentResult.outreachEmail && (
                            <Accordion 
                                title={t("5. Correo B2B / DM de Captación Directa", "5. B2B Outreach Email / Direct Pitch")}
                                contentToCopy={multiAgentResult.outreachEmail}
                                t={t}
                                allowEmailSend={true}
                                agentType="b2b_outreach"
                                emailSubject={t("Propuesta Comercial de Colaboración", "Business Collaboration Proposal")}
                                businessName={profile.name || "Bvelt"}
                            >
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-100 dark:border-purple-900 font-medium">
                                    {multiAgentResult.outreachEmail}
                                </p>
                            </Accordion>
                          )}
                          {/* 👤 Agente 6: El Generador de Estimaciones y Propuestas Inteligentes */}
                          {multiAgentResult.proposalEstimate && (
                            <Accordion 
                                title={t("6. Generador de Estimaciones y Propuestas de Obra", "6. Project Estimate & Formal Proposal")}
                                contentToCopy={multiAgentResult.proposalEstimate}
                                t={t}
                                allowEmailSend={true}
                                agentType="proposal_estimate"
                                emailSubject={t("Propuesta Formal y Estimación de Proyecto", "Formal Proposal & Project Estimate")}
                                businessName={profile.name || "Bvelt"}
                            >
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-100 dark:border-rose-900 font-medium">
                                    {multiAgentResult.proposalEstimate}
                                </p>
                            </Accordion>
                          )}
                          {/* 👤 Agente 7: El Optimizador de Mensajes para Cierre por WhatsApp/SMS */}
                          {multiAgentResult.whatsappCloser && (
                            <Accordion 
                                title={t("7. Optimizador de Cierre para WhatsApp / SMS (3 Guiones de Venta)", "7. WhatsApp / SMS Sales Closer (3 Sales Scripts)")}
                                contentToCopy={multiAgentResult.whatsappCloser}
                                t={t}
                            >
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-teal-100 dark:border-teal-900 font-medium">
                                    {multiAgentResult.whatsappCloser}
                                </p>
                            </Accordion>
                          )}
                          {/* 👤 Agente 8: El Redactor de Casos de Éxito / Post-Mortem de Proyectos */}
                          {multiAgentResult.caseStudy && (
                            <Accordion 
                                title={t("8. Redactor de Casos de Éxito y Portafolio Local (Social Proof)", "8. Local Success Story & Case Study Writer (Social Proof)")}
                                contentToCopy={multiAgentResult.caseStudy}
                                t={t}
                            >
                                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-violet-100 dark:border-violet-900 font-medium">
                                    {multiAgentResult.caseStudy}
                                </p>
                            </Accordion>
                          )}

                          {/* 👤 Agente 9: El Gancho Demostrativo y Personalizador de Onboarding */}
                          {multiAgentResult.onboardingHook && (
                            <Accordion 
                                title={t("⚡ 9. Gancho de Conversión y Resumen Estratégico", "⚡ 9. Onboarding Hook & Strategic Summary")}
                                contentToCopy={`Universal Hook: ${multiAgentResult.onboardingHook.hook_universal}\nNiche Specific Hook: ${multiAgentResult.onboardingHook.hook_niche_specific}\nCompetitive Teaser: ${multiAgentResult.onboardingHook.competitive_teaser}\nCall to Action: ${multiAgentResult.onboardingHook.suggested_action_call}`}
                                t={t}
                            >
                                <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs font-medium text-slate-800 dark:text-slate-200 text-left">
                                  <div>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                                      🎯 {t("Gancho Universal (Resolver dolor de reseñas):", "Universal Hook (Resolve review pain):")}
                                    </span>
                                    <p className="italic bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                      "{multiAgentResult.onboardingHook.hook_universal}"
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                                      🔥 {t("Gancho Específico de Nicho:", "Niche-Specific Hook:")}
                                    </span>
                                    <p className="italic bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                                      "{multiAgentResult.onboardingHook.hook_niche_specific}"
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                                      📈 {t("Resumen de Mercado y Plan Competitivo:", "Market Summary & Competitive Plan:")}
                                    </span>
                                    <p className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                      {multiAgentResult.onboardingHook.competitive_teaser}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                                      🚀 {t("Llamado a la Acción Recomendado:", "Recommended Call to Action:")}
                                    </span>
                                    <p className="bg-emerald-50/50 dark:bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold">
                                      {multiAgentResult.onboardingHook.suggested_action_call}
                                    </p>
                                  </div>
                                </div>
                            </Accordion>
                          )}

                        </motion.div>
                     )}
                   </div>
                 </Card>

                 <Header 
                    title={t("📈 Dominio Local & SEO", "📈 Local Dominance & SEO")} 
                    subtitle={t("Herramientas para ser el #1 en Google Maps en tu ciudad.", "Tools to be #1 on Google Maps in your city.")} 
                 />

                 {/* ALWAYS VISIBLE LEAD MAGNET (SEO AUDIT) */}
                 <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-[2.5rem] border-2 border-indigo-100 dark:border-indigo-900 shadow-xl shadow-indigo-500/5 mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex-1 space-y-4">
                        <h4 className="text-xl font-black text-indigo-700 dark:text-indigo-400 tracking-tight flex items-center gap-2">
                          <Sparkles size={24} /> {t("¿Quieres ser el #1 en Google Maps?", "Want to be #1 on Google Maps?")}
                        </h4>
                        <p className="text-sm text-indigo-600/70 dark:text-indigo-400/70 font-medium">
                          {t("Analizamos a tus competidores y detectamos fallas en tu perfil local instantáneamente.", "We analyze your competitors and detect flaws in your local profile instantly.")}
                        </p>
                      </div>
                      <div className="w-full md:w-auto">
                        <button 
                          onClick={runSeoAudit} 
                          disabled={isSeoLoading}
                          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition cursor-pointer shadow-2xl shadow-indigo-600/30 text-base scale-105 active:scale-95 whitespace-nowrap"
                        >
                          {isSeoLoading ? t("Analizando mercado...", "Analyzing market...") : <><Activity size={20} /> {t("Ejecutar Auditoría SEO Gratis ✨", "Run Free SEO Audit ✨")}</>}
                        </button>
                      </div>
                    </div>
                 </div>

                 {isSeoLoading && (
                   <Card title={t("🔍 Evaluando Posicionamiento y Competidores...", "🔍 Evaluating Maps Ranking & Competitors...")} icon={<Activity size={18} className="text-indigo-600 animate-spin" />}>
                     <div className="space-y-6 p-2">
                       <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40">
                         <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl shrink-0" variant="rect" />
                         <div className="flex-1 space-y-3 w-full">
                           <Skeleton className="w-1/2 h-5" variant="text" />
                           <Skeleton className="w-full h-4" variant="text" />
                           <Skeleton className="w-3/4 h-3" variant="text" />
                           <Skeleton className="w-full h-3" variant="rect" />
                         </div>
                       </div>
                       <div className="space-y-3">
                         <Skeleton className="w-40 h-4" variant="text" />
                         <ListSkeleton count={3} />
                       </div>
                     </div>
                   </Card>
                 )}

                 {seoScore !== 65 && !isSeoLoading && (
                 <Card title={t("🔍 Resultados de Auditoría", "🔍 Audit Results")} icon={<Filter size={18} className="text-indigo-600" />}>
                   <div className="space-y-4">
                     <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/40 mb-2">
                       <div className="flex flex-col items-center justify-center bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border border-indigo-100/80 dark:border-indigo-800/80 shadow-md transform hover:scale-105 transition shrink-0 p-3 text-center">
                          <span className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-widest leading-none mb-1">Score</span>
                          <span className={`text-4xl sm:text-5xl font-black tracking-tighter ${seoScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {seoScore >= 95 ? 'A+' : seoScore >= 90 ? 'A' : seoScore >= 85 ? 'B+' : seoScore >= 80 ? 'B' : seoScore >= 75 ? 'C+' : seoScore >= 70 ? 'C' : seoScore >= 60 ? 'D' : 'F'}
                          </span>
                       </div>
                       <div className="flex-1 text-center sm:text-left w-full">
                          <h5 className="text-sm font-black text-slate-800 dark:text-white mb-0.5">
                            {seoScore > 80 ? t("¡Tienes buen potencial!", "Great local footprint!") : t("¡Tu perfil necesita trabajo urgente!", "Your profile needs hands-on work!")}
                          </h5>
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                            {t("Muéstrale este Score de Google Maps a tu prospecto. Un perfil con calificación baja es tu mejor gancho de ventas para cerrar el contrato de Bvelt en segundos.", "Show this Google Maps Score to your prospect. A lower visual grade is your strongest sales hook to close the Bvelt contract in seconds.")}
                          </p>
                          <div className="flex items-center justify-between mb-1">
                             <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("Tu Optimización Local", "Your Local Optimization")}</span>
                             <span className="text-xs font-black text-slate-600 dark:text-slate-400">{seoScore}%</span>
                          </div>
                          <div className="w-full bg-slate-150 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }} 
                               animate={{ width: `${seoScore}%` }} 
                               className={`h-full ${seoScore > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                             />
                          </div>
                       </div>
                     </div>

                     {seoAudit.length > 0 && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2" id="organic-growth-plan-section">
                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{t("Plan de Crecimiento Orgánico (Puntos Críticos Detectados)", "Organic Growth Plan (Critical Issues Detected)")}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {seoAudit.slice(0, 4).map((line, i) => (
                              <div key={i} className="flex flex-col justify-between text-xs text-slate-700 dark:text-slate-300 bg-red-500/[0.03] dark:bg-red-500/[0.02] p-4 rounded-2xl border border-red-500/10 dark:border-red-500/10 group transition hover:border-red-500/20 dark:hover:border-red-500/20">
                                <div className="flex gap-3">
                                  <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-red-100/70 dark:bg-red-950/50 text-red-600 dark:text-red-400 shrink-0">
                                    <AlertCircle size={14} className="animate-pulse" />
                                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                    </span>
                                  </div>
                                  <p className="leading-relaxed font-semibold text-slate-850 dark:text-slate-200">{line}</p>
                                </div>
                                <div className="mt-3 pt-2.5 border-t border-red-500/5 dark:border-red-500/5 flex justify-end">
                                  <button
                                    onClick={() => handleAutoFixSeo(line)}
                                    disabled={isAutoFixingSeo !== null}
                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-[10px] font-black tracking-tight text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-200/50 dark:border-indigo-800/50 shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                                  >
                                    {isAutoFixingSeo === line ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                        <span>{t("Corrigiendo...", "Fixing...")}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={11} className="text-amber-500" />
                                        <span>{t("Corregir automáticamente", "Auto-Fix Issue")}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl">
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-1">
                              <Sparkles size={12} /> {t("Tip Pro de Google Maps", "Google Maps Pro Tip")}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                              {t("Publicar fotos periódicas en tu ficha con menciones de tu zona refuerza la frescura y relevancia geográfica de tu perfil local.", "Posting periodic photos on your profile with local zone mentions reinforces freshness and geographic relevance.")}
                            </p>
                          </div>
                       </motion.div>
                     )}
                   </div>
                 </Card>
                 )}

                 {renderSubTabs([
                   t("Radar & SEO Local", "Authority Radar"),
                   t("Hack de Posicionamiento", "Geo-tagging Hack"),
                   t("Impacto ROI", "ROI Impact"),
                   t("Auditoría de Perfil", "Profile Audit 📋")
                 ])}

                 <div className="grid grid-cols-1 gap-6">
                   {activeSubRow === 0 && (
                     <section className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Card title={profile.location ? t(`📡 Radar de Visibilidad en ${profile.location}`, `📡 Visibility Radar in ${profile.location}`) : t("📡 Radar de Visibilidad (Inactivo)", "📡 Visibility Radar (Inactive)")} icon={<MapIcon size={18} className="text-indigo-600" />}>
                              {!profile.location ? (
                                <div className="py-12 text-center space-y-4 opacity-70">
                                  <MapIcon size={48} className="mx-auto text-slate-400" />
                                  <p className="text-sm font-bold text-slate-500">{t("Esperando Datos de Sincronización...", "Awaiting Sync Data...")}</p>
                                  <p className="text-xs text-slate-400">{t("Configura tu ciudad en el perfil para activar el radar.", "Setup your city in the profile to activate the radar.")}</p>
                                </div>
                              ) : (
                              <div className="space-y-6">
                                 {[
                                   { area: t('Centro / Downtown', 'Downtown'), score: 92, status: t('Dominando', 'Dominating') },
                                   { area: t('Zona Norte', 'North Zone'), score: 45, status: t('Creciendo', 'Growing') },
                                   { area: t('Zona Industrial', 'Industrial Zone'), score: 12, status: t('Bajo', 'Low') },
                                   { area: t('Distrito Comercial', 'Commercial District'), score: 78, status: t('Alto', 'High') }
                                 ].map((item, i) => (
                                   <div key={i} className="space-y-2">
                                     <div className="flex justify-between items-center text-xs">
                                       <span className="font-bold text-slate-700 dark:text-slate-300">{item.area}</span>
                                       <span className={`font-black ${item.score > 70 ? 'text-emerald-500' : item.score > 30 ? 'text-amber-500' : 'text-rose-500'}`}>{item.status} ({item.score}%)</span>
                                     </div>
                                     <div className="w-full bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                       <motion.div 
                                         initial={{ width: 0 }} 
                                         animate={{ width: `${item.score}%` }} 
                                         className={`h-full ${item.score > 70 ? 'bg-emerald-500' : item.score > 30 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                       />
                                     </div>
                                   </div>
                                 ))}
                                 <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                      {t("* Este radar estima tu relevancia en búsquedas locales basado en la densidad de tus reseñas y menciones geográficas en fotos.", "* This radar estimates your local search relevance based on review density and geographic mentions in photos.")}
                                    </p>
                                 </div>
                              </div>
                              )}
                           </Card>

                           <Card title={t("🏆 Comparativa Maps #1 vs Tú", "🏆 Maps Comparison #1 vs You")} icon={<ChartLine size={18} className="text-indigo-600" />}>
                             <div className="space-y-5">
                                <p className="text-xs text-slate-600 dark:text-slate-400">{t("Analiza cuántas reseñas faltan para superar al líder local.", "Analyze how many reviews are needed to beat the local leader.")}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                                     <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{t("Mis Opiniones", "My Reviews")}</p>
                                     {myReviews ? <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{myReviews}</p> : <p className="text-sm font-bold text-slate-400 mt-2">---</p>}
                                  </div>
                                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                                     <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{t("Líder Local", "Local Leader")}</p>
                                     {compReviews ? <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{compReviews}</p> : <p className="text-sm font-bold text-slate-400 mt-2">---</p>}
                                  </div>
                                </div>
                                <button onClick={calculateMarketGap} disabled={isGapLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/20 disabled:opacity-50">{isGapLoading ? t("Analizando Crecimiento...", "Evaluating Growth...") : t("Simular Crecimiento de Maps 🚀", "Simulate Maps Growth 🚀")}</button>
                                {isGapLoading && (
                                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center animate-pulse space-y-3">
                                    <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold tracking-wider">{gapLoadingStep}</p>
                                  </div>
                                )}
                                {gapResult && !isGapLoading && (
                                  <div className="bg-indigo-50 dark:bg-indigo-950/40 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/30 text-center">
                                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 whitespace-pre-line">{gapResult}</p>
                                  </div>
                                )}
                             </div>
                           </Card>
                        </div>
                     </section>
                   )}
                   
                   {activeSubRow === 1 && (
                     <section className="space-y-6">
                        <Card title={t("📍 Inyectar Datos GPS a Fotos", "📍 Inject GPS Data to Photos")} icon={<MapIcon size={18} className="text-rose-600 dark:text-rose-400" />}>
                          <div className="space-y-5">
                            <p className="text-xs text-slate-500">{t("Subir fotos a Google Maps con coordenadas GPS incrustadas en el archivo le da una señal directa a Google de que tu negocio opera en esas ubicaciones geográficas reales.", "Uploading photos to Google Maps with embedded GPS coordinates gives a direct signal to Google that your business operates in those real geographic locations.")}</p>
                            
                            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                              <ImageIcon size={32} className="text-indigo-400 mx-auto mb-3" />
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t("Subir foto de un trabajo completado", "Upload photo of a completed job")}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{t("(Simulación de inyección de metadatos)", "(Metadata injection simulation)")}</p>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-2">{t("Configurar Geo-Etiqueta", "Configure Geo-Tag")}</p>
                              <CityAutocomplete label={t("Ciudad de la foto (Ej. Tu Ciudad Local)", "Photo City (e.g. Local City)")} placeholder={t("Donde hiciste el trabajo", "Where you did the job")} value="" onChange={() => {}} />
                              <button onClick={() => showToast(t("Foto geo-etiquetada correctamente. Lista para subir a tu perfil de Google.", "Photo geo-tagged successfully. Ready to upload to your Google profile."), "success")} className="w-full mt-3 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-rose-600/20">{t("Inyectar Datos y Descargar", "Inject Data & Download")}</button>
                            </div>
                          </div>
                        </Card>
                     </section>
                   )}

                   {activeSubRow === 2 && (
                     <section className="space-y-6 pb-12">
                        <Card title={t("📊 Comparativa de Impacto (Antes vs Ahora)", "📊 Impact Comparison (Before vs Now)")} icon={<TrendingUp size={18} className="text-emerald-500" />} className="!h-auto">
                           <div className="space-y-6">
                              <p className="text-xs text-slate-500">{t("Visualiza el crecimiento de tu negocio gracias a la optimización de Bvelt.", "Visualize your business growth thanks to Bvelt optimization.")}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-between items-end mb-4">
                                       <div>
                                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t("Llamadas GMB", "GMB Calls")}</p>
                                          <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            {profile.gmbLink ? "142" : t("N/D", "N/A")}
                                          </p>
                                       </div>
                                       <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-lg">
                                         {profile.gmbLink ? t("MODELADO", "MODELED") : t("PENDIENTE", "PENDING")}
                                       </span>
                                    </div>
                                    <div className="flex items-end gap-2 h-24">
                                       <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1/3 rounded-t-lg relative group">
                                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{t("Base", "Base")}</div>
                                       </div>
                                       <div className="flex-1 bg-indigo-500/40 h-2/3 rounded-t-lg"></div>
                                       <div className="flex-1 bg-indigo-500 h-full rounded-t-lg"></div>
                                    </div>
                                 </div>

                                 <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border-2 border-emerald-500/20 shadow-xl shadow-emerald-500/5">
                                    <div className="flex items-center gap-3 mb-6">
                                       <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                                          <Zap size={24} />
                                       </div>
                                       <div>
                                          <h4 className="font-extrabold text-sm">{t("ROI Mensual Proyectado", "Projected Monthly ROI")}</h4>
                                          <p className="text-[10px] text-slate-500 uppercase font-black">{t("Retorno Estimado", "Estimated Return")}</p>
                                       </div>
                                    </div>
                                    <div className="space-y-3">
                                       <div className="flex justify-between items-center text-xs">
                                          <span className="text-slate-500">{t("Costo de Bvelt", "Bvelt Cost")}</span>
                                          <span className="font-bold text-slate-400">-$49.00</span>
                                       </div>
                                       <div className="flex justify-between items-center text-xs">
                                          <span className="text-slate-500">{t("Valor de Leads Generados", "Lead Value")}</span>
                                          <span className="font-bold text-emerald-500">+$2,450.00</span>
                                       </div>
                                       <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                          <span className="text-xs font-black uppercase tracking-widest">{t("Balance Total", "Total Balance")}</span>
                                          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">+$2,401.00</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              <div className="bg-indigo-600 p-6 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-600/20">
                                 <div>
                                    <h4 className="text-lg font-black">{t("¡Impacto Proyectado!", "Projected Impact!")}</h4>
                                    <p className="text-xs opacity-80">{t("Proyección estimada: Tus automatizaciones SEO están modeladas para generar potencialmente más de 10x el costo de tu suscripción.", "Estimated projection: Your SEO automations are modeled to potentially generate up to 10x your subscription cost.")}</p>
                                 </div>
                                 <button onClick={() => setActiveTab('plans')} className="whitespace-nowrap bg-white text-indigo-600 font-black px-6 py-3 rounded-xl text-xs hover:scale-105 transition cursor-pointer">
                                    {t("Asegurar Plan Pro", "Secure Pro Plan")}
                                 </button>
                              </div>
                           </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{t("Ahorro en Ads", "Ads Savings")}</p>
                              <p className="text-xl font-black text-slate-900 dark:text-white">$850</p>
                              <p className="text-[8px] text-emerald-500 font-bold mt-1 tracking-widest">{t("CPC EVITADO", "CPC AVOIDED")}</p>
                           </div>
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{t("Visibilidad Extra", "Extra Reach")}</p>
                              <p className="text-xl font-black text-slate-900 dark:text-white">+8.4k</p>
                              <p className="text-[8px] text-indigo-500 font-bold mt-1 tracking-widest">{t("IMPRESIONES MAPS", "MAPS IMPRESSIONS")}</p>
                           </div>
                           <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                              <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{t("Reseñas Ganadas", "Reviews Gained")}</p>
                              <p className="text-xl font-black text-slate-900 dark:text-white">12</p>
                              <p className="text-[8px] text-amber-500 font-bold mt-1 tracking-widest">{t("SISTEMA DE CONFIANZA", "TRUST ENGINE")}</p>
                           </div>
                        </div>
                     </section>
                   )}

                   {activeSubRow === 3 && (
                     <section className="space-y-6 animate-fade-in">
                       <GBPAuditChecklist 
                         profile={profile} 
                         t={t} 
                         showToast={showToast} 
                         onNavigateTab={(tab) => setActiveTab(tab as any)}
                         gmbConnected={Boolean(profile?.gmbConnected || profile?.gbpConnectionStatus === 'CONNECTED')}
                       />
                     </section>
                   )}

                 </div>
               </section>
             )}

             {activeTab === 'profile' && (
                <section className="space-y-4 md:space-y-6 max-w-4xl mx-auto py-2 animate-fade-in">
                  
                  {/* PWA 2-Tab Navigation */}
                  <div className="flex gap-4 pb-2 mb-6 border-b border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setProfileSubTab('business' as any)}
                      className={`pb-3 text-sm font-black transition-all border-b-2 ${
                        profileSubTab === 'business' || !['business', 'settings'].includes(profileSubTab)
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      🏢 {t("Perfil del Negocio", "Business Profile")}
                    </button>
                    <button
                      onClick={() => setProfileSubTab('settings' as any)}
                      className={`pb-3 text-sm font-black transition-all border-b-2 ${
                        profileSubTab === 'settings'
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      ⚙️ {t("Ajustes y Cuenta", "Account & Settings")}
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* TAB 1: BUSINESS PROFILE */}
                    {(profileSubTab === 'business' || !['business', 'settings'].includes(profileSubTab)) && (
                      <div className="space-y-6 animate-fade-in">
                        
                        <Card title={t("Información Principal", "Core Business Info")} icon={<Store size={18} className="text-indigo-500" />}>
                          <div className="space-y-5">
                            <Input label={t("Nombre de la Compañía", "Company Name")} placeholder="e.g. Pro Team Contractors" value={profile.name} onChange={v => setProfile({...profile, name: v})} />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              {/* Niche Badge / Edit */}
                              <div>
                                {profile.category && !isEditingNiche ? (
                                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Nicho de Negocio", "Business Niche")}</p>
                                      <p className="font-bold text-slate-900 dark:text-white">{profile.category}</p>
                                    </div>
                                    <button onClick={() => setIsEditingNiche(true)} className="p-2 text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <NicheAutocomplete 
                                    label={t("Nicho de Negocio", "Business Niche")}
                                    value={profile.category}
                                    onChange={v => {
                                      setProfile({...profile, category: v});
                                      setNiche("otro");
                                      if (typeof setIsEditingNiche !== 'undefined') setIsEditingNiche(false);
                                    }}
                                  />
                                )}
                              </div>

                              {/* City/State Badge / Edit */}
                              <div>
                                {profile.location && !isEditingLocation ? (
                                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl">
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">{t("Ciudad y Estado", "City & State")}</p>
                                      <p className="font-bold text-slate-900 dark:text-white">{profile.location}</p>
                                    </div>
                                    <button onClick={() => setIsEditingLocation(true)} className="p-2 text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <CityAutocomplete 
                                    label={t("Ciudad y Estado", "City & State")} 
                                    placeholder="e.g. Toronto, ON" 
                                    value={profile.location} 
                                    onChange={v => {
                                      setProfile({...profile, location: v});
                                      if (typeof setIsEditingLocation !== 'undefined') setIsEditingLocation(false);
                                    }} 
                                  />
                                )}
                              </div>
                            </div>

                            <Input label={t("Teléfono Comercial", "Business Phone")} placeholder="e.g. (555) 123-4567" value={profile.phone} onChange={v => setProfile({...profile, phone: v})} />
                            <Input label="Google Maps Review Link" value={profile.gmbLink} onChange={v => setProfile({...profile, gmbLink: v})} />
                            
                            {/* Multi-Service Support (Lawn + Pool + Trades) */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {t("Servicios y Especialidades (Multi-servicio)", "Services & Specialties (Multi-service)")}
                                </label>
                                <span className="text-[10px] text-indigo-500 font-bold">
                                  {(profile.services || []).length} {t("activos", "active")}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(profile.services || []).map((srv: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl"
                                  >
                                    {srv}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedServices = (profile.services || []).filter((_: any, i: number) => i !== sIdx);
                                        setProfile({ ...profile, services: updatedServices });
                                      }}
                                      className="hover:text-rose-500 transition text-indigo-400 dark:text-indigo-400 ml-0.5"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder={t("Añadir servicio (ej. Limpieza de piscinas, Jardinería)...", "Add service (e.g. Pool cleaning, Lawn care)...")}
                                  id="new-service-input"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const target = e.target as HTMLInputElement;
                                      const val = target.value.trim();
                                      if (val && !(profile.services || []).includes(val)) {
                                        setProfile({ ...profile, services: [...(profile.services || []), val] });
                                        target.value = '';
                                      }
                                    }
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById('new-service-input') as HTMLInputElement;
                                    if (input && input.value.trim()) {
                                      const val = input.value.trim();
                                      if (!(profile.services || []).includes(val)) {
                                        setProfile({ ...profile, services: [...(profile.services || []), val] });
                                        input.value = '';
                                      }
                                    }
                                  }}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shrink-0 cursor-pointer"
                                >
                                  {t("Añadir", "Add")}
                                </button>
                              </div>

                              {/* Suggested quick chips */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <span className="text-[10px] text-slate-400 self-center mr-1">{t("Sugerencias:", "Quick add:")}</span>
                                {['Lawn Care', 'Pool Cleaning', 'Pressure Washing', 'Landscaping', 'Tree Trimming', 'Irrigation'].map((sug) => {
                                  const isAlready = (profile.services || []).includes(sug);
                                  return (
                                    <button
                                      key={sug}
                                      type="button"
                                      disabled={isAlready}
                                      onClick={() => {
                                        if (!isAlready) {
                                          setProfile({ ...profile, services: [...(profile.services || []), sug] });
                                        }
                                      }}
                                      className={`text-[10px] px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                                        isAlready
                                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                                          : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40'
                                      }`}
                                    >
                                      + {sug}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            
                            <button onClick={() => { localStorage.setItem('lf_profile', JSON.stringify(profile)); localStorage.setItem('user_profile', JSON.stringify(profile)); syncToFirestore(); showToast(t("Datos Guardados", "Data Saved"), "success"); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer">
                               <CheckCircle size={18} /> {t("Guardar Perfil", "Save Profile")}
                            </button>
                          </div>
                        </Card>

                        {/* Google Business Integration Card */}
                        <Card title={t("Integración con Google", "Google Business Integration")} icon={<Globe size={18} className="text-emerald-500" />}>
                           <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-4 w-full md:w-auto">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${profile.gmbLink ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                                 <Store size={24} />
                               </div>
                               <div>
                                 <p className="font-bold text-slate-900 dark:text-white">Google Business Profile</p>
                                 <p className="text-xs text-slate-500 flex items-center gap-1">
                                   <span className={`w-2 h-2 rounded-full ${profile.gmbLink ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                   {profile.gmbLink ? t("Conectado localmente", "Connected to local GBP") : t("No conectado", "Not connected")}
                                 </p>
                               </div>
                             </div>
                             {!profile.gmbLink && (
                               <button onClick={() => window.open('https://business.google.com/create', '_blank')} className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer">
                                 {t("Conectar Perfil", "Connect Profile")}
                               </button>
                             )}
                           </div>
                        </Card>

                        {/* Automatic Web & QR Card */}
                        <Card title={t("🌐 Tu Sitio Web Automático", "🌐 Your Automatic Website")} icon={<Globe size={18} className="text-cyan-500" />}>
                          <div className="space-y-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {t("Creamos automáticamente una página web profesional para ti, alimentada por tus fotos y reseñas, con botones de contacto directo a tu WhatsApp.", "We automatically create a professional web page for you, fed by your photos and reviews, with direct contact buttons to your WhatsApp.")}
                            </p>
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
                              <div className="flex-1 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                                <span className="truncate">https://bvelt.app/{(profile.name || 'n').toLowerCase().replace(/[^a-z0-9]/g, '')}</span>
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?site=${user?.uid || 'demo'}`); showToast(t("¡Enlace copiado!", "Link copied!"), "success"); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 p-1 cursor-pointer shrink-0">
                                  <Copy size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}?site=${user?.uid || 'demo'}`, '_blank')} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/20">
                                <Globe size={18} /> {t("Visitar Sitio en Vivo", "Visit Live Site")}
                              </button>
                            </div>
                          </div>
                        </Card>

                        {/* Trust Badges Grid */}
                        <Card title={t("Insignias de Confianza", "Trust Badges")}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              { id: 'sameDay', label: t("Servicio Mismo Día", "Same-Day Service"), icon: '⚡' },
                              { id: 'licensed', label: t("Licenciado & Asegurado", "Licensed & Insured"), icon: '🛡️' },
                              { id: 'backgroundChecked', label: t("Verificado", "Background Checked"), icon: '🔍' },
                              { id: 'ecoFriendly', label: t("Eco-Amigable", "Eco-Friendly"), icon: '🌱' },
                              { id: 'veteranOwned', label: t("Veterano de Guerra", "Veteran Owned"), icon: '🎖️' },
                              { id: 'familyOwned', label: t("Negocio Familiar", "Family Owned"), icon: '👨‍👩‍👧‍👦' },
                            ].map(badge => (
                              <button
                                key={badge.id}
                                onClick={() => {
                                  const tags = profile.trustTags || [];
                                  const newTags = tags.includes(badge.id) ? tags.filter((t: string) => t !== badge.id) : [...tags, badge.id];
                                  setProfile({...profile, trustTags: newTags});
                                }}
                                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                                  (profile.trustTags || []).includes(badge.id) 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400' 
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                                }`}
                              >
                                <span className="text-xl">{badge.icon}</span>
                                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{badge.label}</span>
                              </button>
                            ))}
                          </div>
                        </Card>

                      </div>
                    )}

                    {/* TAB 2: ACCOUNT & SETTINGS */}
                    {profileSubTab === 'settings' && (
                      <div className="space-y-6 animate-fade-in">
                        
                        {/* User Identity & Subscription Card */}
                        <Card title={t("Cuenta y Suscripción", "Account & Subscription")}>
                          {!user ? (
                            <div className="text-center py-6">
                              <button onClick={handleLogin} className="bg-indigo-600 text-white font-bold py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 transition mx-auto shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="" /> 
                                {t("Entrar con Google", "Continue with Google")}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-5">
                              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <img src={user.photoURL || ''} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" alt="Avatar"/>
                                <div className="flex-1">
                                  <h3 className="font-bold text-slate-900 dark:text-white">{user.displayName}</h3>
                                  <p className="text-xs text-slate-500">{user.email}</p>
                                </div>
                                <button onClick={handleLogout} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Logout">
                                  <LogOut size={18} />
                                </button>
                              </div>
                              
                              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h4 className="font-black text-lg">{t("Suscripción Pro", "Pro Subscription")}</h4>
                                    <p className="text-indigo-100 text-sm">
                                      {userSubscription ?.status === 'active' ? t("Plan Activo", "Active Plan") : 
                                       userSubscription?.status === 'trial' ? `${userSubscription.trialDaysLeft} ${t("Días de Prueba", "Trial Days Left")}` : 
                                       t("Prueba Expirada", "Trial Expired")}
                                      {userSubscription ?.billingCycle === 'monthly' ? ' (Mensual)' : userSubscription?.billingCycle === 'yearly' ? ' (Anual)' : ''}
                                    </p>
                                  </div>
                                  <Zap className="text-yellow-300 fill-yellow-300" size={24} />
                                </div>
                                <button onClick={() => setActiveTab('plans')} className="w-full bg-white text-indigo-600 font-bold py-2.5 rounded-xl text-sm hover:scale-[1.02] transition cursor-pointer">
                                  {t("Gestionar / Mejorar Plan", "Manage Subscription / Upgrade")}
                                </button>
                              </div>
                            </div>
                          )}
                        </Card>

                        {/* TASK P2-2: Shareable Snapshot & Referral Link / Invita a otro negocio */}
                        <ReferralInviteCard
                          tenantId={user?.uid || profile?.id}
                          customCode={profile?.referralCode}
                          t={t}
                          showToast={showToast}
                        />

                        {/* TASK P2-3: Usage This Period & Plan Quotas */}
                        <PlanLimitsCard
                          profile={profile}
                          userSubscription={userSubscription}
                          t={t}
                          language={language}
                          onUpgrade={() => setActiveTab('plans')}
                          onViewPlans={() => setActiveTab('plans')}
                        />

                        {/* Requirement 3: Plain Limits Language Breakdown (Solo vs Pro) */}
                        <Card title={t("Comparativa de Límites y Funciones", "Limits Breakdown: Solo vs Pro")} icon={<Zap size={18} className="text-amber-500" />}>
                          <div className="space-y-4">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {t("Compara las capacidades de tu cuenta actual frente al plan Pro para contratistas.", "Compare your current account limits against the full Pro plan for local contractors.")}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* SOLO (FREE/TRIAL) */}
                              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {t("Plan Solo / Prueba", "Solo / Trial Plan")}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {t("Gratis", "Free")}
                                  </span>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                  <li className="flex items-start gap-2">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>{t("1 Ubicación de negocio fija", "1 Fixed business location")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>{t("5 Escaneos y acciones de mercado al día", "5 Market scans & actions per day")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>{t("Hasta 10 contactos en bandeja de leads", "Up to 10 leads in CRM inbox")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>{t("Solicitud de reseñas manual", "Manual review request workflow")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>{t("Radio estándar de 5 km", "Standard 5km search radius")}</span>
                                  </li>
                                </ul>
                              </div>

                              {/* PRO */}
                              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border-2 border-indigo-500/40 space-y-3 relative overflow-hidden">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                    <Sparkles size={13} className="text-amber-400" />
                                    {t("Bvelt Pro", "Bvelt Pro")}
                                  </span>
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                                    $49/mo
                                  </span>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-800 dark:text-slate-200 font-medium">
                                  <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span>{t("Ubicaciones y zonas de servicio ilimitadas", "Unlimited locations & service zones")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span>{t("30+ Escaneos profundos de competidores al día", "30+ Deep competitor scans per day")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span>{t("Leads y radar de oportunidades ilimitados", "Unlimited leads & live prospecting radar")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span>{t("Plantillas WhatsApp y solicitud de reseñas 1-toque", "1-Tap WhatsApp templates & review outreach")}</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    <span>{t("Radar multizona + asistente por voz en camión", "Multi-zone radar + in-truck voice assistant")}</span>
                                  </li>
                                </ul>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('plans')}
                                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                                >
                                  <span>{t("Mejorar a Pro", "Upgrade to Pro")}</span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Dashboard Customization Card */}
                        <Card title={t("Personalización del Dashboard", "Dashboard Customization")} icon={<Sliders size={18} className="text-cyan-500" />}>
                           <div className="space-y-4">
                             <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                               <div>
                                 <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{t("Idioma de la Aplicación", "Application Language")}</p>
                                 <p className="text-xs text-slate-500">{t("Elige el idioma principal de Bvelt.", "Choose the primary language for Bvelt.")}</p>
                               </div>
                               <div className="inline-flex items-center rounded-lg bg-slate-200/80 dark:bg-slate-800 p-0.5 border border-slate-300 dark:border-slate-700 text-xs font-black">
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setLanguage('en');
                                     localStorage.setItem('lf_lang', 'en');
                                   }}
                                   className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${language === 'en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                 >
                                   EN
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setLanguage('es');
                                     localStorage.setItem('lf_lang', 'es');
                                   }}
                                   className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${language === 'es' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                 >
                                   ES
                                 </button>
                               </div>
                             </div>

                             <div className="space-y-3 pt-2">
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("Módulos Activos", "Active Modules")}</p>
                               {[
                                 { id: 'reviews', label: t("Conseguir Reseñas", "Get Reviews"), icon: <Star size={16}/> },
                                 { id: 'followup', label: t("Seguimiento de Clientes", "Client Follow-up"), icon: <Users size={16}/> },
                                 { id: 'estimator', label: t("Estimador de Precios", "Price Estimator"), icon: <Calculator size={16}/> },
                                 { id: 'invoices', label: t("Facturas y Ganancias", "Invoices & Profits"), icon: <FileText size={16}/> }
                               ].map(mod => (
                                 <div key={mod.id} className="flex items-center justify-between">
                                   <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                                     {mod.icon}
                                     <span className="text-sm font-medium">{mod.label}</span>
                                   </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* WEBSITE VIEW (Priority 1 Recovery) */}
                {activeTab === 'website' && (
                  <WebsiteView
                    profile={profile}
                    db={db}
                    isFirebaseReady={isFirebaseReady}
                    user={user}
                    t={t}
                    language={language}
                    showToast={showToast}
                  />
                )}

                {/* PLANS / SUBSCRIPTION VIEW (Priority 1 Recovery) */}
                {activeTab === 'plans' && (
                  <PlansView
                    t={t}
                    handleCheckout={handleCheckout}
                    checkoutLoading={checkoutLoading}
                    priceProMonthly={priceProMonthly}
                    priceProYearly={priceProYearly}
                    hasActivatedTrial={hasActivatedTrial}
                    hasUsedTrial={hasUsedTrial}
                    trialDaysRemaining={getTrialDaysRemaining()}
                    onActivateTrial={activateTrial}
                  />
                )}

                {/* VISUAL ESTIMATOR / SPATIAL ESTIMATOR (Priority 1 Recovery) */}
                {activeTab === 'estimator' && (
                  <VisualEstimator
                    t={t}
                    language={language}
                    profile={profile}
                    customGeminiKey={customGeminiKey}
                    showToast={showToast}
                  />
                )}

                {/* ACCOUNTING & FINANCIAL LEDGER VIEW */}
                {activeTab === 'accounting' && (
                  <section className="space-y-6 max-w-5xl mx-auto py-2 animate-fade-in">
                    <Header 
                      title={t("📊 Cuentas, Finanzas & Facturación", "📊 Accounts, Finances & Billing")} 
                      subtitle={t("Monitorea ingresos reales, registra cobros a clientes y descarga facturas fiscales.", "Track actual revenue, log client payments and download tax-ready invoices.")} 
                    />
                    
                    {/* Financial Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t("TOTAL COBRADO", "TOTAL COLLECTED")}</p>
                        <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${totalCobrado.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("Ingresos completados", "Completed income")}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t("PENDIENTE DE COBRO", "PENDING INVOICES")}</p>
                        <p className="text-3xl font-black text-amber-500 mt-1">${totalPendiente.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("Por cobrar a clientes", "Awaiting payment")}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{t("IMPACTO BVELT PRO", "BVELT PRO IMPACT")}</p>
                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${realProImpact.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("Leads ganados + transacciones", "Won leads + transactions")}</p>
                      </div>
                    </div>

                    {/* New Transaction Form */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                        <DollarSign size={16} className="text-indigo-500" />
                        {t("Registrar Nuevo Cobro o Factura", "Log New Payment or Invoice")}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">{t("Nombre del Cliente", "Client Name")}</label>
                          <input
                            type="text"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder={t("Ej. Carlos Ramos", "e.g. John Doe")}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">{t("Monto ($)", "Amount ($)")}</label>
                          <input
                            type="number"
                            value={newClientAmount}
                            onChange={(e) => setNewClientAmount(e.target.value)}
                            placeholder="350.00"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">{t("Estado", "Status")}</label>
                          <select
                            value={newClientStatus}
                            onChange={(e) => setNewClientStatus(e.target.value as 'pendiente' | 'pagado')}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                          >
                            <option value="pendiente">{t("Pendiente", "Pending")}</option>
                            <option value="pagado">{t("Pagado", "Paid")}</option>
                          </select>
                        </div>
                        <button
                          onClick={addTransaction}
                          disabled={!newClientName || !newClientAmount}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Plus size={14} />
                          {t("Guardar Cobro", "Save Payment")}
                        </button>
                      </div>
                    </div>

                    {/* Transactions History Ledger */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          {t("Historial de Transacciones", "Transaction Ledger")} ({clientTransactions.length})
                        </h3>
                        {clientTransactions.length > 0 && (
                          <button
                            onClick={() => {
                              const headers = "ID,Cliente,Monto,Estado,Fecha\n";
                              const rows = clientTransactions.map(t => `"${t.id}","${t.name}",${t.amount},"${t.status}","${t.date}"`).join("\n");
                              const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.setAttribute("href", url);
                              link.setAttribute("download", `bvelt_transacciones_${new Date().toISOString().slice(0, 10)}.csv`);
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              showToast(t("CSV de transacciones descargado.", "Transactions CSV downloaded."), "success");
                            }}
                            className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={12} />
                            {t("Exportar CSV", "Export CSV")}
                          </button>
                        )}
                      </div>

                      {clientTransactions.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                          <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                          <p className="text-xs font-bold text-slate-500">{t("Aún no has registrado transacciones.", "No transactions logged yet.")}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{t("Usa el formulario superior para registrar tu primer cobro.", "Use the form above to log your first payment.")}</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {clientTransactions.map(trans => (
                            <div key={trans.id} className="py-3 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${trans.status === 'pagado' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
                                  $
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 dark:text-white">{trans.name}</p>
                                  <p className="text-[10px] text-slate-400">{trans.date || t("Hoy", "Today")}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${trans.status === 'pagado' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                  {trans.status === 'pagado' ? t("Pagado", "Paid") : t("Pendiente", "Pending")}
                                </span>
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  ${trans.amount.toFixed(2)}
                                </span>
                                <button
                                  onClick={() => printInvoice(trans)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                                  title={t("Imprimir Factura", "Print Invoice")}
                                >
                                  <Printer size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* TASK P0-3: Global Bvelt Plan Limit Modal (HTTP 429 Hard Stop & Instant Stripe Upgrade Path) */}
          <PlanLimitModal
            isOpen={limitModalOpen}
            onClose={() => setLimitModalOpen(false)}
            limitInfo={limitModalInfo}
            onUpgrade={() => {
              setLimitModalOpen(false);
              handleCheckout(priceProMonthly, 'monthly');
            }}
            onViewPlans={() => {
              setLimitModalOpen(false);
              setActiveTab('plans');
            }}
            checkoutLoading={Boolean(checkoutLoading)}
            t={t}
          />
         </div>
     );
   }
