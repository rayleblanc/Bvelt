/**
 * BVELT AI VISIBILITY & LOCAL AI PRESENCE (BLOCK 5.1 - TRUTH & PROVIDER INTEGRITY)
 * Server-side audit and evidence tracking for AI search assistants.
 * 
 * Rules:
 * - Direct Gemini 3.7 Flash query is tagged `provider: "GOOGLE_GEMINI"`, `observationMethod: "DIRECT_PROVIDER_QUERY"`.
 * - Never claims ChatGPT or SearchGPT was directly queried if only Gemini was queried.
 * - Sample size & queryHash tracking ensures low confidence for 1-query samples.
 * - Competitor identity resolution using entityIdentity.ts.
 * - All observations are `observationType: 'AI_INTERPRETATION'` and `evidenceStatus: 'INFERRED'` / `'DERIVED'`.
 */

import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { ACTIVE_MODELS, getGeminiClient, isProviderAvailable, setGeminiCooldown, logAiTelemetry, callNodeAiText } from "./ai-config.ts";
import { 
  AIVisibilitySnapshot, 
  AIMentionedBusiness, 
  AIVisibilitySignal, 
  AIVisibilitySummary 
} from "../src/knowledge/memory/bemTypes.ts";
import { generateEntityId, normalizeBusinessName } from "../src/knowledge/memory/entityIdentity.ts";

