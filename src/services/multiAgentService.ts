import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getFirebaseDB } from "../lib/firebase";
import { fetchWithRetry } from "../lib/retryFetch";

export interface OnboardingHookOutput {
  hook_universal: string;
  hook_niche_specific: string;
  competitive_teaser: string;
  suggested_action_call: string;
  refined_niche?: string;
}

export interface ScanResultPayload {
  dataMaps?: any;
  datosProyecto?: any;
  reviewText?: string;
  whatsappMessage?: string; // Nuevo para el Agente 7
  language?: "es" | "en";
  niche?: string;
  customGeminiKey?: string;
  lightweight?: boolean;
  runAllAgents?: boolean;
}

export interface MultiAgentScanResponse {
  success: boolean;
  timestamp: string;
  audit?: {
    loss_estimate: number;
    critical_gaps: string[];
    target_competitor: string;
    market_difficulty: "Low" | "Medium" | "High";
  };
  adCopy?: string;
  reputationReply?: string;
  gbpPost?: string;
  outreachEmail?: string;
  proposalEstimate?: string; // Nuevo: Agente 6
  whatsappCloser?: string;   // Nuevo: Agente 7
  caseStudy?: string;        // Nuevo: Agente 8
  onboardingHook?: OnboardingHookOutput; // Nuevo: Agente 9
  current_context_location?: string;
  message?: string;          // Nuevo: Mensaje informativo o degradación grácil
  isRateLimited?: boolean;   // Nuevo: Indicador de error 429
  fromCache?: boolean;       // Nuevo: Indicador de caché hit
}

function cleanAiResponseText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
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

  cleaned = cleaned.trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

// Inflight request coalescing maps to prevent duplicate execution
const inflightAgentScans = new Map<string, Promise<MultiAgentScanResponse>>();
const inflightOnboardingHooks = new Map<string, Promise<OnboardingHookOutput>>();

/**
 * Ejecuta el flujo de 8 Micro-Agentes
 * e inyecta la lógica para almacenar en la subcolección aislada `scans` en Firestore.
 */
export async function executeAndSaveAgentScan(
  payload: ScanResultPayload,
  userId?: string
): Promise<MultiAgentScanResponse> {
  const cacheKey = `${payload.datosProyecto?.name || ''}_${payload.niche || ''}_${payload.dataMaps?.location || ''}`;
  if (inflightAgentScans.has(cacheKey)) {
    console.log("[Inflight Coalescing] Reutilizando solicitud de escaneo en curso para:", cacheKey);
    return inflightAgentScans.get(cacheKey)!;
  }

  const scanPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout for slow connections

    try {
      const response = await fetchWithRetry("/api/scan-maps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gemini-api-key": payload.customGeminiKey || ""
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = "";
        try {
          const rawText = await response.text();
          if (rawText.startsWith("<!") || rawText.includes("<html")) {
            errorText = `Error del servidor (${response.status})`;
          } else {
            errorText = rawText;
          }
        } catch (_) {}
        throw new Error(errorText || `Error del servidor (${response.status})`);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("No se pudo procesar la respuesta del servidor (formato JSON inválido).");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Error en la ejecución de los agentes de reparación.");
      }

      // Post-proceso de limpieza de AI-isms en los campos devueltos por los agentes
      if (data) {
        if (data.adCopy) data.adCopy = cleanAiResponseText(data.adCopy);
        if (data.reputationReply) data.reputationReply = cleanAiResponseText(data.reputationReply);
        if (data.gbpPost) data.gbpPost = cleanAiResponseText(data.gbpPost);
        if (data.outreachEmail) data.outreachEmail = cleanAiResponseText(data.outreachEmail);
        if (data.proposalEstimate) data.proposalEstimate = cleanAiResponseText(data.proposalEstimate);
        if (data.whatsappCloser) data.whatsappCloser = cleanAiResponseText(data.whatsappCloser);
        if (data.caseStudy) data.caseStudy = cleanAiResponseText(data.caseStudy);
        if (data.audit && typeof data.audit === 'object') {
          if (data.audit.actionStrategy) data.audit.actionStrategy = cleanAiResponseText(data.audit.actionStrategy);
          if (data.audit.gapAnalysis) data.audit.gapAnalysis = cleanAiResponseText(data.audit.gapAnalysis);
          if (data.audit.seoBriefing) data.audit.seoBriefing = cleanAiResponseText(data.audit.seoBriefing);
        }
        if (data.onboardingHook && typeof data.onboardingHook === 'object') {
          if (data.onboardingHook.initialAdPlan) data.onboardingHook.initialAdPlan = cleanAiResponseText(data.onboardingHook.initialAdPlan);
          if (data.onboardingHook.salesHook) data.onboardingHook.salesHook = cleanAiResponseText(data.onboardingHook.salesHook);
        }
      }

      // Guardar en la nueva subcolección aislada `scans` dentro del documento del perfil del usuario
      if (userId) {
        try {
          const db = getFirebaseDB();
          const scansRef = collection(db, "profiles", userId, "scans");
          const scanData: any = {
            timestamp: new Date().toISOString(),
            audit: data.audit || null,
            adCopy: data.adCopy || "",
            reputationReply: data.reputationReply || "",
            gbpPost: data.gbpPost || "",
            outreachEmail: data.outreachEmail || "",
            proposalEstimate: data.proposalEstimate || "",
            whatsappCloser: data.whatsappCloser || "",
            caseStudy: data.caseStudy || "",
            niche: payload.niche || "general"
          };
          if (data.onboardingHook) {
            scanData.onboardingHook = data.onboardingHook;
          }
          console.log("🔥 ESCRITURA EN FIRESTORE:", `profiles/${userId}/scans`);
          await addDoc(scansRef, scanData);
          console.log("✅ Scan guardado en la subcolección /profiles/{userId}/scans exitosamente con 9 agentes.");
        } catch (dbErr: any) {
          if (dbErr?.code === 'permission-denied' || String(dbErr?.message).includes('permission')) {
            console.warn('[multiAgentService] Firestore permission-denied for scan save. Preserving scan result locally.');
          } else {
            console.warn('[multiAgentService] Firestore scan save notice:', dbErr?.message || dbErr);
          }
        }
      }
      
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error("El escaneo tardó demasiado tiempo (timeout por red lenta). Por favor, intenta de nuevo.");
      }
      throw error;
    } finally {
      inflightAgentScans.delete(cacheKey);
    }
  })();

  inflightAgentScans.set(cacheKey, scanPromise);
  return scanPromise;
}

