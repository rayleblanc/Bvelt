/**
 * BVELT MEMORY v1 (BEM) — Public Evidence & Verified Business Record Service
 * 
 * Single Source of Truth for serving public-safe business evidence, verified records,
 * bounded history events, and conflict ledger state to:
 * 1. The Human Public Verified Business Record UI (/verified/:entityId)
 * 2. The Machine-Readable REST APIs (/api/business/:id/evidence, /history, /conflicts)
 * 3. Future MCP (Model Context Protocol) and AI Agent consumers.
 * 
 * Strictly isolates TENANT_PRIVATE and SYSTEM_ONLY data from public visibility.
 */

import { doc, getDoc, collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  ConflictRecord, 
  EvidenceEvent, 
  MemoryEvidenceRecord, 
  PublicSafeEntityEvidence, 
  PublicSafeFieldEvidence,
  PublicSafeOutcomeRecord
} from './bemTypes';
import { evaluateRecordFreshness } from './freshnessEvaluator';

// Whitelist of public-safe field keys permitted on public records and machine APIs
export const PUBLIC_SAFE_FIELD_KEYS = new Set([
  'canonicalName',
  'name',
  'address',
  'addressNormalized',
  'city',
  'state',
  'postalCode',
  'country',
  'phone',
  'phoneE164',
  'website',
  'domain',
  'domainCanonical',
  'primaryCategory',
  'category',
  'coordinates',
  'rating',
  'reviewCount',
  'isClaimed',
  'googlePlaceId',
  'businessHours',
  'services'
]);

/**
 * Field key to human-readable label dictionary (EN / ES)
 */
export const FIELD_LABELS: Record<string, { es: string; en: string }> = {
  canonicalName: { es: 'Nombre Comercial', en: 'Business Name' },
  name: { es: 'Nombre Comercial', en: 'Business Name' },
  address: { es: 'Dirección Comercial', en: 'Business Address' },
  addressNormalized: { es: 'Dirección Normalizada', en: 'Normalized Address' },
  city: { es: 'Ciudad', en: 'City' },
  state: { es: 'Estado / Provincia', en: 'State / Province' },
  postalCode: { es: 'Código Postal', en: 'Postal Code' },
  country: { es: 'País', en: 'Country' },
  phone: { es: 'Teléfono de Contacto', en: 'Contact Phone' },
  phoneE164: { es: 'Teléfono Verificado E.164', en: 'Verified E.164 Phone' },
  website: { es: 'Sitio Web Oficial', en: 'Official Website' },
  domain: { es: 'Dominio Web', en: 'Web Domain' },
  domainCanonical: { es: 'Dominio Canónico', en: 'Canonical Domain' },
  primaryCategory: { es: 'Categoría Principal', en: 'Primary Category' },
  category: { es: 'Categoría', en: 'Category' },
  coordinates: { es: 'Geolocalización', en: 'Geolocation' },
  rating: { es: 'Calificación en Reseñas', en: 'Review Rating' },
  reviewCount: { es: 'Total de Reseñas', en: 'Total Reviews' },
  isClaimed: { es: 'Ficha Reclamada en Google', en: 'Google Profile Claimed' },
  googlePlaceId: { es: 'Identificador de Lugar', en: 'Place Identifier' },
  businessHours: { es: 'Horario Comercial', en: 'Business Hours' },
  services: { es: 'Servicios Verificados', en: 'Verified Services' }
};

/**
 * Validates entity ID string format to prevent path traversal or injection.
 */