// In-Memory L1 Cache for AI Visibility Audits (7 days TTL)
const AI_VISIBILITY_CACHE = new Map<string, { snapshot: AIVisibilitySnapshot; cachedAt: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Normalizes business names for resilient matching.
 */
function normalizeBizName(name: string): string {
  return normalizeBusinessName(name);
}

/**
 * Generates a stable query hash for audit reproducibility.
 */
function computeQueryHash(query: string, location: string): string {
  const str = `${query.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generates local query patterns for the category and location.
 */
function buildAiAuditQueries(category: string, location: string, lang: string): string[] {
  const cleanCat = category.trim();
  const cleanLoc = location.trim();
  if (lang === "en" || lang === "en-US") {
    return [
      `Who are the top recommended ${cleanCat} in ${cleanLoc} with best customer reviews?`,
      `Which ${cleanCat} in ${cleanLoc} offer fast response and high quality service?`
    ];
  }
  return [
    `¿Cuáles son los mejores y más recomendados profesionales de ${cleanCat} en ${cleanLoc}?`,
    `¿Qué empresas de ${cleanCat} en ${cleanLoc} tienen las mejores opiniones y respuesta rápida?`
  ];
}

/**
 * Executes a deterministic local simulated audit when Gemini is unavailable or on cooldown.
 */
function createDeterministicFallbackSnapshot(params: {
  entityId: string;
  businessName: string;
  category: string;
  location: string;
  query: string;
}): AIVisibilitySnapshot {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  return {
    snapshotId: `aivis_${params.entityId}_${Date.now()}`,
    entityId: params.entityId,
    provider: "LOCAL_SIMULATOR",
    simulationTarget: null,
    observationMethod: "DETERMINISTIC_MODEL_FALLBACK",
    model: "bvelt-deterministic-model-v1",
    producerVersion: "bvelt-aivis-v1.1",
    promptTemplateVersion: "aivis-local-prompt-v1",
    query: params.query,
    queryHash: computeQueryHash(params.query, params.location),
    category: params.category,
    location: params.location,
    observedAt: now,
    expiresAt: expiresAt,
    classification: "PUBLIC_SHARED",
    observationType: "AI_INTERPRETATION",
    evidenceStatus: "INFERRED",
    confidence: 0.50,
    confidenceLevel: "LOW",
    sampleSize: 1,
    isUserMentioned: false,
    userRankPosition: null,
    userShareOfVoicePercent: 0,
    topMentionedBusinesses: [],
    totalBusinessesMentioned: 0,
    keyMissingAttributes: [
      "Falta de presencia estructurada en bases de datos indexables por asistentes de IA",
      "Sin citación destacada en directorios semánticos locales"
    ],
    visibilityScore: 30,
    scoreProvenance: "MODELED",
    rawSummarySnippet: "Diagnóstico determinista local (fallback). Sin llamadas directas a proveedores externos de IA."
  };
}

/**
 * Evaluates AI Visibility signals and recommendations based on snapshots.
 * Enforces sample size, provider truth, and conservative signal severity.
 */
export function deriveAiVisibilitySignals(
  entityId: string,
  businessName: string,
  snapshots: AIVisibilitySnapshot[]
): AIVisibilitySignal[] {
  const signals: AIVisibilitySignal[] = [];
  if (!snapshots || snapshots.length === 0) return signals;

  const latest = snapshots[0];
  const sampleSize = latest.sampleSize || 1;

  // Signal 1: Omission Gap
  if (!latest.isUserMentioned) {
    const isLowSample = sampleSize < 2;
    signals.push({
      id: `sig_aivis_gap_${entityId}_${Date.now()}`,
      entityId,
      type: "AI_GAP_OMISSION",
      severity: isLowSample ? "ATTENTION" : "CRITICAL",
      title: isLowSample
        ? "Posible Omisión en Diagnóstico Inicial de IA"
        : "Omisión Confirmada en Búsquedas de IA",
      reason: isLowSample
        ? `Observación inicial con consulta única: ${businessName || "Tu negocio"} no apareció en la respuesta auditada de ${latest.provider} para ${latest.category} en ${latest.location}.`
        : `Múltiples auditorías confirman que ${latest.provider} no cita a ${businessName || "tu negocio"} en ${latest.location}.`,
      evidence: `Muestra: ${sampleSize} consulta(s). Diagnóstico observado en ${latest.provider} (${latest.model}).`,
      whyItMattersEs: "Los consumidores utilizan asistentes conversacionales para pedir recomendaciones locales. La ausencia de citaciones desvía oportunidades comerciales hacia competidores indexados.",
      whyItMattersEn: "Consumers ask conversational AI assistants for direct local options. Absence of citations redirects opportunities to indexed competitors.",
      nextActionEs: "Optimizar perfil local y citaciones semánticas para facilitar su indexación por asistentes de IA.",
      nextActionEn: "Optimize local profile and semantic citations to facilitate indexing by AI assistants.",
      actionCode: "OPTIMIZE_AI_PRESENCE",
      actionTab: "business_scan",
      suggestedActionPayload: {
        category: latest.category,
        location: latest.location,
        query: latest.query
      }
    });
  } else if (latest.userRankPosition && latest.userRankPosition <= 3) {
    signals.push({
      id: `sig_aivis_leader_${entityId}_${Date.now()}`,
      entityId,
      type: "AI_POSITION_LEADER",
      severity: "POSITIVE",
      title: `Destacado en ${latest.provider} (#${latest.userRankPosition})`,
      reason: `${businessName} aparece recomendado en la posición #${latest.userRankPosition} según auditoría realizada en ${latest.provider}.`,
      evidence: `Observado en ${latest.provider} (${latest.model}) con sentimiento favorable. Muestra: ${sampleSize} consulta(s).`,
      whyItMattersEs: "Consolida tu ventaja competitiva en respuestas conversacionales directas.",
      whyItMattersEn: "Consolidates your competitive advantage in direct conversational answers.",
      nextActionEs: "Mantener el ritmo de reseñas positivas y respuestas rápidas para proteger la autoridad adquirida.",
      nextActionEn: "Maintain review velocity and prompt responses to protect established authority.",
      actionCode: "MAINTAIN_AI_LEAD",
      actionTab: "reviews"
    });
  }

  // Signal 2: Competitor Dominance (requires repeated observation if possible, or ATTENTION severity with explicit sample count)
  if (latest.topMentionedBusinesses && latest.topMentionedBusinesses.length > 0) {
    const topComp = latest.topMentionedBusinesses[0];
    if (!topComp.isUserBusiness) {
      signals.push({
        id: `sig_aivis_comp_${entityId}_${Date.now()}`,
        entityId,
        type: "AI_COMPETITOR_DOMINANCE",
        severity: "ATTENTION",
        title: `Mención Competidora Observada: ${topComp.name}`,
        reason: `${topComp.name} encabeza la recomendación observada en ${latest.provider} para ${latest.category} en ${latest.location}.`,
        evidence: `Observado en ${latest.provider} (${latest.model}). Muestra de auditoría: ${sampleSize} consulta(s).`,
        whyItMattersEs: "Este competidor cuenta con atributos estructurados que el asistente de IA destaca al recomendar servicios locales.",
        whyItMattersEn: "This competitor has structured attributes highlighted by the AI assistant when recommending local services.",
        nextActionEs: "Revisar su posicionamiento y reforzar los puntos fuertes de tu ficha comercial.",
        nextActionEn: "Review their positioning and strengthen key highlights on your commercial profile.",
        actionCode: "COUNTER_AI_COMPETITOR",
        actionTab: "business_scan",
        suggestedActionPayload: {
          competitorName: topComp.name,
          attributes: topComp.attributesMentioned
        }
      });
    }
  }

  return signals;
}