/**
 * Ejecuta el gancho de onboarding ultra-rápido (Agente 9 de manera independiente)
 */
export async function executeOnboardingHook(
  payload: {
    niche: string;
    name: string;
    location: string;
    language?: "es" | "en";
    customGeminiKey?: string;
  }
): Promise<OnboardingHookOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetchWithRetry("/api/scan-maps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": payload.customGeminiKey || ""
      },
      body: JSON.stringify({
        lightweight: true,
        datosProyecto: {
          name: payload.name,
          niche: payload.niche,
        },
        niche: payload.niche,
        dataMaps: {
          location: payload.location,
        },
        language: payload.language || "es"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorText = "";
      try {
        const rawText = await response.text();
        if (rawText.startsWith("<!") || rawText.includes("<html")) {
          errorText = `Error del servidor (${response.status})`;
        } else {
          errorText = rawText;
        }
      } catch (_) {}
      throw new Error(errorText || `Error del servidor (${response.status})`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error("No se pudo procesar la respuesta del servidor (formato JSON inválido).");
    }

    if (!data || !data.success) {
      throw new Error(data?.error || "Error al generar el gancho de onboarding.");
    }

    return data.onboardingHook;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("El gancho de onboarding tardó demasiado (timeout). Por favor reintenta.");
    }
    throw error;
  }
}

/**
 * Obtiene el historial de escaneos de reparación de la subcolección `scans`
 */
export async function getRecentAgentScans(userId: string, maxResults = 5) {
  try {
    const db = getFirebaseDB();
    const scansRef = collection(db, "profiles", userId, "scans");
    const q = query(scansRef, orderBy("timestamp", "desc"), limit(maxResults));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('permission')) {
      console.warn('[multiAgentService] Firestore permission-denied loading recent scans. Using empty/local fallback.');
    } else {
      console.warn('[multiAgentService] Firestore scan history load notice:', err?.message || err);
    }
    return [];
  }
}

/**
 * Realiza un escaneo real de competidores en OpenStreetMap usando Overpass API en el backend
 */
export async function executeRealCompetitorScraping(
  payload: {
    niche: string;
    location: string;
    coords?: { lat: number; lng: number } | null;
    customGeminiKey?: string;
  }
): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout para permitir rotación de espejos en backend

  try {
    const response = await fetchWithRetry("/api/scan-maps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": payload.customGeminiKey || ""
      },
      body: JSON.stringify({
        onlyCompetitors: true,
        niche: payload.niche,
        dataMaps: {
          location: payload.location,
          coords: payload.coords
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorText = "";
      try {
        const rawText = await response.text();
        if (rawText.startsWith("<!") || rawText.includes("<html")) {
          errorText = `Error del servidor (${response.status})`;
        } else {
          errorText = rawText;
        }
      } catch (_) {}
      throw new Error(errorText || `Error del servidor (${response.status})`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error("No se pudo procesar la respuesta del servidor (formato JSON inválido).");
    }

    if (!data || !data.success) {
      throw new Error(data?.error || "Error al escanear competidores reales.");
    }

    return data.competitors || [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("El escaneo de competidores reales tardó demasiado (timeout). Por favor reintenta.");
    }
    throw error;
  }
}