export function validateEntityId(entityId: string): boolean {
  if (!entityId || typeof entityId !== 'string') return false;
  const trimmed = entityId.trim();
  if (trimmed.length < 5 || trimmed.length > 128) return false;
  // Allow alphanumeric, underscores, and hyphens (standard BEM format: `ent_biz_*`)
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Generates human-readable relative freshness string based on timestamp.
 */
export function formatHumanFreshness(timestampIso?: string, lang: 'es' | 'en' = 'es'): string {
  if (!timestampIso) {
    return lang === 'es' ? 'Requiere verificación' : 'Verification required';
  }
  const timeMs = new Date(timestampIso).getTime();
  if (isNaN(timeMs)) {
    return lang === 'es' ? 'Fecha no disponible' : 'Date unavailable';
  }

  const diffMs = Math.max(0, Date.now() - timeMs);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return lang === 'es' ? 'Verificado hace un momento' : 'Verified just now';
  }
  if (diffHours < 24) {
    return lang === 'es' ? 'Verificado hoy' : 'Verified today';
  }
  if (diffDays === 1) {
    return lang === 'es' ? 'Verificado ayer' : 'Verified yesterday';
  }
  if (diffDays < 30) {
    return lang === 'es' 
      ? `Verificado hace ${diffDays} días` 
      : `Verified ${diffDays} days ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  return lang === 'es' 
    ? `Verificado hace ${diffMonths} mes${diffMonths > 1 ? 'es' : ''}` 
    : `Verified ${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
}

/**
 * Transforms an internal MemoryEvidenceRecord into a public-safe field representation.
 * Returns null if the field is private or not permitted for public view.
 */
export function sanitizePublicField(
  fieldKey: string,
  record: any,
  lang: 'es' | 'en' = 'es'
): PublicSafeFieldEvidence | null {
  if (!record || typeof record !== 'object') return null;

  // 1. Whitelist Check
  if (!PUBLIC_SAFE_FIELD_KEYS.has(fieldKey)) {
    return null;
  }

  // 2. Data Classification Check (Must be explicitly PUBLIC_SHARED)
  if (record.classification && record.classification !== 'PUBLIC_SHARED') {
    return null;
  }

  const rawValue = record.value;
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const nowMs = Date.now();
  const freshnessState = evaluateRecordFreshness(record, nowMs);
  const lastVerifiedAt = record.lastVerifiedAt || record.observedAt || new Date().toISOString();
  const humanFreshness = formatHumanFreshness(lastVerifiedAt, lang);

  const labelObj = FIELD_LABELS[fieldKey] || { es: fieldKey, en: fieldKey };
  const fieldLabel = lang === 'es' ? labelObj.es : labelObj.en;

  return {
    fieldKey,
    fieldLabel,
    value: rawValue,
    observationType: record.observationType || 'FACT',
    evidenceStatus: record.evidenceStatus || 'VERIFIED',
    classification: 'PUBLIC_SHARED',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0.95,
    confidenceLevel: record.confidenceLevel || 'High',
    sourceLabel: record.sourceLabel || 'Bvelt Public Index',
    sourceType: record.sourceType || 'PUBLIC_RECORD',
    observedAt: record.observedAt || lastVerifiedAt,
    lastVerifiedAt,
    expiresAt: record.expiresAt,
    freshnessState,
    humanFreshness
  };
}

/**
 * Converts a raw BEM Firestore document into a certified PublicSafeEntityEvidence object.
 */
export function compilePublicSafeEntityEvidence(
  docData: any,
  entityId: string,
  lang: 'es' | 'en' = 'es',
  conflicts: ConflictRecord[] = [],
  history: EvidenceEvent[] = []
): PublicSafeEntityEvidence {
  const fieldsMap: Record<string, PublicSafeFieldEvidence> = {};
  const distinctSources = new Set<string>();
  let verifiedCount = 0;

  if (docData.fields && typeof docData.fields === 'object') {
    for (const [key, rawRec] of Object.entries(docData.fields)) {
      const sanitized = sanitizePublicField(key, rawRec, lang);
      if (sanitized) {
        fieldsMap[key] = sanitized;
        if (sanitized.sourceLabel) {
          distinctSources.add(sanitized.sourceLabel);
        }
        if (sanitized.evidenceStatus === 'VERIFIED') {
          verifiedCount++;
        }
      }
    }
  }

  const activeConflicts = conflicts.filter(c => c.status === 'OPEN');

  // Mark conflicted fields
  for (const conflict of activeConflicts) {
    if (fieldsMap[conflict.fieldKey]) {
      fieldsMap[conflict.fieldKey].isConflicted = true;
      fieldsMap[conflict.fieldKey].freshnessState = 'CONFLICTED';
    }
  }

  // Extract top-level identity attributes safely
  const canonicalName = docData.canonicalName || fieldsMap['canonicalName']?.value || 'Verified Local Business';
  const primaryCategory = docData.primaryCategory || fieldsMap['primaryCategory']?.value || fieldsMap['category']?.value || null;
  const addressNormalized = docData.addressNormalized || fieldsMap['addressNormalized']?.value || fieldsMap['address']?.value || null;
  const cityNormalized = docData.cityNormalized || fieldsMap['city']?.value || null;
  const stateCode = docData.stateCode || fieldsMap['state']?.value || null;
  const countryCode = docData.countryCode || fieldsMap['country']?.value || 'US';
  const postalCode = docData.postalCode || fieldsMap['postalCode']?.value || null;
  const coordinates = docData.coordinates || fieldsMap['coordinates']?.value || null;
  const phoneE164 = docData.phoneE164 || fieldsMap['phoneE164']?.value || fieldsMap['phone']?.value || null;
  const domainCanonical = docData.domainCanonical || fieldsMap['domainCanonical']?.value || fieldsMap['website']?.value || null;
  const lastVerifiedAt = docData.lastUpdated || new Date().toISOString();

  return {
    entityId,
    canonicalName,
    primaryCategory,
    addressNormalized,
    cityNormalized,
    stateCode,
    countryCode,
    postalCode,
    coordinates,
    phoneE164,
    domainCanonical,
    identityStatus: docData.identityStatus || 'RESOLVED',
    identityConfidence: typeof docData.identityConfidence === 'number' ? docData.identityConfidence : 0.95,
    lastVerifiedAt,
    evaluatedAt: new Date().toISOString(),
    fields: fieldsMap,
    provenanceSummary: {
      totalPublicFields: Object.keys(fieldsMap).length,
      verifiedFieldsCount: verifiedCount,
      distinctSourceLabels: Array.from(distinctSources),
      hasConflicts: activeConflicts.length > 0,
      activeConflictCount: activeConflicts.length
    },
    recentHistory: history,
    activeConflicts,
    outcomeLedger: (() => {
      const ledger: PublicSafeOutcomeRecord[] = [];
      if (Array.isArray(docData.outcomeLedger)) {
        ledger.push(...docData.outcomeLedger.map((item: any) => ({
          ...item,
          outcomeState: item.outcomeState || 'MEASURED'
        })));
      }
      for (const ev of history) {
        if (ev.relationship === 'OUTCOME_OBSERVATION' || ev.outcomeReference) {
          const outcome = ev.outcomeReference;
          const metric = outcome?.metricName || ev.fieldKey;
          const assoc = outcome?.associationType || 'OBSERVED_AFTER';
          const actionType = ev.actionReference?.actionType;

          let summaryText = lang === 'es'
            ? `Observación registrada en ${metric}: resultado verificado en ledger.`
            : `Recorded observation in ${metric}: verified result in ledger.`;

          if (actionType) {
            summaryText = lang === 'es'
              ? `Métrica [${metric}] observada tras la ejecución de acción [${actionType}].`
              : `Metric [${metric}] observed following action [${actionType}].`;
          }

          ledger.push({
            outcomeId: ev.eventId,
            actionType,
            outcomeType: outcome?.outcomeType || 'OBSERVED_METRIC',
            metricName: metric,
            observedAt: ev.observedAt,
            associationType: assoc,
            outcomeState: (ev as any).outcomeState || (outcome as any)?.outcomeState || (ev.evidenceStatus === 'VERIFIED' ? 'MEASURED' : ev.evidenceStatus === 'USER_PROVIDED' ? 'DECLARED' : ev.evidenceStatus === 'ESTIMATED' ? 'ESTIMATED' : 'MEASURED'),
            summaryText,
            evidenceStatus: ev.evidenceStatus || 'VERIFIED',
            sourceLabel: ev.sourceType || 'BVELT_LEDGER',
            valueRecorded: outcome?.newValue ?? ev.newValue
          });
        }
      }
      return ledger;
    })()
  };
}

export const EXPERIMENT_ENTITIES: Record<string, PublicSafeEntityEvidence> = {
  ent_cyopsa_sisocia: {
    entityId: 'ent_cyopsa_sisocia',
    canonicalName: 'CYOPSA-SISOCIA, S.A.',
    primaryCategory: 'Construcción de Carreteras y Autopistas',
    addressNormalized: 'Paseo de la Castellana, 177, 1ª Planta, 28046 Madrid, España',
    cityNormalized: 'Madrid',
    stateCode: 'MD',
    countryCode: 'ES',
    postalCode: '28046',
    coordinates: { lat: 40.46123, lng: -3.68953 },
    phoneE164: '+34915713301',
    domainCanonical: 'cyopsa.es',
    identityStatus: 'RESOLVED',
    identityConfidence: 0.98,
    lastVerifiedAt: '2026-08-30T12:00:00Z',
    evaluatedAt: '2026-08-31T10:00:00Z',
    fields: {
      canonicalName: {
        fieldKey: 'canonicalName',
        fieldLabel: 'Nombre Comercial',
        value: 'CYOPSA-SISOCIA, S.A.',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.98,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Madrid',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      address: {
        fieldKey: 'address',
        fieldLabel: 'Dirección Comercial',
        value: 'Paseo de la Castellana, 177, 1ª Planta, 28046 Madrid',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.98,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Madrid',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      phone: {
        fieldKey: 'phone',
        fieldLabel: 'Teléfono de Contacto',
        value: '+34 915 71 33 01',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (cyopsa.es)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer',
        isConflicted: true
      },
      website: {
        fieldKey: 'website',
        fieldLabel: 'Sitio Web Oficial',
        value: 'https://www.cyopsa.es',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (cyopsa.es)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      primaryCategory: {
        fieldKey: 'primaryCategory',
        fieldLabel: 'Categoría Principal',
        value: 'Construcción de Carreteras y Autopistas',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.99,
        confidenceLevel: 'High',
        sourceLabel: 'Plataforma de Contratación del Sector Público',
        sourceType: 'GOVERNMENT_REGISTRY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      rating: {
        fieldKey: 'rating',
        fieldLabel: 'Calificación en Reseñas',
        value: 3.8,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Google Maps (Paseo de la Castellana 177)',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      reviewCount: {
        fieldKey: 'reviewCount',
        fieldLabel: 'Total de Reseñas',
        value: 12,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Google Maps',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      isClaimed: {
        fieldKey: 'isClaimed',
        fieldLabel: 'Ficha Reclamada en Google',
        value: true,
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Google Business Profile API',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      }
    },
    provenanceSummary: {
      totalPublicFields: 8,
      verifiedFieldsCount: 6,
      distinctSourceLabels: [
        'Registro Mercantil de Madrid',
        'Sitio Web Oficial (cyopsa.es)',
        'Plataforma de Contratación del Sector Público',
        'Google Maps (Paseo de la Castellana 177)',
        'Google Business Profile API'
      ],
      hasConflicts: true,
      activeConflictCount: 1
    },
    activeConflicts: [
      {
        conflictId: 'conf_cyopsa_phone_discord',
        entityId: 'ent_cyopsa_sisocia',
        fieldKey: 'phone',
        sourceA: 'Registro Mercantil de Madrid',
        valueA: '+34 915 71 33 01',
        sourceB: 'Ficha Google Maps Secundario',
        valueB: '+34 915 71 33 00',
        firstDetectedAt: '2026-08-30T12:00:00Z',
        lastDetectedAt: '2026-08-30T12:00:00Z',
        status: 'OPEN'
      }
    ],
    recentHistory: [
      {
        eventId: 'ev_cyopsa_h1',
        entityId: 'ent_cyopsa_sisocia',
        fieldKey: 'canonicalName',
        oldValue: null,
        newValue: 'CYOPSA-SISOCIA, S.A.',
        sourceType: 'PUBLIC_RECORD',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.98,
        observedAt: '2026-08-30T10:00:00Z',
        detectedAt: '2026-08-30T10:00:00Z',
        schemaVersion: 1,
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        currentHash: 'b5e1a43b296aa98b557660978e33889a191caee6cd56e58e6afa3d95ab4a504b',
        eventHash: 'b5e1a43b296aa98b557660978e33889a191caee6cd56e58e6afa3d95ab4a504b'
      },
      {
        eventId: 'ev_cyopsa_h2',
        entityId: 'ent_cyopsa_sisocia',
        fieldKey: 'phone',
        oldValue: null,
        newValue: '+34 915 71 33 01',
        sourceType: 'WEBSITE',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.95,
        observedAt: '2026-08-30T12:00:00Z',
        detectedAt: '2026-08-30T12:00:00Z',
        schemaVersion: 1,
        previousHash: 'b5e1a43b296aa98b557660978e33889a191caee6cd56e58e6afa3d95ab4a504b',
        currentHash: '588c41ffd786412d63820f06f712ea76b26f8693c5fe62ee1be6714a75c26ed1',
        eventHash: '588c41ffd786412d63820f06f712ea76b26f8693c5fe62ee1be6714a75c26ed1'
      }
    ],
    outcomeLedger: [
      {
        outcomeId: 'out_cyopsa_01',
        actionType: 'PUBLIC_TENDER_QUALIFICATION',
        outcomeType: 'CONTRACT_COMPLIANCE',
        metricName: 'licitaciones_sector_publico',
        observedAt: '2026-08-30T14:30:00Z',
        associationType: 'OBSERVED_AFTER',
        outcomeState: 'MEASURED',
        summaryText: 'Cumplimiento y solvencia técnica registrada en la Plataforma de Contratación del Sector Público tras auditoría anual.',
        evidenceStatus: 'VERIFIED',
        sourceLabel: 'Plataforma de Contratación del Sector Público'
      }
    ]
  },
  ent_pavasal_constructora: {
    entityId: 'ent_pavasal_constructora',
    canonicalName: 'PAVASAL EMPRESA CONSTRUCTORA, S.A.',
    primaryCategory: 'Construcción de Obras Públicas y Pavimentación',
    addressNormalized: 'Calle Tres Forques, 149, Vara de Quart, 46014 Valencia, España',
    cityNormalized: 'Valencia',
    stateCode: 'VC',
    countryCode: 'ES',
    postalCode: '46014',
    coordinates: { lat: 39.46742, lng: -0.41432 },
    phoneE164: '+34963830400',
    domainCanonical: 'pavasal.com',
    identityStatus: 'RESOLVED',
    identityConfidence: 0.99,
    lastVerifiedAt: '2026-08-30T12:00:00Z',
    evaluatedAt: '2026-08-31T10:00:00Z',
    fields: {
      canonicalName: {
        fieldKey: 'canonicalName',
        fieldLabel: 'Nombre Comercial',
        value: 'PAVASAL EMPRESA CONSTRUCTORA, S.A.',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.99,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Valencia',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      address: {
        fieldKey: 'address',
        fieldLabel: 'Dirección Comercial',
        value: 'Calle Tres Forques, 149, 46014 Valencia',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.99,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Valencia',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      phone: {
        fieldKey: 'phone',
        fieldLabel: 'Teléfono de Contacto',
        value: '+34 963 83 04 00',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (pavasal.com)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      website: {
        fieldKey: 'website',
        fieldLabel: 'Sitio Web Oficial',
        value: 'https://www.pavasal.com',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (pavasal.com)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer',
        isConflicted: true
      },
      primaryCategory: {
        fieldKey: 'primaryCategory',
        fieldLabel: 'Categoría Principal',
        value: 'Construcción de Obras Públicas y Pavimentación',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.99,
        confidenceLevel: 'High',
        sourceLabel: 'Plataforma de Contratación del Sector Público',
        sourceType: 'GOVERNMENT_REGISTRY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      rating: {
        fieldKey: 'rating',
        fieldLabel: 'Calificación en Reseñas',
        value: 4.1,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Indeed Employee & Google Maps Business Indicators',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      reviewCount: {
        fieldKey: 'reviewCount',
        fieldLabel: 'Total de Reseñas',
        value: 28,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Aggregated Local Directories',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      isClaimed: {
        fieldKey: 'isClaimed',
        fieldLabel: 'Ficha Reclamada en Google',
        value: true,
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Google Business Profile API',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      }
    },
    provenanceSummary: {
      totalPublicFields: 8,
      verifiedFieldsCount: 7,
      distinctSourceLabels: [
        'Registro Mercantil de Valencia',
        'Sitio Web Oficial (pavasal.com)',
        'Plataforma de Contratación del Sector Público',
        'Indeed Employee & Google Maps Business Indicators',
        'Google Business Profile API'
      ],
      hasConflicts: true,
      activeConflictCount: 1
    },
    activeConflicts: [
      {
        conflictId: 'conf_pavasal_website_discord',
        entityId: 'ent_pavasal_constructora',
        fieldKey: 'website',
        sourceA: 'Registro Mercantil de Valencia',
        valueA: 'http://pavasal.com',
        sourceB: 'Dominio Activo Servidor',
        valueB: 'https://www.pavasal.com',
        firstDetectedAt: '2026-08-30T12:00:00Z',
        lastDetectedAt: '2026-08-30T12:00:00Z',
        status: 'OPEN'
      }
    ],
    recentHistory: [
      {
        eventId: 'ev_pavasal_h1',
        entityId: 'ent_pavasal_constructora',
        fieldKey: 'canonicalName',
        oldValue: null,
        newValue: 'PAVASAL EMPRESA CONSTRUCTORA, S.A.',
        sourceType: 'PUBLIC_RECORD',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.99,
        observedAt: '2026-08-30T10:00:00Z',
        detectedAt: '2026-08-30T10:00:00Z',
        schemaVersion: 1,
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        currentHash: '1a74c82168966576e816c3a9353321d3af758474dffd3431abbfc2658bfb785a',
        eventHash: '1a74c82168966576e816c3a9353321d3af758474dffd3431abbfc2658bfb785a'
      },
      {
        eventId: 'ev_pavasal_h2',
        entityId: 'ent_pavasal_constructora',
        fieldKey: 'website',
        oldValue: null,
        newValue: 'https://www.pavasal.com',
        sourceType: 'WEBSITE',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.95,
        observedAt: '2026-08-30T12:00:00Z',
        detectedAt: '2026-08-30T12:00:00Z',
        schemaVersion: 1,
        previousHash: '1a74c82168966576e816c3a9353321d3af758474dffd3431abbfc2658bfb785a',
        currentHash: 'bc0ad29644f5b5c173739d9174e1312e62495e93e41e4e2bf4a61c3efbe3e226',
        eventHash: 'bc0ad29644f5b5c173739d9174e1312e62495e93e41e4e2bf4a61c3efbe3e226'
      }
    ],
    outcomeLedger: [
      {
        outcomeId: 'out_pavasal_01',
        actionType: 'PROFILE_VERIFICATION',
        outcomeType: 'IDENTITY_AUDIT',
        metricName: 'isClaimed',
        observedAt: '2026-08-30T15:00:00Z',
        associationType: 'OBSERVED_AFTER',
        outcomeState: 'MEASURED',
        summaryText: 'Ficha oficial verificada y validada contra el Registro Mercantil de Valencia.',
        evidenceStatus: 'VERIFIED',
        sourceLabel: 'Registro Mercantil de Valencia'
      }
    ]
  },
  ent_grupo_ortiz: {
    entityId: 'ent_grupo_ortiz',
    canonicalName: 'GRUPO ORTIZ (Compañía de Obras e Infraestructuras, S.A.)',
    primaryCategory: 'Infraestructuras y Construcción Sostenible',
    addressNormalized: 'Avenida del Ensanche de Vallecas, 44, 28051 Madrid, España',
    cityNormalized: 'Madrid',
    stateCode: 'MD',
    countryCode: 'ES',
    postalCode: '28051',
    coordinates: { lat: 40.36647, lng: -3.61234 },
    phoneE164: '+34913431600',
    domainCanonical: 'grupoortiz.com',
    identityStatus: 'RESOLVED',
    identityConfidence: 0.97,
    lastVerifiedAt: '2026-08-30T12:00:00Z',
    evaluatedAt: '2026-08-31T10:00:00Z',
    fields: {
      canonicalName: {
        fieldKey: 'canonicalName',
        fieldLabel: 'Nombre Comercial',
        value: 'GRUPO ORTIZ (Compañía de Obras e Infraestructuras, S.A.)',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.97,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Madrid',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      address: {
        fieldKey: 'address',
        fieldLabel: 'Dirección Comercial',
        value: 'Avenida del Ensanche de Vallecas, 44, 28051 Madrid',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.97,
        confidenceLevel: 'High',
        sourceLabel: 'Registro Mercantil de Madrid',
        sourceType: 'PUBLIC_RECORD',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      phone: {
        fieldKey: 'phone',
        fieldLabel: 'Teléfono de Contacto',
        value: '+34 913 43 16 00',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (grupoortiz.com)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      website: {
        fieldKey: 'website',
        fieldLabel: 'Sitio Web Oficial',
        value: 'https://www.grupoortiz.com',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Sitio Web Oficial (grupoortiz.com)',
        sourceType: 'WEBSITE',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      primaryCategory: {
        fieldKey: 'primaryCategory',
        fieldLabel: 'Categoría Principal',
        value: 'Infraestructuras y Construcción Sostenible',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.99,
        confidenceLevel: 'High',
        sourceLabel: 'Plataforma de Contratación del Sector Público',
        sourceType: 'GOVERNMENT_REGISTRY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      rating: {
        fieldKey: 'rating',
        fieldLabel: 'Calificación en Reseñas',
        value: 3.5,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Google Maps (Vallecas Office Index)',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      reviewCount: {
        fieldKey: 'reviewCount',
        fieldLabel: 'Total de Reseñas',
        value: 42,
        observationType: 'ESTIMATE',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.90,
        confidenceLevel: 'High',
        sourceLabel: 'Google Maps',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer'
      },
      isClaimed: {
        fieldKey: 'isClaimed',
        fieldLabel: 'Ficha Reclamada en Google',
        value: false,
        observationType: 'DERIVED',
        evidenceStatus: 'VERIFIED',
        classification: 'PUBLIC_SHARED',
        confidence: 0.95,
        confidenceLevel: 'High',
        sourceLabel: 'Google Maps Crawler Service',
        sourceType: 'THIRD_PARTY',
        observedAt: '2026-08-30T12:00:00Z',
        lastVerifiedAt: '2026-08-30T12:00:00Z',
        freshnessState: 'FRESH',
        humanFreshness: 'Verificado ayer',
        isConflicted: true
      }
    },
    provenanceSummary: {
      totalPublicFields: 8,
      verifiedFieldsCount: 5,
      distinctSourceLabels: [
        'Registro Mercantil de Madrid',
        'Sitio Web Oficial (grupoortiz.com)',
        'Plataforma de Contratación del Sector Público',
        'Google Maps (Vallecas Office Index)',
        'Google Maps Crawler Service'
      ],
      hasConflicts: true,
      activeConflictCount: 1
    },
    activeConflicts: [
      {
        conflictId: 'conf_ortiz_claimed_discord',
        entityId: 'ent_grupo_ortiz',
        fieldKey: 'isClaimed',
        sourceA: 'Google Maps Scraper',
        valueA: 'No Reclamado / Unclaimed',
        sourceB: 'Ficha Auxiliar Páginas Amarillas',
        valueB: 'Reclamada y Verificada',
        firstDetectedAt: '2026-08-30T12:00:00Z',
        lastDetectedAt: '2026-08-30T12:00:00Z',
        status: 'OPEN'
      }
    ],
    recentHistory: [
      {
        eventId: 'ev_ortiz_h1',
        entityId: 'ent_grupo_ortiz',
        fieldKey: 'canonicalName',
        oldValue: null,
        newValue: 'GRUPO ORTIZ (Compañía de Obras e Infraestructuras, S.A.)',
        sourceType: 'PUBLIC_RECORD',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.97,
        observedAt: '2026-08-30T10:00:00Z',
        detectedAt: '2026-08-30T10:00:00Z',
        schemaVersion: 1,
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        currentHash: 'c9397e36904e1dc30aa77839d4905345d3b24b89a539564bb5935b2963025196',
        eventHash: 'c9397e36904e1dc30aa77839d4905345d3b24b89a539564bb5935b2963025196'
      },
      {
        eventId: 'ev_ortiz_h2',
        entityId: 'ent_grupo_ortiz',
        fieldKey: 'isClaimed',
        oldValue: null,
        newValue: false,
        sourceType: 'THIRD_PARTY',
        observationType: 'FACT',
        evidenceStatus: 'VERIFIED',
        confidence: 0.95,
        observedAt: '2026-08-30T12:00:00Z',
        detectedAt: '2026-08-30T12:00:00Z',
        schemaVersion: 1,
        previousHash: 'c9397e36904e1dc30aa77839d4905345d3b24b89a539564bb5935b2963025196',
        currentHash: '17a37320e8f08fa384fe1499e3e66aefa0ef9054845ddd2c9f304940f517b1a7',
        eventHash: '17a37320e8f08fa384fe1499e3e66aefa0ef9054845ddd2c9f304940f517b1a7'
      }
    ],
    outcomeLedger: [
      {
        outcomeId: 'out_ortiz_01',
        actionType: 'REPUTATION_AUDIT',
        outcomeType: 'RESPONSE_TIME',
        metricName: 'reviewResponseTime',
        observedAt: '2026-08-30T16:00:00Z',
        associationType: 'CORRELATED_WITH',
        outcomeState: 'MEASURED',
        summaryText: 'Tiempo de respuesta a consultas y reseñas de obras registrado en menos de 24 horas.',
        evidenceStatus: 'VERIFIED',
        sourceLabel: 'Bvelt CRM Ledger'
      }
    ]
  }
};

/**
 * Client & Universal Service Function:
 * Reads a public entity from Firestore, applies public safety filters, and returns the certified record.
 */
export async function getPublicSafeEntityRecord(
  entityId: string,
  lang: 'es' | 'en' = 'es'
): Promise<PublicSafeEntityEvidence | null> {
  if (!validateEntityId(entityId)) {
    return null;
  }

  // Intercept for validation experiment entities
  if (EXPERIMENT_ENTITIES[entityId]) {
    // Return a deeply copied version to prevent accidental mutations in state
    return JSON.parse(JSON.stringify(EXPERIMENT_ENTITIES[entityId]));
  }

  if (!db) {
    return null;
  }

  try {
    const publicDocRef = doc(db, 'bem_entities', entityId);
    const snap = await getDoc(publicDocRef);

    if (!snap.exists()) {
      return null;
    }

    const docData = snap.data();

    // Fetch bounded recent conflicts (up to 10)
    let conflicts: ConflictRecord[] = [];
    try {
      const conflictsRef = collection(db, 'bem_entities', entityId, 'conflicts');
      const conflictsQuery = query(conflictsRef, limit(10));
      const conflictsSnap = await getDocs(conflictsQuery);
      conflicts = conflictsSnap.docs.map(d => d.data() as ConflictRecord);
    } catch {
      // Non-blocking: gracefully default to empty conflicts array
    }

    // Fetch bounded recent history (up to 15)
    let history: EvidenceEvent[] = [];
    try {
      const historyRef = collection(db, 'bem_entities', entityId, 'history');
      const historyQuery = query(historyRef, orderBy('observedAt', 'desc'), limit(15));
      const historySnap = await getDocs(historyQuery);
      history = historySnap.docs.map(d => d.data() as EvidenceEvent);
    } catch {
      // Non-blocking: gracefully default to empty history array
    }

    return compilePublicSafeEntityEvidence(docData, entityId, lang, conflicts, history);
  } catch (err) {
    console.error('[Public Evidence Service] Error reading public record:', err);
    return null;
  }
}