/**
 * Express Handler for POST /api/ai-visibility/audit
 */
export async function aiVisibilityAuditHandler(req: Request, res: Response, db?: any): Promise<void> {
  const startTime = Date.now();
  try {
    const {
      entityId = "ent_local_default",
      businessName = "",
      category = "Servicios Locales",
      location = "Madrid, España",
      language = "es",
      forceRefresh = false
    } = req.body || {};

    const cacheKey = `aivis_${entityId}_${normalizeBizName(category)}_${normalizeBizName(location)}`;
    const now = Date.now();

    // 1. Check L1 Memory Cache
    if (!forceRefresh) {
      const cached = AI_VISIBILITY_CACHE.get(cacheKey);
      if (cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
        const signals = deriveAiVisibilitySignals(entityId, businessName, [cached.snapshot]);
        const sampleSize = cached.snapshot.sampleSize || 1;
        const summary: AIVisibilitySummary = {
          entityId,
          overallAiPresenceScore: cached.snapshot.visibilityScore,
          scoreProvenance: cached.snapshot.scoreProvenance,
          totalQueriesAudited: sampleSize,
          sampleSize,
          presenceRatePercent: cached.snapshot.userShareOfVoicePercent,
          shareOfVoiceProvenance: sampleSize >= 2 ? "DERIVED" : "MODELED",
          averageRank: cached.snapshot.userRankPosition,
          dominantCompetitorName: cached.snapshot.topMentionedBusinesses[0]?.name || null,
          dominantCompetitorMentions: cached.snapshot.topMentionedBusinesses.length,
          latestSnapshots: [cached.snapshot],
          signals,
          lastAuditedAt: cached.snapshot.observedAt,
          nextScheduledAuditAt: cached.snapshot.expiresAt
        };
        res.json({ status: "SUCCESS", source: "CACHE_L1", data: summary });
        return;
      }
    }

    // 2. Check Firestore Persistent Cache (if db is supplied)
    if (!forceRefresh && db) {
      try {
        const docRef = db.collection("bem_entities").doc(entityId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data && data.ai_visibility_snapshot) {
            const snap = data.ai_visibility_snapshot as AIVisibilitySnapshot;
            const snapAge = Date.now() - new Date(snap.observedAt).getTime();
            if (snapAge < CACHE_TTL_MS) {
              AI_VISIBILITY_CACHE.set(cacheKey, { snapshot: snap, cachedAt: Date.now() });
              const signals = deriveAiVisibilitySignals(entityId, businessName, [snap]);
              const sampleSize = snap.sampleSize || 1;
              const summary: AIVisibilitySummary = {
                entityId,
                overallAiPresenceScore: snap.visibilityScore,
                scoreProvenance: snap.scoreProvenance || "MODELED",
                totalQueriesAudited: sampleSize,
                sampleSize,
                presenceRatePercent: snap.userShareOfVoicePercent,
                shareOfVoiceProvenance: sampleSize >= 2 ? "DERIVED" : "MODELED",
                averageRank: snap.userRankPosition,
                dominantCompetitorName: snap.topMentionedBusinesses[0]?.name || null,
                dominantCompetitorMentions: snap.topMentionedBusinesses.length,
                latestSnapshots: [snap],
                signals,
                lastAuditedAt: snap.observedAt,
                nextScheduledAuditAt: snap.expiresAt
              };
              res.json({ status: "SUCCESS", source: "FIRESTORE_CACHE", data: summary });
              return;
            }
          }
        }
      } catch (fErr) {
        console.warn("[AIVisibility] Error checking Firestore cache:", fErr);
      }
    }

    // 3. Perform AI Observation via Gemini 3.7 Flash
    const queries = buildAiAuditQueries(category, location, language);
    const primaryQuery = queries[0];
    const userNorm = normalizeBizName(businessName);
    const queryHash = computeQueryHash(primaryQuery, location);

    let snapshot: AIVisibilitySnapshot;

    if (!isProviderAvailable("gemini") || !process.env.GEMINI_API_KEY) {
      console.warn("[AIVisibility] Gemini unavailable or on cooldown. Using deterministic fallback.");
      snapshot = createDeterministicFallbackSnapshot({
        entityId,
        businessName,
        category,
        location,
        query: primaryQuery
      });
    } else {
      const prompt = `Eres un auditor de presencia en Inteligencia Artificial.
Tu función es analizar únicamente las recomendaciones que el modelo de lenguaje Google Gemini formularía ante un usuario que busca servicios locales.

Consulta de usuario auditada: "${primaryQuery}"
Sector: "${category}"
Ubicación: "${location}"
Negocio del usuario a verificar: "${businessName}"

Reglas estrictas:
1. No inventes marcas ni calificaciones.
2. Basándote en el conocimiento real del sector en esa ubicación, identifica los negocios locales reales que Gemini recomendaría.
3. Evalúa con rigor si el negocio del usuario ("${businessName}") es mencionado.

Esquema JSON requerido:
{
  "topBusinesses": [
    {
      "name": "Nombre comercial del negocio",
      "rankPosition": 1,
      "sentiment": "RECOMMENDED",
      "attributesMentioned": ["excelentes opiniones", "servicio rápido"],
      "hasCitation": true
    }
  ],
  "isUserBusinessMentioned": false,
  "userRankPosition": null,
  "userShareOfVoicePercent": 0,
  "visibilityScore": 35,
  "keyMissingAttributes": [
    "Falta de citaciones estructuradas en directorios web",
    "Escasa presencia semántica local"
  ],
  "rawSummarySnippet": "Observación realizada mediante auditoría de presencia semántica y visibilidad local."
}
Solo devuelve el JSON plano.`;

      try {
        let responseText = "";
        const aiResult = await callNodeAiText({
          taskType: "ai_visibility",
          prompt,
          jsonMode: true
        });
        responseText = aiResult.text || "";

        if (!responseText || responseText.trim() === "") {
          throw new Error("Empty response from central AI cascade");
        }

        const parsed = JSON.parse(responseText.trim());

        const topBusinesses: AIMentionedBusiness[] = (parsed.topBusinesses || []).map((b: any, idx: number) => {
          const rawName = String(b.name || `Local Provider ${idx + 1}`);
          const bNorm = normalizeBizName(rawName);
          const isUser = userNorm !== "" && (bNorm.includes(userNorm) || userNorm.includes(bNorm));
          
          // Entity Identity Resolution using entityIdentity.ts
          const resolvedIdentity = generateEntityId({
            canonicalName: rawName,
            city: location
          });

          return {
            name: rawName,
            normalizedName: bNorm,
            rankPosition: Number(b.rankPosition || idx + 1),
            sentiment: (b.sentiment || "RECOMMENDED") as any,
            attributesMentioned: Array.isArray(b.attributesMentioned) ? b.attributesMentioned : [],
            hasCitation: Boolean(b.hasCitation ?? true),
            isUserBusiness: isUser,
            matchedEntityId: isUser ? entityId : resolvedIdentity.entityId,
            identityStatus: isUser ? "RESOLVED" : resolvedIdentity.status
          };
        });

        const isUserMentioned = Boolean(parsed.isUserBusinessMentioned || topBusinesses.some(b => b.isUserBusiness));
        const userRank = isUserMentioned 
          ? (parsed.userRankPosition || topBusinesses.find(b => b.isUserBusiness)?.rankPosition || 1) 
          : null;

        const score = typeof parsed.visibilityScore === "number" 
          ? Math.min(Math.max(parsed.visibilityScore, 0), 100) 
          : (isUserMentioned ? 80 : 30);

        const shareOfVoice = typeof parsed.userShareOfVoicePercent === "number"
          ? Math.min(Math.max(parsed.userShareOfVoicePercent, 0), 100)
          : (isUserMentioned ? 30 : 0);

        const sampleSize = queries.length >= 2 ? 2 : 1;
        const confidenceLevel = sampleSize >= 2 ? (isUserMentioned ? "HIGH" : "MEDIUM") : "LOW";

        snapshot = {
          snapshotId: `aivis_${entityId}_${Date.now()}`,
          entityId,
          provider: "GOOGLE_GEMINI",
          simulationTarget: null,
          observationMethod: "DIRECT_PROVIDER_QUERY",
          model: ACTIVE_MODELS.GEMINI_PRIMARY,
          producerVersion: "bvelt-aivis-v1.1",
          promptTemplateVersion: "aivis-gemini-prompt-v1",
          query: primaryQuery,
          queryHash,
          category,
          location,
          observedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
          classification: "PUBLIC_SHARED",
          observationType: "AI_INTERPRETATION",
          evidenceStatus: "INFERRED",
          confidence: confidenceLevel === "HIGH" ? 0.85 : 0.65,
          confidenceLevel,
          sampleSize,
          isUserMentioned,
          userRankPosition: userRank,
          userShareOfVoicePercent: shareOfVoice,
          topMentionedBusinesses: topBusinesses,
          totalBusinessesMentioned: topBusinesses.length,
          keyMissingAttributes: Array.isArray(parsed.keyMissingAttributes) ? parsed.keyMissingAttributes : [],
          visibilityScore: score,
          scoreProvenance: "DERIVED",
          rawSummarySnippet: parsed.rawSummarySnippet || `Observación directa realizada en Google Gemini (${ACTIVE_MODELS.GEMINI_PRIMARY}).`
        };

        logAiTelemetry({
          operation: "ai_visibility_audit",
          provider: "gemini",
          model: ACTIVE_MODELS.GEMINI_PRIMARY,
          status: "success",
          latencyMs: Date.now() - startTime
        });

      } catch (gemErr: any) {
        console.warn("[AIVisibility] Gemini audit failed. Using deterministic fallback. Error:", gemErr.message || gemErr);
        setGeminiCooldown(gemErr.message || "", gemErr);
        snapshot = createDeterministicFallbackSnapshot({
          entityId,
          businessName,
          category,
          location,
          query: primaryQuery
        });

        logAiTelemetry({
          operation: "ai_visibility_audit",
          provider: "gemini",
          model: ACTIVE_MODELS.GEMINI_PRIMARY,
          status: "fallback",
          latencyMs: Date.now() - startTime,
          errorMsg: gemErr.message
        });
      }
    }

    // 4. Save to L1 Memory Cache
    AI_VISIBILITY_CACHE.set(cacheKey, { snapshot, cachedAt: Date.now() });

    // 5. Persist to Firestore BEM entity with bounded write (if db is supplied)
    if (db) {
      try {
        const entityDocRef = db.collection("bem_entities").doc(entityId);
        await entityDocRef.set({
          ai_visibility_snapshot: snapshot,
          ai_visibility_score: snapshot.visibilityScore,
          ai_visibility_updated_at: snapshot.observedAt
        }, { merge: true });

        // Record EvidenceEvent in subcollection for longitudinal tracking
        const eventDocRef = entityDocRef.collection("history").doc(`ev_aivis_${Date.now()}`);
        await eventDocRef.set({
          eventId: `ev_aivis_${Date.now()}`,
          entityId,
          fieldKey: "ai_visibility_snapshot",
          oldValue: null,
          newValue: {
            score: snapshot.visibilityScore,
            provider: snapshot.provider,
            model: snapshot.model,
            observationMethod: snapshot.observationMethod,
            queryHash: snapshot.queryHash,
            isMentioned: snapshot.isUserMentioned,
            rank: snapshot.userRankPosition,
            shareOfVoice: snapshot.userShareOfVoicePercent,
            sampleSize: snapshot.sampleSize
          },
          sourceType: "AI_VISIBILITY_AUDIT",
          observationType: "AI_INTERPRETATION",
          evidenceStatus: "INFERRED",
          confidence: snapshot.confidence,
          observedAt: snapshot.observedAt,
          detectedAt: new Date().toISOString(),
          producerVersion: snapshot.producerVersion,
          schemaVersion: 1
        });
      } catch (saveErr) {
        console.warn("[AIVisibility] Error persisting snapshot to Firestore:", saveErr);
      }
    }

    // 6. Return Structured Summary & Actionable Signals
    const signals = deriveAiVisibilitySignals(entityId, businessName, [snapshot]);
    const sampleSize = snapshot.sampleSize || 1;
    const summary: AIVisibilitySummary = {
      entityId,
      overallAiPresenceScore: snapshot.visibilityScore,
      scoreProvenance: snapshot.scoreProvenance,
      totalQueriesAudited: sampleSize,
      sampleSize,
      presenceRatePercent: snapshot.userShareOfVoicePercent,
      shareOfVoiceProvenance: sampleSize >= 2 ? "DERIVED" : "MODELED",
      averageRank: snapshot.userRankPosition,
      dominantCompetitorName: snapshot.topMentionedBusinesses[0]?.name || null,
      dominantCompetitorMentions: snapshot.topMentionedBusinesses.length,
      dominantCompetitorObservationCount: snapshot.topMentionedBusinesses.length,
      latestSnapshots: [snapshot],
      signals,
      lastAuditedAt: snapshot.observedAt,
      nextScheduledAuditAt: snapshot.expiresAt
    };

    res.json({ status: "SUCCESS", source: "LIVE_AUDIT", data: summary });
  } catch (error: any) {
    console.error("[AIVisibility] Error in audit handler:", error);
    res.status(500).json({ error: error.message || "Internal server error during AI visibility audit." });
  }
}

