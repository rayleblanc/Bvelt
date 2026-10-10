import { Request, Response } from "express";
import { getGeminiClient, ACTIVE_MODELS, callNodeAiText } from "./ai-config.ts";
import { getAdminFirestore, isFirebaseAdminReady, markAdminUnauthenticated } from "./firebaseAdmin.ts";

export interface BenchmarkData {
  id: string;
  niche_slug: string;
  location_slug: string;
  display_name: string;
  business_model: "HIGH_TICKET" | "RECURRING" | "HIGH_VOLUME";
  avg_ticket_usd: number;
  conversion_rate: number;
  top3_monthly_views_avg: number;
  classification: string;
  created_at: string;
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .trim();
}

/**
 * Extracts a JSON object from raw model output, supporting fenced blocks or embedded JSON objects
 */
function extractJson(text: string): any | null {
  if (!text || !text.trim()) return null;
  const raw = text.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(raw);
  } catch {}

  // 2. Fenced ```json ... ``` block
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  // 3. Scan first '{' to last '}'
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.substring(start, end + 1));
    } catch {}
  }

  return null;
}

const DETERMINISTIC_NICHE_MODELS: Record<string, {
  display_name: string;
  business_model: "HIGH_TICKET" | "RECURRING" | "HIGH_VOLUME";
  avg_ticket_usd: number;
  conversion_rate: number;
  top3_monthly_views_avg: number;
}> = {
  plumber: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  fontaneria: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  fontanero: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  electrician: { display_name: "Electricidad / Electrical", business_model: "RECURRING", avg_ticket_usd: 280, conversion_rate: 0.05, top3_monthly_views_avg: 1100 },
  electricista: { display_name: "Electricidad / Electrical", business_model: "RECURRING", avg_ticket_usd: 280, conversion_rate: 0.05, top3_monthly_views_avg: 1100 },
  roofing: { display_name: "Tejados y Cubiertas / Roofing", business_model: "HIGH_TICKET", avg_ticket_usd: 3500, conversion_rate: 0.03, top3_monthly_views_avg: 800 },
  tejados: { display_name: "Tejados y Cubiertas / Roofing", business_model: "HIGH_TICKET", avg_ticket_usd: 3500, conversion_rate: 0.03, top3_monthly_views_avg: 800 },
  hvac: { display_name: "Climatización y HVAC", business_model: "HIGH_TICKET", avg_ticket_usd: 1200, conversion_rate: 0.04, top3_monthly_views_avg: 1500 },
  aire_acondicionado: { display_name: "Aire Acondicionado y Climatización", business_model: "HIGH_TICKET", avg_ticket_usd: 1100, conversion_rate: 0.04, top3_monthly_views_avg: 1500 },
  landscaping: { display_name: "Jardinería y Paisajismo", business_model: "RECURRING", avg_ticket_usd: 180, conversion_rate: 0.06, top3_monthly_views_avg: 900 },
  jardineria: { display_name: "Jardinería y Paisajismo", business_model: "RECURRING", avg_ticket_usd: 180, conversion_rate: 0.06, top3_monthly_views_avg: 900 },
  cleaning: { display_name: "Servicios de Limpieza", business_model: "RECURRING", avg_ticket_usd: 160, conversion_rate: 0.07, top3_monthly_views_avg: 1400 },
  limpieza: { display_name: "Servicios de Limpieza", business_model: "RECURRING", avg_ticket_usd: 160, conversion_rate: 0.07, top3_monthly_views_avg: 1400 },
  painting: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  pintor: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  pintura: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  locksmith: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  cerrajero: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  cerrajeria: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  auto_repair: { display_name: "Taller Mecánico y Chapa", business_model: "RECURRING", avg_ticket_usd: 350, conversion_rate: 0.05, top3_monthly_views_avg: 1600 },
  mecanico: { display_name: "Taller Mecánico y Chapa", business_model: "RECURRING", avg_ticket_usd: 350, conversion_rate: 0.05, top3_monthly_views_avg: 1600 },
  taller: { display_name: "Taller Mecánico y Chapa", business_model: "RECURRING", avg_ticket_usd: 350, conversion_rate: 0.05, top3_monthly_views_avg: 1600 },
  pest_control: { display_name: "Control de Plagas", business_model: "RECURRING", avg_ticket_usd: 210, conversion_rate: 0.06, top3_monthly_views_avg: 850 },
  fumigacion: { display_name: "Control de Plagas", business_model: "RECURRING", avg_ticket_usd: 210, conversion_rate: 0.06, top3_monthly_views_avg: 850 },
  reformas: { display_name: "Reformas y Construcción", business_model: "HIGH_TICKET", avg_ticket_usd: 4500, conversion_rate: 0.025, top3_monthly_views_avg: 750 },
  remodelacion: { display_name: "Reformas y Remodelaciones", business_model: "HIGH_TICKET", avg_ticket_usd: 4500, conversion_rate: 0.025, top3_monthly_views_avg: 750 },
};

const IN_MEMORY_BENCHMARK_CACHE = new Map<string, any>();

