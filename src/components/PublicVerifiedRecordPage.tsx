import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Globe, 
  Phone, 
  MapPin, 
  Star, 
  Clock, 
  AlertTriangle, 
  Share2, 
  Copy, 
  ExternalLink, 
  ArrowLeft, 
  Building2, 
  Check, 
  Layers, 
  RefreshCw,
  Search,
  GitCommit,
  Hash,
  TrendingUp,
  CheckCircle2,
  Activity,
  FileText,
  Lock,
  Calendar,
  AlertCircle,
  History,
  WifiOff,
  Download
} from 'lucide-react';
import { 
  PublicSafeEntityEvidence, 
  PublicSafeFieldEvidence, 
  PublicSafeOutcomeRecord,
  EvidenceEvent 
} from '../knowledge/memory/bemTypes';
import { 
  getPublicSafeEntityRecord, 
  formatHumanFreshness,
  FIELD_LABELS 
} from '../knowledge/memory/publicEvidenceService';
import { EvidenceBadge } from './EvidenceBadge';
import { 
  verifyEvidenceChain, 
  EvidenceChainVerificationResult 
} from '../knowledge/memory/integrity/evidenceIntegrity';
import { 
  cacheVerifiedRecordOffline, 
  getOfflineVerifiedRecord 
} from '../lib/pwa/offlineEvidenceCache';
import { shareVerifiedRecord } from '../lib/pwa/webShare';

interface PublicVerifiedRecordPageProps {
  entityId: string;
  lang?: 'es' | 'en';
  onNavigateHome?: () => void;
  onNavigateAudit?: () => void;
}