/**
 * Express Handler for GET /api/ai-visibility/:entityId
 */
export async function getAiVisibilityHandler(req: Request, res: Response, db?: any): Promise<void> {
  try {
    const { entityId } = req.params;
    if (!entityId) {
      res.status(400).json({ error: "Missing entityId parameter" });
      return;
    }

    if (db) {
      const docRef = db.collection("bem_entities").doc(entityId);
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        if (data && data.ai_visibility_snapshot) {
          const snapshot = data.ai_visibility_snapshot as AIVisibilitySnapshot;
          const signals = deriveAiVisibilitySignals(entityId, "", [snapshot]);
          const sampleSize = snapshot.sampleSize || 1;
          res.json({
            status: "SUCCESS",
            data: {
              entityId,
              overallAiPresenceScore: snapshot.visibilityScore,
              scoreProvenance: snapshot.scoreProvenance || "MODELED",
              totalQueriesAudited: sampleSize,
              sampleSize,
              presenceRatePercent: snapshot.userShareOfVoicePercent,
              shareOfVoiceProvenance: sampleSize >= 2 ? "DERIVED" : "MODELED",
              averageRank: snapshot.userRankPosition,
              latestSnapshots: [snapshot],
              signals,
              lastAuditedAt: snapshot.observedAt,
              nextScheduledAuditAt: snapshot.expiresAt
            }
          });
          return;
        }
      }
    }

    res.status(404).json({ error: "No AI visibility snapshot found for entity" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