export async function nicheBenchmarkHandler(req: Request, res: Response): Promise<void> {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const { niche, location } = req.query;
  
  if (!niche || String(niche).trim() === "") {
    res.json({ status: "PENDING_NICHO", data: null });
    return;
  }

  const nicheStr = String(niche).trim();
  const locationStr = location ? String(location).trim() : "default_national";
  const niche_slug = toSlug(nicheStr);
  const location_slug = toSlug(locationStr);
  const docId = `${niche_slug}_${location_slug}`;

  // 1. In-memory cache check
  if (IN_MEMORY_BENCHMARK_CACHE.has(docId)) {
    res.json({ status: "SUCCESS", data: IN_MEMORY_BENCHMARK_CACHE.get(docId) });
    return;
  }

  // 2. Try Firestore cache check
  let firestoreAvailable = false;
  if (isFirebaseAdminReady()) {
    try {
      const db = getAdminFirestore();
      if (db) {
        const docRef = db.collection('niche_benchmarks').doc(docId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          IN_MEMORY_BENCHMARK_CACHE.set(docId, data);
          res.json({ status: "SUCCESS", data });
          return;
        }
        firestoreAvailable = true;
      }
    } catch (err: any) {
      if (err?.code === 16 || String(err?.message).includes('UNAUTHENTICATED')) {
        markAdminUnauthenticated(err);
      }
      firestoreAvailable = false;
    }
  }

  // 3. Try Gemini AI estimation
  try {
    const prompt = `Analiza el nicho comercial "${nicheStr}" en la ubicación "${locationStr}". Eres un modelador econométrico experto en economías locales de servicios B2C/B2B. Debes estimar valores reales y prudentes para:
1. "display_name": Un nombre elegante y comercial para este nicho.
2. "business_model": Clasifica en "HIGH_TICKET" (si el ticket promedio es > $500 USD como roofing, HVAC, remodelaciones), "RECURRING" (jardinería, limpieza recurrente, control de plagas), o "HIGH_VOLUME" (cerrajería, grúas, reparaciones menores rápidas).
3. "avg_ticket_usd": Ticket promedio estimado en USD para un servicio promedio.
4. "conversion_rate": Tasa de conversión de visualizaciones de ficha a lead cualificado (entre 0.02 y 0.12, por defecto usa 0.05).
5. "top3_monthly_views_avg": Número promedio mensual de visualizaciones/impresiones que recibe un negocio en el Top 3 de Google Maps para este nicho y ubicación geográfica específica (ej: entre 500 y 8000 views según el tamaño de la población).

CRITICAL: Respond with ONLY valid JSON, no prose, no Markdown code fences, no comments before or after.`;

    const aiResult = await callNodeAiText({
      taskType: "niche_benchmark",
      prompt,
      systemInstruction: "You are a professional local econometric modeler. Respond with ONLY valid JSON, no prose.",
      jsonMode: true
    });
    const aiText = aiResult?.text || "";
    const parsed = extractJson(aiText);
    if (parsed && typeof parsed === 'object') {
      const benchmarkData: BenchmarkData = {
        id: docId,
        niche_slug,
        location_slug,
        display_name: String(parsed.display_name || nicheStr).trim(),
        business_model: (parsed.business_model === 'HIGH_TICKET' || parsed.business_model === 'HIGH_VOLUME' || parsed.business_model === 'RECURRING') ? parsed.business_model : 'RECURRING',
        avg_ticket_usd: Math.max(20, Number(parsed.avg_ticket_usd) || 150),
        conversion_rate: Math.max(0.01, Math.min(0.25, Number(parsed.conversion_rate) || 0.05)),
        top3_monthly_views_avg: Math.max(100, Number(parsed.top3_monthly_views_avg) || 1000),
        classification: "BENCHMARK / MODELED",
        created_at: new Date().toISOString()
      };

      IN_MEMORY_BENCHMARK_CACHE.set(docId, benchmarkData);

      if (firestoreAvailable && isFirebaseAdminReady()) {
        try {
          const db = getAdminFirestore();
          if (db) {
            await db.collection('niche_benchmarks').doc(docId).set(benchmarkData);
          }
        } catch (e) {
          // Ignore cache write error
        }
      }

      res.json({ status: "SUCCESS", data: benchmarkData });
      return;
    }
  } catch (aiErr: any) {
    // Fail soft without throwing unhandled error: proceed to deterministic fallback
  }

  // 4. Deterministic modeled fallback according to Master Data Contract (BENCHMARK / MODELED)
  let matchedModel = DETERMINISTIC_NICHE_MODELS[niche_slug];
  if (!matchedModel) {
    for (const [key, val] of Object.entries(DETERMINISTIC_NICHE_MODELS)) {
      if (niche_slug.includes(key) || key.includes(niche_slug)) {
        matchedModel = val;
        break;
      }
    }
  }

  const fallbackData: BenchmarkData = {
    id: docId,
    niche_slug,
    location_slug,
    display_name: matchedModel?.display_name || nicheStr,
    business_model: matchedModel?.business_model || "RECURRING",
    avg_ticket_usd: matchedModel?.avg_ticket_usd || 200,
    conversion_rate: matchedModel?.conversion_rate || 0.05,
    top3_monthly_views_avg: matchedModel?.top3_monthly_views_avg || 1000,
    classification: "BENCHMARK / MODELED",
    created_at: new Date().toISOString()
  };

  IN_MEMORY_BENCHMARK_CACHE.set(docId, fallbackData);
  res.json({ status: "SUCCESS", data: fallbackData });
}