export const PublicVerifiedRecordPage: React.FC<PublicVerifiedRecordPageProps> = ({
  entityId,
  lang: initialLang = 'es',
  onNavigateHome,
  onNavigateAudit
}) => {
  const [lang, setLang] = useState<'es' | 'en'>(initialLang);
  const [record, setRecord] = useState<PublicSafeEntityEvidence | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [experimentMode, setExperimentMode] = useState<'CONTROL' | 'BVELT'>('BVELT');
  const [chainIntegrity, setChainIntegrity] = useState<EvidenceChainVerificationResult | null>(null);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);

  const isExperimentEntity = ['ent_cyopsa_sisocia', 'ent_pavasal_constructora', 'ent_grupo_ortiz'].includes(entityId);

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  useEffect(() => {
    let isMounted = true;
    async function loadRecord() {
      if (!entityId) {
        setError(t('Identificador de negocio no proporcionado.', 'Business entity ID not provided.'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setIsOfflineCached(false);

      try {
        // 1. First attempt: call machine-readable public API
        const apiResp = await fetch(`/api/business/${encodeURIComponent(entityId)}/evidence?lang=${lang}`).catch(() => null);
        if (apiResp && apiResp.ok) {
          const json = await apiResp.json();
          if (json.status === 'SUCCESS' && json.data) {
            if (isMounted) {
              setRecord(json.data);
              setLoading(false);
              cacheVerifiedRecordOffline(entityId, json.data).catch(() => {});
              return;
            }
          }
        }

        // 2. Fallback attempt: Client Firestore / BEM service directly
        const clientRecord = await getPublicSafeEntityRecord(entityId, lang);
        if (isMounted) {
          if (clientRecord) {
            setRecord(clientRecord);
            cacheVerifiedRecordOffline(entityId, clientRecord).catch(() => {});
          } else {
            // Check offline cache before setting error
            const offlineRecord = await getOfflineVerifiedRecord(entityId);
            if (offlineRecord) {
              setRecord(offlineRecord);
              setIsOfflineCached(true);
            } else {
              setError(t('No se encontró ningún registro público verificado para este identificador.', 'No verified public record found for this business identifier.'));
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[PublicVerifiedRecordPage] Load failed:', err);
          // Try local offline store cache
          const offlineRecord = await getOfflineVerifiedRecord(entityId).catch(() => null);
          if (offlineRecord) {
            setRecord(offlineRecord);
            setIsOfflineCached(true);
            setLoading(false);
          } else {
            setError(t('Error al consultar el registro de evidencia pública.', 'Error retrieving public evidence record.'));
            setLoading(false);
          }
        }
      }
    }

    loadRecord();
    return () => { isMounted = false; };
  }, [entityId, lang]);

  useEffect(() => {
    let isCancelled = false;
    if (record?.recentHistory && record.recentHistory.length > 0) {
      verifyEvidenceChain(record.recentHistory)
        .then((res) => {
          if (!isCancelled) setChainIntegrity(res);
        })
        .catch((err) => {
          console.warn('[PublicVerifiedRecordPage] Chain verification error:', err);
          if (!isCancelled) {
            setChainIntegrity({
              isValid: false,
              totalEvents: record.recentHistory?.length || 0,
              headHash: null,
              details: 'Error validando cadena de hashes'
            });
          }
        });
    } else {
      setChainIntegrity(null);
    }
    return () => { isCancelled = true; };
  }, [record]);

  const handleCopyLink = async () => {
    const businessName = record?.businessName || 'Business';
    const recId = record?.entityId || entityId;
    const shareRes = await shareVerifiedRecord(businessName, recId, lang);
    if (shareRes.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    });
  };

  if (loading) {
    return (
      <div id="verified-record-loading" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-6">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-200 tracking-tight">
          {t('Consultando Registro de Evidencia BVELT...', 'Verifying BVELT Evidence Record...')}
        </h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm text-center">
          {t('Verificando firmas de procedencia, consenso entre fuentes y ledger de memoria.', 'Verifying provenance signatures, multi-source consensus, and memory ledger.')}
        </p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div id="verified-record-error" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            {t('Registro No Encontrado', 'Record Not Found')}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {error || t('No se pudo verificar la identidad para este registro.', 'Could not verify entity identity for this record.')}
          </p>
          <div className="flex flex-col gap-3">
            {onNavigateAudit && (
              <button
                id="btn-error-run-audit"
                onClick={onNavigateAudit}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {t('Escanear y Verificar mi Negocio Gratis', 'Scan & Verify My Business for Free')}
              </button>
            )}
            {onNavigateHome && (
              <button
                id="btn-error-go-home"
                onClick={onNavigateHome}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Volver al Inicio', 'Back to Home')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const rawFieldsMap = record.fields || {};
  
  // Standard core business fields checked for all verified records
  const CORE_FIELD_KEYS = [
    'canonicalName',
    'primaryCategory',
    'address',
    'phone',
    'website',
    'rating',
    'isClaimed',
    'businessHours'
  ];

  const presentFields: PublicSafeFieldEvidence[] = Object.values(rawFieldsMap);
  const presentFieldKeys = new Set(presentFields.map(f => f.fieldKey));

  // For any standard core field not registered in public sources, maintain deterministic INSUFFICIENT_DATA
  const missingCoreFields: PublicSafeFieldEvidence[] = CORE_FIELD_KEYS
    .filter(key => !presentFieldKeys.has(key))
    .map(key => {
      const labelObj = FIELD_LABELS[key] || { es: key, en: key };
      return {
        fieldKey: key,
        fieldLabel: lang === 'es' ? labelObj.es : labelObj.en,
        value: null,
        observationType: 'FACT',
        evidenceStatus: 'INSUFFICIENT_DATA',
        classification: 'PUBLIC_SHARED',
        confidence: 0,
        confidenceLevel: 'Low',
        sourceLabel: t('Sin registrar en fuentes públicas auditadas', 'Unregistered in audited public sources'),
        sourceType: 'SYSTEM',
        observedAt: record.evaluatedAt,
        lastVerifiedAt: record.lastVerifiedAt,
        freshnessState: 'MISSING',
        humanFreshness: t('Dato no localizado', 'Data not found')
      };
    });

  const fields: PublicSafeFieldEvidence[] = [...presentFields, ...missingCoreFields];
  const activeConflicts = record.activeConflicts || [];
  const hasConflicts = activeConflicts.length > 0;
  const outcomeLedger = record.outcomeLedger || [];
  const recentHistory = record.recentHistory || [];

  if (experimentMode === 'CONTROL') {
    return (
      <div id="public-verified-record-page-control" className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Simple Experiment Control Header */}
        {isExperimentEntity && (
          <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold shadow-md sticky top-0 z-50">
            <span className="flex items-center gap-1.5">🧪 MODO EXPERIMENTO DE VALIDACIÓN COMERCIAL (BVELT FASE 2.10)</span>
            <div className="flex gap-2">
              <button
                onClick={() => setExperimentMode('CONTROL')}
                className="px-3 py-1.5 bg-white text-indigo-700 rounded shadow font-bold"
              >
                VERSIÓN CONTROL (Estrellas)
              </button>
              <button
                onClick={() => setExperimentMode('BVELT')}
                className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-900 text-white rounded transition"
              >
                VERSIÓN BVELT (Evidencia)
              </button>
            </div>
          </div>
        )}

        <header className="border-b border-slate-200 bg-white shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-bold text-slate-800 text-lg tracking-tight">Directorio Local de Empresas</span>
            {onNavigateHome && (
              <button onClick={onNavigateHome} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2">
              <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                {record.primaryCategory || 'Servicios y Contratistas'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {record.canonicalName}
              </h1>
              {record.cityNormalized && (
                <p className="text-slate-500 text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {record.addressNormalized || `${record.cityNormalized}, ${record.countryCode}`}
                </p>
              )}
            </div>

            {/* Reputation Block */}
            <div className="border-y border-slate-100 py-6 flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-amber-500 text-3xl font-extrabold">
                <Star className="w-8 h-8 fill-amber-500 text-amber-500" />
                <span>{record.fields.rating?.value || '0.0'}</span>
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg">
                  {record.fields.reviewCount?.value || '0'} opiniones de clientes
                </p>
                <p className="text-slate-500 text-xs mt-0.5">Calificación agregada basada en perfiles web públicos estándar</p>
              </div>
            </div>

            {/* Basic Contact Info */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Información General</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {record.fields.phone?.value && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-slate-500 text-xs font-medium">Teléfono de Contacto</p>
                    <p className="font-semibold text-slate-900 mt-1">{String(record.fields.phone.value)}</p>
                  </div>
                )}
                {record.fields.website?.value && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-slate-500 text-xs font-medium">Sitio Web Oficial</p>
                    <a
                      href={String(record.fields.website.value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-semibold mt-1 inline-flex items-center gap-1"
                    >
                      <span>Visitar sitio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 leading-relaxed">
            <strong>Versión de Control (Experimento):</strong> Esta pantalla simula la presentación tradicional de un negocio basada únicamente en estrellas de reputación y opiniones superficiales de clientes, sin verificación de procedencia de datos, auditorías de contratos ni libro de conflictos.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div id="public-verified-record-page" className="min-h-screen bg-slate-950 text-slate-100">
      {/* Simple Experiment Control Header */}
      {isExperimentEntity && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold shadow-md sticky top-0 z-50">
          <span className="flex items-center gap-1.5">🧪 MODO EXPERIMENTO DE VALIDACIÓN COMERCIAL (BVELT FASE 2.10)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setExperimentMode('CONTROL')}
              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-900 text-white rounded transition"
            >
              VERSIÓN CONTROL (Estrellas)
            </button>
            <button
              onClick={() => setExperimentMode('BVELT')}
              className="px-3 py-1.5 bg-white text-indigo-700 rounded shadow font-bold"
            >
              VERSIÓN BVELT (Evidencia)
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-12 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onNavigateHome && (
              <button
                id="btn-nav-home"
                onClick={onNavigateHome}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                title={t('Volver', 'Back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-wider text-sm sm:text-base text-slate-200">
                BVELT <span className="text-emerald-400 font-medium text-xs sm:text-sm uppercase tracking-widest">{t('Registro Verificado', 'Verified Record')}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-toggle-lang"
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
            <button
              id="btn-share-record"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('¡Enlace Copiado!', 'Link Copied!')}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('Compartir Ficha', 'Share Record')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {isOfflineCached && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-300">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">{t('REGISTRO GUARDADO SIN CONEXIÓN', 'OFFLINE CACHED RECORD')}</span>
              <span className="mx-2 opacity-50">•</span>
              <span>
                {t(
                  'Estás consultando una copia local inmutable almacenada en tu dispositivo. La firma criptográfica de la cadena se conserva intacta.',
                  'You are viewing an immutable local copy cached on your device. The cryptographic hash chain remains preserved.'
                )}
              </span>
            </div>
          </div>
        )}

        {/* Business Identity Hero Card */}
        <section id="business-identity-hero" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('IDENTIDAD VERIFICADA POR BVELT', 'BVELT VERIFIED IDENTITY')}</span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 tracking-tight">
                {record.canonicalName}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-400">
                {record.primaryCategory && (
                  <span className="inline-flex items-center gap-1.5 text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    {record.primaryCategory}
                  </span>
                )}
                {record.cityNormalized && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {record.cityNormalized}{record.stateCode ? `, ${record.stateCode}` : ''} ({record.countryCode || 'US'})
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {formatHumanFreshness(record.lastVerifiedAt, lang)}
                </span>
              </div>
            </div>

            {/* Entity ID & Machine Metadata Pill */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 min-w-[240px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Entity ID</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium">
                  {record.identityStatus}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-300 break-all select-all bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800">
                {record.entityId}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>{t('Consenso de Fuentes', 'Source Consensus')}</span>
                <span className="font-semibold text-slate-200">{record.provenanceSummary.verifiedFieldsCount} / {record.provenanceSummary.totalPublicFields} {t('campos', 'fields')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Conflict Status Banner */}
        {hasConflicts ? (
          <section id="conflict-status-alert" className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 sm:p-6 text-amber-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-base text-amber-100">
                  {t('Discrepancia de Evidencia Detectada', 'Evidence Conflict Detected')}
                </h3>
                <p className="text-sm text-amber-200/90 leading-relaxed">
                  {t(
                    'Se han detectado discrepancias activas entre diferentes fuentes públicas. El sistema mantiene ambos valores en el libro de conflictos hasta su conciliación verificada.',
                    'Active discrepancies detected between different public sources. The system preserves both values in the conflict ledger until verified reconciliation.'
                  )}
                </p>
                <div className="space-y-2 mt-3 pt-3 border-t border-amber-500/30">
                  {activeConflicts.map((c, idx) => (
                    <div key={idx} className="bg-slate-950/60 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-amber-500/20">
                      <span className="font-mono font-medium text-amber-300">{c.fieldKey}:</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300">{c.sourceA}: <strong className="text-slate-100">{String(c.valueA)}</strong></span>
                        <span className="text-amber-400 font-bold">≠</span>
                        <span className="text-slate-300">{c.sourceB}: <strong className="text-slate-100">{String(c.valueB)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section id="conflict-status-verified" className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-4 text-emerald-200 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span>
                {t(
                  'Todas las fuentes de datos registradas se encuentran en acuerdo activo. Cero conflictos abiertos.',
                  'All registered data sources are in active agreement. Zero open conflicts.'
                )}
              </span>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
              100% CONSISTENCY
            </span>
          </section>
        )}

        {/* Certified Evidence Fields Grid */}
        <section id="evidence-fields-grid" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                {t('Evidencia Certificada del Negocio', 'Certified Business Evidence')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('Hechos comprobables, fuentes públicas primarias y estado de verificación.', 'Audited facts, primary public sources, and verification status.')}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>{presentFields.length} {t('verificados', 'verified')}</span>
              {missingCoreFields.length > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400/90">{missingCoreFields.length} {t('insuficientes', 'insufficient')}</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div 
                key={field.fieldKey}
                className={`bg-slate-900/90 border rounded-xl p-4 space-y-3 transition hover:border-slate-700 flex flex-col justify-between ${
                  field.isConflicted 
                    ? 'border-amber-500/40 bg-amber-950/10' 
                    : field.evidenceStatus === 'INSUFFICIENT_DATA'
                    ? 'border-slate-800/60 bg-slate-950/40'
                    : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {field.fieldLabel}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {field.observationType || 'FACT'}
                      </span>
                      <EvidenceBadge status={field.evidenceStatus} t={t} size="xs" />
                    </div>
                  </div>

                  <div className="text-slate-100 font-medium text-base break-words min-h-[28px] flex items-center">
                    {field.value === null || field.value === undefined || field.evidenceStatus === 'INSUFFICIENT_DATA' ? (
                      <span className="text-slate-500 italic text-sm flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-slate-600" />
                        {t('Dato no localizado en fuentes públicas auditadas', 'Data not found in audited public sources')}
                      </span>
                    ) : field.fieldKey === 'website' || field.fieldKey === 'domain' ? (
                      <a 
                        href={String(field.value).startsWith('http') ? String(field.value) : `https://${field.value}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1.5"
                      >
                        <span>{String(field.value)}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : field.fieldKey === 'rating' ? (
                      <div className="flex items-center gap-2 text-amber-400">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold">{String(field.value)} / 5.0</span>
                      </div>
                    ) : field.fieldKey === 'phone' || field.fieldKey === 'phoneE164' ? (
                      <a href={`tel:${field.value}`} className="text-slate-200 hover:text-emerald-400 transition inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{String(field.value)}</span>
                      </a>
                    ) : field.fieldKey === 'coordinates' && field.value && typeof field.value === 'object' ? (
                      <span className="font-mono text-xs text-slate-300">
                        Lat: {Number((field.value as any).lat || 0).toFixed(5)}, Lng: {Number((field.value as any).lng || 0).toFixed(5)}
                      </span>
                    ) : field.fieldKey === 'isClaimed' ? (
                      <span className={field.value ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {field.value ? t('Ficha Verificada y Reclamada', 'Verified & Claimed') : t('Ficha No Reclamada', 'Unclaimed Profile')}
                      </span>
                    ) : (
                      <span>{String(field.value)}</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[210px] text-slate-400" title={field.sourceLabel}>
                    {field.sourceLabel || field.sourceType}
                  </span>
                  <span className="shrink-0 text-slate-400 font-mono text-[10px]">
                    {field.humanFreshness}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Outcome Ledger Section */}
        <section id="outcome-ledger-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                {t('Libro de Resultados y Desempeño (Outcome Ledger)', 'Verified Outcomes & Performance Ledger')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'Registro inmutable de resultados medidos y cambios observados tras acciones ejecutadas.',
                  'Immutable log of observed outcomes and measured performance following executed actions.'
                )}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {outcomeLedger.length} {t('asientos registrados', 'records logged')}
            </span>
          </div>

          {outcomeLedger.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outcomeLedger.map((outcome, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {outcome.metricName}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {outcome.outcomeState && (
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                            outcome.outcomeState === 'MEASURED'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : outcome.outcomeState === 'DECLARED'
                              ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                              : outcome.outcomeState === 'ESTIMATED'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-slate-500/15 border-slate-500/40 text-slate-300'
                          }`}>
                            {outcome.outcomeState === 'MEASURED'
                              ? t('ESTADO: MEDIDO', 'STATE: MEASURED')
                              : outcome.outcomeState === 'DECLARED'
                              ? t('ESTADO: DECLARADO', 'STATE: DECLARED')
                              : outcome.outcomeState === 'ESTIMATED'
                              ? t('ESTADO: ESTIMADO', 'STATE: ESTIMATED')
                              : t('ESTADO: DESCONOCIDO', 'STATE: UNKNOWN')}
                          </span>
                        )}
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                          {outcome.associationType === 'OBSERVED_AFTER' 
                            ? t('OBSERVADO TRAS ACCIÓN', 'OBSERVED AFTER ACTION')
                            : outcome.associationType === 'CORRELATED_WITH'
                            ? t('CORRELACIONADO', 'CORRELATED')
                            : t('INSUFICIENTE', 'INSUFFICIENT')}
                        </span>
                        <EvidenceBadge status={outcome.evidenceStatus} t={t} size="xs" />
                      </div>
                    </div>

                    <div className="text-sm text-slate-200 leading-relaxed font-medium">
                      {outcome.summaryText}
                    </div>

                    {outcome.actionType && (
                      <div className="text-xs text-slate-400 bg-slate-950/60 rounded p-2 border border-slate-800/80 mt-2">
                        <span className="text-slate-400 font-mono uppercase text-[10px]">{t('Acción Relacionada:', 'Related Action:')} </span>
                        <span className="text-slate-200 font-mono">{outcome.actionType}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span className="truncate max-w-[220px] text-slate-400" title={outcome.sourceLabel}>
                      {outcome.sourceLabel}
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {new Date(outcome.observedAt).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-1" />
              <p className="text-sm font-semibold text-slate-300">
                {t('Sin registros de resultados previos', 'No previous outcome records')}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {t(
                  'Este negocio no cuenta con observaciones de impacto registradas aún. Las acciones verificadas generarán asientos inmutables en este libro tras su ventana de observación.',
                  'This business has no impact observations recorded yet. Verified actions will generate immutable records in this ledger following their observation window.'
                )}
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-400 italic">
            {t(
              '* BVELT registra correlaciones y observaciones temporales verificadas empíricamente en el ledger, sin establecer causalidades deterministas no respaldadas por auditoría continua.',
              '* BVELT records empirically verified temporal observations in the ledger without claiming deterministic causalities unsupported by continuous audit.'
            )}
          </p>
        </section>

        {/* Append-Only History Section */}
        <section id="append-only-history-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-emerald-400" />
                {t('Registro Histórico Criptográfico (Append-Only History)', 'Cryptographic History Ledger (Append-Only)')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t(
                  'Historial inmutable de eventos de evidencia encadenados criptográficamente mediante SHA-256.',
                  'Immutable log of evidence events cryptographically chained using SHA-256.'
                )}
              </p>
            </div>

            {/* Chain Integrity Pill */}
            {chainIntegrity && (
              <div 
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${
                  chainIntegrity.isValid
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                }`}
              >
                {chainIntegrity.isValid ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t('CADENA SHA-256 ÍNTEGRA', 'SHA-256 CHAIN INTACT')} ({chainIntegrity.totalEvents} {t('eventos', 'events')})</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('DISCREPANCIA EN CADENA', 'CHAIN DISCREPANCY')} #{chainIntegrity.brokenAtIndex}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {recentHistory.length > 0 ? (
            <div className="space-y-3">
              {recentHistory.map((ev, idx) => {
                const currentHashVal = (ev as any).currentHash || (ev as any).eventHash || '';
                const prevHashVal = (ev as any).previousHash || '';
                return (
                  <div 
                    key={ev.eventId || idx}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {ev.eventId}
                        </span>
                        <span className="text-xs font-medium text-slate-300">
                          {FIELD_LABELS[ev.fieldKey]?.[lang] || ev.fieldKey}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(ev.observedAt).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {ev.observationType || 'FACT'}
                        </span>
                        <EvidenceBadge status={ev.evidenceStatus} t={t} size="xs" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs py-1">
                      <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px] uppercase font-mono">{t('Valor Anterior', 'Previous Value')}:</span>
                        <span className="text-slate-400 font-medium break-all">
                          {ev.oldValue !== undefined && ev.oldValue !== null ? String(ev.oldValue) : t('(Registro inicial / None)', '(Initial record / None)')}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 p-2 rounded border border-slate-800/80">
                        <span className="text-emerald-400/80 block text-[10px] uppercase font-mono">{t('Valor Nuevo Observado', 'New Observed Value')}:</span>
                        <span className="text-slate-100 font-semibold break-all">
                          {String(ev.newValue)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono">
                      <div className="text-slate-400 truncate max-w-sm" title={ev.sourceLabel}>
                        <span className="text-slate-400 font-sans">{t('Fuente:', 'Source:')} </span>
                        <span className="text-slate-300 font-sans">{ev.sourceLabel || ev.sourceType}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {prevHashVal && (
                          <span className="text-slate-400 text-[10px]" title={`Prev Hash: ${prevHashVal}`}>
                            prev: {prevHashVal.slice(0, 8)}...
                          </span>
                        )}
                        {currentHashVal && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400/90">
                            <span>hash: {currentHashVal.slice(0, 10)}...</span>
                            <button
                              onClick={() => handleCopyHash(currentHashVal)}
                              className="p-0.5 hover:text-emerald-200 text-slate-400 transition"
                              title={t('Copiar SHA-256 completo', 'Copy full SHA-256')}
                            >
                              {copiedHash === currentHashVal ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 text-center space-y-2">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-1" />
              <p className="text-sm font-semibold text-slate-300">
                {t('Registro consolidado inicial', 'Initial consolidated record')}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {t(
                  'Este negocio cuenta con un registro canónico inicial consolidado. Las modificaciones y auditorías periódicas quedarán encadenadas de forma append-only.',
                  'This business has an initial consolidated record. Future modifications and periodic audits will be chained append-only.'
                )}
              </p>
            </div>
          )}
        </section>

        {/* Machine API Access & Public Verification Box */}
        <section id="machine-api-access-box" className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                {t('Endpoints Públicos de Verificación e Integración', 'Public Verification & Integration Endpoints')}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">BVELT RECORD V1</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t(
              'Este registro público cuenta con URLs canónicas de verificación web y endpoints REST con formato JSON para auditorías externas y sistemas de interoperabilidad.',
              'This verified record provides canonical web verification URLs and machine-readable REST JSON endpoints for external audits and interoperability.'
            )}
          </p>
          <div className="space-y-2">
            <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 flex items-center justify-between border border-slate-800 overflow-x-auto">
              <div>
                <span className="text-slate-400 mr-2 uppercase text-[10px]">{t('PÁGINA PÚBLICA:', 'PUBLIC PAGE:')}</span>
                <code className="text-emerald-400">{window.location.origin}/verify/{record.entityId}</code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/verify/${record.entityId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-3 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition shrink-0"
                title={t('Copiar Enlace', 'Copy Link')}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-slate-300 flex items-center justify-between border border-slate-800 overflow-x-auto">
              <div>
                <span className="text-slate-400 mr-2 uppercase text-[10px]">{t('API REST:', 'REST API:')}</span>
                <code className="text-emerald-400">GET /api/verify/{record.entityId}</code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/verify/${record.entityId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-3 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition shrink-0"
                title={t('Copiar Endpoint', 'Copy Endpoint')}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  try {
                    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bvelt_verified_evidence_${record.entityId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Download JSON error:', e);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('Descargar Registro de Evidencia (JSON)', 'Export Verified Evidence (JSON)')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Verification Conversion Footer */}
        <section id="verified-footer-cta" className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <h3 className="text-lg sm:text-xl font-bold text-slate-100">
            {t('¿Es este su negocio o desea verificar el suyo?', 'Is this your business or want to verify yours?')}
          </h3>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            {t(
              'Ejecute un diagnóstico gratuito para detectar oportunidades de mercado, verificar datos de contacto y proteger su reputación local.',
              'Run a free market check to discover local opportunities, verify business data, and protect your local market reputation.'
            )}
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            {onNavigateAudit && (
              <button
                id="btn-footer-free-audit"
                onClick={onNavigateAudit}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition shadow-lg shadow-emerald-500/20"
              >
                {t('Realizar Diagnóstico Gratuito de Mercado', 'Run Free Market Check')}
              </button>
            )}
            {onNavigateHome && (
              <button
                id="btn-footer-bvelt-home"
                onClick={onNavigateHome}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition"
              >
                {t('Conocer Más Sobre BVELT', 'Learn More About BVELT')}
              </button>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};
