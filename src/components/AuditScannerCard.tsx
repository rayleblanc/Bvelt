import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, TrendingUp, AlertCircle, Star, ArrowRight, Award, Users, Check, Zap
} from 'lucide-react';
import { ClientOpportunityCard } from './ClientOpportunityCard';
import { useScansQuota, parseRateLimitHeaders, updateQuotaFromServer, getRateLimitMessage } from '../lib/rateLimitService';
import { persistBusinessScanToBem, persistCompetitorPoiToBem } from '../knowledge';

export interface AuditResult {
  cached: boolean;
  lastUpdated: string;
  client: {
    name: string;
    rating: number | null;
    reviews: number | null;
    web: boolean;
    claimed: boolean;
  };
  competitor: {
    name: string | null;
    rating: number | null;
    reviews: number | null;
    years: string | null;
    web: boolean;
    coords?: { lat: number; lng: number } | null;
  };
  mapOverlay: {
    competitorName: string | null;
    competitorCoords?: { lat: number; lng: number } | null;
    niche: string;
    location: string;
  };
}

// Strongly-typed interfaces for user profile and growth statistics (Anti-Any)
export interface ProfileData {
  name?: string;
  category?: string;
  location?: string;
  website?: string;
  isClaimed?: boolean;
  googleMapsUrl?: string;
  reviewsReplied?: number;
  trustBadges?: {
    licensed?: boolean;
    insured?: boolean;
    guarantee?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface GrowthStatsData {
  posts?: number;
  reviews?: number;
  quotes?: number;
}

export interface AuditScannerCardProps {
  profile: ProfileData | null | undefined;
  t: (es: string, en: string) => string;
  setActiveTab: (tab: string) => void;
  growthStats?: GrowthStatsData | null | undefined;
  onGeneratePitch?: (business: any) => void;
  onUpdateLeadStatus?: (leadId: string, newStatus: string, lastContactDate?: string) => void;
  onCompetitorExtracted?: (competitorData: {
    name: string | null;
    rating: number | null;
    reviews: number | null;
    years: string | null;
    web: boolean;
    coords?: { lat: number; lng: number } | null;
  }) => void;
  onOpenCalculationModal?: (details: any) => void;
}

export interface DynamicInsight {
  id: string;
  type: 'gap' | 'strength' | 'opportunity';
  title: string;
  description: string;
  actionTab: string;
  actionText: string;
}

export function generateDynamicInsights(
  client: AuditResult['client'],
  competitor: AuditResult['competitor'],
  profile: ProfileData | null | undefined,
  growthStats: GrowthStatsData | null | undefined,
  t: (es: string, en: string) => string
): DynamicInsight[] {
  const insights: DynamicInsight[] = [];
  const compName = competitor.name || null;
  const clientReviews = typeof client.reviews === 'number' ? client.reviews : 0;
  const compReviews = (competitor.reviews !== null && typeof competitor.reviews === 'number') ? competitor.reviews : null;
  const clientRating = typeof client.rating === 'number' ? client.rating : 0;
  const compRating = (competitor.rating !== null && typeof competitor.rating === 'number') ? competitor.rating : null;

  if (compName && compReviews !== null) {
    if (compReviews > clientReviews) {
      const diff = compReviews - clientReviews;
      insights.push({
        id: 'review_gap',
        type: 'gap',
        title: t(`Brecha de Reseñas (-${diff})`, `Review Gap (-${diff})`),
        description: t(
          `Genera códigos QR y campañas automáticas para capturar ${diff} opiniones nuevas porque ${compName} posee ${compReviews} reseñas frente a tus ${clientReviews}, dominando las conversiones en Google Maps.`,
          `Generate QR codes and automated campaigns to capture ${diff} new reviews because ${compName} has ${compReviews} reviews vs your ${clientReviews}, dominating Google Maps conversions.`
        ),
        actionTab: 'reviews',
        actionText: t('Capturar Reseñas', 'Capture Reviews')
      });
    } else if (clientReviews >= compReviews && clientReviews > 0) {
      insights.push({
        id: 'review_strength',
        type: 'strength',
        title: t('Liderazgo en Volumen de Opiniones', 'Review Volume Leadership'),
        description: t(
          `Mantén la frecuencia de reseñas positivas con enlaces directos para consolidar tu ventaja porque superas a ${compName} (${clientReviews} vs ${compReviews} reseñas) en la zona.`,
          `Maintain the flow of positive reviews with direct links to solidify your edge because you lead over ${compName} (${clientReviews} vs ${compReviews} reviews) locally.`
        ),
        actionTab: 'reviews',
        actionText: t('Solicitar Reseñas', 'Request Reviews')
      });
    }
  }

  if (compName && compRating !== null && compRating > 0 && clientRating > 0 && compRating > clientRating) {
    insights.push({
      id: 'rating_gap',
      type: 'gap',
      title: t('Desventaja en Calificación', 'Rating Disadvantage'),
      description: t(
        `Responde con IA a opiniones y solicita reseñas a clientes satisfechos para subir de ★${clientRating} a ★${compRating}+ porque ${compName} ostenta ★${compRating}, generando mayor confianza inicial.`,
        `Respond with AI and ask satisfied customers for reviews to lift your rating from ★${clientRating} to ★${compRating}+ because ${compName} holds ★${compRating}, building higher initial trust.`
      ),
      actionTab: 'reviews',
      actionText: t('Gestionar Calificación', 'Manage Rating')
    });
  } else if (clientRating >= 4.7) {
    insights.push({
      id: 'rating_strength',
      type: 'strength',
      title: t(`Reputación de Alta Calidad (★${clientRating})`, `High Quality Reputation (★${clientRating})`),
      description: t(
        `Muestra tus insignias de satisfacción en tu perfil y ofertas para convertir visitas en ventas porque tu calificación de ★${clientRating} proyecta máxima garantía profesional.`,
        `Display your satisfaction badges on your profile and quotes to convert views into sales because your ★${clientRating} rating projects maximum professional assurance.`
      ),
      actionTab: 'profile',
      actionText: t('Ver Insignias', 'View Badges')
    });
  }

  if (!client.claimed && !profile?.isClaimed) {
    insights.push({
      id: 'unclaimed_opp',
      type: 'opportunity',
      title: t('Ficha No Verificada en Google', 'Unverified Google Profile'),
      description: t(
        `Verifica la propiedad de tu perfil oficial para evitar duplicados y editar tus datos porque las fichas no verificadas pierden posicionamiento orgánico en búsquedas locales.`,
        `Verify ownership of your profile to prevent duplicates and edit your data because unverified profiles lose organic ranking in local searches.`
      ),
      actionTab: 'profile',
      actionText: t('Verificar Ficha', 'Verify Profile')
    });
  } else if (!client.web && !profile?.website) {
    insights.push({
      id: 'web_gap',
      type: 'gap',
      title: t('Falta Sitio Web Vinculado', 'Missing Linked Website'),
      description: t(
        `Conecta tu sitio web o tarjeta digital a la ficha para aumentar conversiones porque los clientes comparan servicios antes de llamar y ${competitor.web ? `${compName} ya lo tiene activo` : 'es clave para capturar cotizaciones'}.`,
        `Link your website or digital card to boost conversions because customers compare services before calling and ${competitor.web ? `${compName} already has it active` : 'it is key to capturing leads'}.`
      ),
      actionTab: 'profile',
      actionText: t('Vincular Sitio Web', 'Link Website')
    });
  }

  const hasTrustBadges = profile?.trustBadges && Object.values(profile.trustBadges).some(Boolean);
  if (!hasTrustBadges && insights.length < 3) {
    insights.push({
      id: 'trust_badges_opp',
      type: 'opportunity',
      title: t('Oportunidad: Sellos de Confianza', 'Opportunity: Trust Badges'),
      description: t(
        `Activa distintivos de verificación (Licenciado, Asegurado, Garantía) para diferenciarte porque la prueba social visual aumenta la tasa de cierre en prospección.`,
        `Activate verification badges (Licensed, Insured, Guarantee) to stand out because visual social proof increases conversion rates.`
      ),
      actionTab: 'profile',
      actionText: t('Activar Sellos', 'Activate Badges')
    });
  }

  const aiRepliesUsed = (growthStats?.posts || 0) > 0 || (profile?.reviewsReplied || 0) > 0;
  if (!aiRepliesUsed && insights.length < 3) {
    insights.push({
      id: 'ai_replies_opp',
      type: 'opportunity',
      title: t('Oportunidad: Automatización con IA', 'Opportunity: AI Automation'),
      description: t(
        `Responde a reseñas en segundos con respuestas optimizadas en SEO para ganar relevancia en Google porque la interacción activa eleva el ranking local.`,
        `Respond to reviews in seconds with SEO-optimized replies to gain Google relevance because active interaction boosts local ranking.`
      ),
      actionTab: 'reviews',
      actionText: t('Activar IA', 'Activate AI')
    });
  }

  return insights.slice(0, 3);
}

export function calculateAuditScore(
  client: AuditResult['client'], 
  competitor: AuditResult['competitor'], 
  profile: ProfileData | null | undefined, 
  growthStats: GrowthStatsData | null | undefined
): number {
  let score = 0;

  const clientReviews = typeof client?.reviews === 'number' && !isNaN(client.reviews) ? client.reviews : 0;
  const competitorReviews = typeof competitor?.reviews === 'number' && !isNaN(competitor.reviews) && competitor.reviews > 0 
    ? competitor.reviews 
    : null;

  // Zero-Division Protection: Check strictly that competitorReviews is higher than 0 before calculating ratio
  if (competitorReviews !== null && competitorReviews > 0) {
    const reviewRatio = clientReviews / competitorReviews;
    score += Math.min(25, Math.round(reviewRatio * 25));
  } else {
    // Safe fallback value logic for zero or null competitor review counts
    if (clientReviews >= 50) score += 25;
    else if (clientReviews >= 20) score += 20;
    else if (clientReviews >= 5) score += 15;
    else if (clientReviews > 0) score += 10;
  }

  const rating = typeof client?.rating === 'number' && !isNaN(client.rating) ? client.rating : 0;
  if (rating >= 4.8) {
    score += 15;
  } else if (rating >= 4.5) {
    score += 10;
  } else if (rating > 0) {
    score += 5;
  }

  if (client?.web || profile?.website || profile?.googleMapsUrl) score += 10;
  if (client?.claimed || profile?.isClaimed) score += 10;

  const activeBadges = profile?.trustBadges && Object.values(profile.trustBadges).some(Boolean);
  if (activeBadges) score += 10;

  const reviewsUsed = (growthStats?.reviews || 0) > 0 || (profile?.reviewsReplied || 0) > 0;
  if (reviewsUsed) score += 10;

  const aiRepliesUsed = (growthStats?.posts || 0) > 0 || (growthStats?.quotes || 0) > 0;
  if (aiRepliesUsed) score += 10;

  return Math.min(100, Math.max(0, score));
}

// Modular Subcomponent: AuditHeader
interface AuditHeaderProps {
  loading: boolean;
  isCooldown?: boolean;
  scansLeft?: number;
  cached: boolean | undefined;
  onRefresh: () => void;
  t: (es: string, en: string) => string;
}

export function AuditHeader({ loading, isCooldown, scansLeft, cached, onRefresh, t }: AuditHeaderProps) {
  const isButtonDisabled = loading || isCooldown || (typeof scansLeft === 'number' && scansLeft <= 0);

  return (
    <div id="audit-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Zap size={24} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">
              {t('Motor de Auditoría en Tiempo Real', 'Real-time Audit Engine')}
            </h2>
            {cached && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                {t('Caché 24h', '24h Cache')}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('Comparativa directa frente a la competencia en tu zona', 'Direct comparative analysis against local competition')}
          </p>
        </div>
      </div>

      <button
        id="audit-header-refresh-btn"
        onClick={onRefresh}
        disabled={isButtonDisabled}
        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95"
      >
        <RefreshCw size={14} className={loading || isCooldown ? 'animate-spin' : ''} />
        {loading
          ? t('Escaneando...', 'Scanning...')
          : isCooldown
            ? t('Enfriando...', 'Cooling down...')
            : typeof scansLeft === 'number'
              ? t(`Re-escanear (${scansLeft} hoy)`, `Re-scan (${scansLeft} left today)`)
              : t('Re-escanear Ahora', 'Re-scan Now')}
      </button>
    </div>
  );
}

// Modular Subcomponent: AuditScoreBoard
interface AuditScoreBoardProps {
  score: number | null;
  scoreDiff: number | null;
  reviews: number | null;
  rating: number | null;
  t: (es: string, en: string) => string;
}

export function AuditScoreBoard({ score, scoreDiff, reviews, rating, t }: AuditScoreBoardProps) {
  return (
    <div id="audit-score-board" className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div id="audit-score-card" className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {t('Puntaje de Auditoría', 'Audit Score')}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {score !== null ? score : t('En espera de análisis', 'Pending analysis')}
            </span>
            {score !== null && <span className="text-xs font-semibold text-slate-500">/ 100</span>}
          </div>
          {score !== null ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {reviews !== null && reviews > 0
                ? t('Indexado en base a visibilidad y perfil local', 'Indexed based on visibility and local profile')
                : t('Oportunidad alta: perfil con 0 reseñas detectadas', 'High opportunity: 0 reviews detected on profile')}
            </p>
          ) : (
            <p className="text-[10px] text-amber-500 mt-1 font-semibold">
              {t('Escanea tu ficha para generar el puntaje', 'Scan your profile to generate score')}
            </p>
          )}
        </div>
        {scoreDiff !== null && scoreDiff !== 0 && (
          <div id="audit-score-diff-badge" className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 ${
            scoreDiff > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            <TrendingUp size={12} className={scoreDiff < 0 ? 'rotate-180' : ''} />
            <span>{scoreDiff > 0 ? `+${scoreDiff}%` : `${scoreDiff}%`}</span>
          </div>
        )}
      </div>

      <div id="audit-reviews-card" className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {t('Reseñas del Cliente', 'Client Reviews')}
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {reviews !== null ? reviews : t('N/A', 'N/A')}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
          <Star size={18} />
        </div>
      </div>

      <div id="audit-rating-card" className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {t('Calificación', 'Rating')}
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {rating !== null ? `★ ${rating}` : t('N/A', 'N/A')}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Award size={18} />
        </div>
      </div>
    </div>
  );
}

// Modular Subcomponent: AuditMetricsTable
interface AuditMetricsTableProps {
  auditData: AuditResult;
  profile: ProfileData | null | undefined;
  clientName: string;
  competitorName: string;
  t: (es: string, en: string) => string;
}

export function AuditMetricsTable({ auditData, profile, clientName, competitorName, t }: AuditMetricsTableProps) {
  const hasCompetitor = Boolean(auditData.competitor?.name?.trim());

  return (
    <div id="audit-metrics-table-container" className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
          {t('Tabla Comparativa Directa', 'Direct Comparative Table')}
        </h3>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {auditData.mapOverlay.location}
        </span>
      </div>

      {!hasCompetitor ? (
        <div className="p-6 text-center space-y-2 bg-slate-100/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-center gap-2 text-amber-500">
            <AlertCircle size={18} />
            <span className="font-bold text-xs uppercase tracking-wider">
              {t("Sin Competidores Verificados en Radio", "No Verified Competitors in Radius")}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {t(
              "No se detectaron competidores verificados en este radio exacto. Expande el radio a 10 km o conecta GBP para sincronizar el mercado local.",
              "No verified competitors detected in this exact radius. Expand radius to 10 km or connect GBP to sync local market."
            )}
          </p>
          <span className="inline-block px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 rounded-md">
            {t("ESTADO: SIN DATOS SUFICIENTES", "STATUS: INSUFFICIENT DATA")}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/30">
                <th className="p-3.5">{t('Métrica', 'Metric')}</th>
                <th className="p-3.5 text-indigo-600 dark:text-indigo-400 font-bold">{clientName} ({t('Tú', 'You')})</th>
                <th className="p-3.5 text-rose-600 dark:text-rose-400 font-bold">{competitorName} ({t('Líder Local', 'Local Leader')})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              <tr>
                <td className="p-3.5 font-medium text-slate-400">{t('Reseñas', 'Reviews')}</td>
                <td className="p-3.5 font-bold text-white">
                  {auditData.client.reviews !== null ? auditData.client.reviews : t('N/A (Perfil no verificado)', 'N/A (Unverified Profile)')}
                </td>
                <td className="p-3.5 font-bold text-slate-300">
                  {auditData.competitor.reviews !== null ? auditData.competitor.reviews : t('N/A (Perfil no verificado)', 'N/A (Unverified Profile)')}
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-medium text-slate-400">{t('Calificación Google', 'Google Rating')}</td>
                <td className="p-3.5 font-bold text-emerald-400">
                  {auditData.client.rating !== null ? `★ ${auditData.client.rating}` : t('N/A', 'N/A')}
                </td>
                <td className="p-3.5 font-bold text-amber-400">
                  {auditData.competitor.rating !== null ? `★ ${auditData.competitor.rating}` : t('N/A', 'N/A')}
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-medium text-slate-400">{t('Sitio Web Vinculado', 'Web Linked')}</td>
                <td className="p-3.5">
                  {auditData.client.web || profile?.website ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> {t('Sí', 'Yes')}
                    </span>
                  ) : (
                    <span className="text-slate-500">{t('No detectado', 'Not detected')}</span>
                  )}
                </td>
                <td className="p-3.5">
                  {auditData.competitor.web ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> {t('Sí', 'Yes')}
                    </span>
                  ) : (
                    <span className="text-slate-500">{t('No detectado', 'Not detected')}</span>
                  )}
                </td>
              </tr>

              <tr>
                <td className="p-3.5 font-medium text-slate-400">{t('Perfil Reclamado', 'Profile Claimed')}</td>
                <td className="p-3.5">
                  {auditData.client.claimed || profile?.isClaimed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> {t('Verificado', 'Verified')}
                    </span>
                  ) : (
                    <span className="text-slate-500">{t('No verificado', 'Unverified')}</span>
                  )}
                </td>
                <td className="p-3.5">
                  <span className="text-slate-400">
                    {auditData.competitor.years ? `${auditData.competitor.years}` : t('Verificado', 'Verified')}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Modular Subcomponent: AuditInsightsGrid
interface AuditInsightsGridProps {
  insights: DynamicInsight[];
  setActiveTab: (tab: string) => void;
  t: (es: string, en: string) => string;
}

export function AuditInsightsGrid({ insights, setActiveTab, t }: AuditInsightsGridProps) {
  if (insights.length === 0) return null;

  return (
    <div id="audit-insights-grid-container" className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          {t('Diagnóstico Estratégico y Recomendaciones', 'Strategic Diagnosis & Recommendations')}
        </h3>
        <span className="text-[10px] text-slate-400 font-medium">
          {t('Análisis en Tiempo Real', 'Real-Time Analysis')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((insight) => {
          const isGap = insight.type === 'gap';
          const isStrength = insight.type === 'strength';

          const borderColor = isGap 
            ? 'border-rose-500/30 hover:border-rose-500/60' 
            : isStrength 
              ? 'border-emerald-500/30 hover:border-emerald-500/60' 
              : 'border-sky-500/30 hover:border-sky-500/60';

          const badgeBg = isGap
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            : isStrength
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

          const iconColor = isGap ? 'text-rose-600 dark:text-rose-400' : isStrength ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400';

          const badgeLabel = isGap 
            ? t('Punto Débil', 'Weakness')
            : isStrength 
              ? t('Punto Fuerte', 'Strength')
              : t('Oportunidad', 'Opportunity');

          return (
            <div
              id={`audit-insight-${insight.id}`}
              key={insight.id}
              onClick={() => setActiveTab(insight.actionTab)}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-950 border ${borderColor} transition cursor-pointer group flex flex-col justify-between space-y-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 shadow-sm`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
                    {badgeLabel}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                  {insight.title}
                </h4>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {insight.description}
                </p>
              </div>

              <div className={`pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-1 text-xs font-bold ${iconColor}`}>
                <span>{insight.actionText}</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const AuditScannerCard: React.FC<AuditScannerCardProps> = React.memo(({
  profile,
  t,
  setActiveTab,
  growthStats,
  onGeneratePitch,
  onUpdateLeadStatus,
  onCompetitorExtracted,
  onOpenCalculationModal
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [scoreDiff, setScoreDiff] = useState<number | null>(null);
  const quota = useScansQuota(profile);

  const runAudit = useCallback(async (forceRefresh = false) => {
    const companyName = profile?.name && profile.name !== 'Local Business' ? profile.name : 'Mi Negocio';
    const niche = profile?.category || 'Servicios Locales';
    const cityState = profile?.location || '';

    if (!cityState.trim()) {
      setError(t('Por favor ingresa tu ubicación en tu perfil para ejecutar la auditoría de mercado local.', 'Please set your location in your business profile to run local competitive audit.'));
      setLoading(false);
      return;
    }

    if (forceRefresh && quota.scansLeft <= 0) {
      setError(
        quota.isPro
          ? t("Has alcanzado tu límite diario de escaneos Pro.", "You've reached your daily limit of Pro scans.")
          : t("Has alcanzado tu límite de escaneos de hoy. Pásate a Pro para más análisis.", "You've reached today's scan limit. Upgrade to Pro for more scans.")
      );
      return;
    }

    if (forceRefresh) {
      quota.triggerCooldown(4000);
    }

    const bizKey = profile?.id || profile?.name?.toLowerCase().trim().replace(/\s+/g, '_') || 'default_biz';
    const cacheKey = `bvelt_audit_${bizKey}_${niche.toLowerCase().trim()}_${cityState.toLowerCase().trim()}`;
    const cachedItemStr = localStorage.getItem(cacheKey);
    const now = Date.now();
    const CACHE_TTL_CLIENT = 30 * 60 * 1000; // 30 minutes

    if (!forceRefresh && cachedItemStr) {
      try {
        const parsed = JSON.parse(cachedItemStr);
        if (parsed && parsed.timestamp && (now - parsed.timestamp < CACHE_TTL_CLIENT) && parsed.data) {
          setAuditData(parsed.data);
          const computedScore = calculateAuditScore(parsed.data.client, parsed.data.competitor, profile, growthStats);
          setScore(computedScore);
          if (parsed.data.competitor?.name && onCompetitorExtracted) {
            onCompetitorExtracted(parsed.data.competitor);
          }
          return;
        }
      } catch (e) {
        // ignore parse error
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyName,
          niche,
          cityState,
          forceRefresh
        })
      });

      if (response.status === 429) {
        parseRateLimitHeaders(response);
        updateQuotaFromServer(0);
        setError(getRateLimitMessage());
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Error en el servidor de auditoría (${response.status})`);
      }

      parseRateLimitHeaders(response);

      let rawData: AuditResult;
      try {
        rawData = await response.json();
      } catch (_) {
        throw new Error('Respuesta inválida del servidor de auditoría.');
      }

      const sanitizedClient = {
        name: rawData?.client?.name || companyName,
        rating: typeof rawData?.client?.rating === 'number' && !isNaN(rawData.client.rating) ? rawData.client.rating : null,
        reviews: typeof rawData?.client?.reviews === 'number' && !isNaN(rawData.client.reviews) ? rawData.client.reviews : null,
        web: Boolean(rawData?.client?.web),
        claimed: Boolean(rawData?.client?.claimed)
      };

      const rawComp = rawData?.competitor;
      const compCoords = rawComp?.coords && typeof rawComp.coords.lat === 'number' && typeof rawComp.coords.lng === 'number'
        ? { lat: rawComp.coords.lat, lng: rawComp.coords.lng }
        : (rawData?.mapOverlay?.competitorCoords && typeof rawData.mapOverlay.competitorCoords.lat === 'number' && typeof rawData.mapOverlay.competitorCoords.lng === 'number'
          ? { lat: rawData.mapOverlay.competitorCoords.lat, lng: rawData.mapOverlay.competitorCoords.lng }
          : null);

      const sanitizedCompetitor = {
        name: typeof rawComp?.name === 'string' && rawComp.name.trim().length > 0 ? rawComp.name.trim() : null,
        rating: typeof rawComp?.rating === 'number' && !isNaN(rawComp.rating) ? rawComp.rating : null,
        reviews: typeof rawComp?.reviews === 'number' && !isNaN(rawComp.reviews) ? rawComp.reviews : null,
        years: typeof rawComp?.years === 'string' && rawComp.years.trim().length > 0 ? rawComp.years.trim() : null,
        web: Boolean(rawComp?.web),
        coords: compCoords
      };

      const normalizedData: AuditResult = {
        cached: Boolean(rawData?.cached),
        lastUpdated: rawData?.lastUpdated || new Date().toISOString(),
        client: sanitizedClient,
        competitor: sanitizedCompetitor,
        mapOverlay: {
          competitorName: sanitizedCompetitor.name,
          competitorCoords: compCoords,
          niche: rawData?.mapOverlay?.niche || niche,
          location: rawData?.mapOverlay?.location || cityState
        }
      };

      setAuditData(normalizedData);

      // Decrement scan quota on fresh audit
      if (forceRefresh) {
        quota.consumeScan();
      }

      // Save to client localStorage cache (30 min TTL)
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: normalizedData
        }));
      } catch (e) {
        // ignore
      }

      const computedScore = calculateAuditScore(normalizedData.client, normalizedData.competitor, profile, growthStats);
      
      const prevScoreKey = `bvelt_prev_score_${bizKey}`;
      const prevScoreStr = localStorage.getItem(prevScoreKey);
      let prevNum: number | null = null;
      if (prevScoreStr) {
        const parsedInt = parseInt(prevScoreStr, 10);
        // localStorage parse validation with isNaN check and fallback
        if (!isNaN(parsedInt)) {
          prevNum = parsedInt;
        }
      }
      
      if (prevNum !== null) {
        setScoreDiff(computedScore - prevNum);
      } else {
        setScoreDiff(0); // Safe default fallback
      }

      localStorage.setItem(prevScoreKey, computedScore.toString());
      setScore(computedScore);

      // BEM Shadow Persistence (Phase F3)
      try {
        const auditPayload = {
          businessName: sanitizedClient.name || companyName,
          city: cityState,
          rating: sanitizedClient.rating,
          reviewCount: sanitizedClient.reviews,
          website: sanitizedClient.web ? (profile?.website || 'https://domain.com') : null,
          isClaimed: sanitizedClient.claimed,
          coordinates: profile?.coords || null,
          competitorsSummary: sanitizedCompetitor.name ? {
            topCompetitor: sanitizedCompetitor.name,
            rating: sanitizedCompetitor.rating,
            reviews: sanitizedCompetitor.reviews,
            niche
          } : null
        };

        const fallbackEntityId = `ent_${(auditPayload.businessName || 'biz').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${(auditPayload.city || 'local').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const path = `entities/${fallbackEntityId}/evidence`;

        persistBusinessScanToBem(auditPayload)
          .then(success => {
            console.log('[BEM Write-Back]', {
              bemPersist: success ? 'SUCCESS' : 'SKIPPED',
              entityId: fallbackEntityId,
              reason: success ? 'AUDIT_RESOLVED_SUCCESS' : 'AUDIT_FALLBACK_SLUG',
              path
            });
          })
          .catch(err => {
            console.warn('[BEM Write-Back]', {
              bemPersist: 'FAILED',
              entityId: fallbackEntityId,
              reason: err?.message || 'Audit BEM persist error',
              path
            });
          });

        if (sanitizedCompetitor.name) {
          persistCompetitorPoiToBem({
            name: sanitizedCompetitor.name,
            lat: compCoords?.lat,
            lng: compCoords?.lng,
            category: niche,
            rating: sanitizedCompetitor.rating,
            reviewCount: sanitizedCompetitor.reviews,
            address: cityState,
            website: sanitizedCompetitor.web ? 'https://competitor.com' : null
          }).catch(err => {
            console.warn('[BEM Write-Back]', {
              bemPersist: 'FAILED',
              entityId: `ent_${(sanitizedCompetitor.name || 'comp').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              reason: err?.message || 'Competitor persist error',
              path: `entities/competitors/${sanitizedCompetitor.name}`
            });
          });
        }
      } catch (bemErr: any) {
        console.warn('[BEM Write-Back]', {
          bemPersist: 'FAILED',
          entityId: (companyName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_'),
          reason: bemErr?.message || 'Non-blocking write warning',
          path: 'entities/unknown/evidence'
        });
      }

      if (sanitizedCompetitor.name && onCompetitorExtracted) {
        onCompetitorExtracted(sanitizedCompetitor);
      }
    } catch (err: any) {
      console.error('[AuditScannerCard Error]:', err);
      const is429 = err?.isRateLimited || err?.name === 'RateLimitError' || err?.message?.includes('429');
      if (is429) {
        setError(getRateLimitMessage());
      } else {
        setError(err?.message || 'Error al realizar el escaneo.');
      }
    } finally {
      setLoading(false);
    }
  }, [profile, growthStats, onCompetitorExtracted, quota]);

  useEffect(() => {
    runAudit(false);
  }, []);

  const clientName = profile?.name || auditData?.client?.name || 'Tu Negocio';
  const competitorName = auditData?.competitor?.name || t('Competidor no verificado', 'Unverified Competitor');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-5 md:p-7 shadow-sm dark:shadow-2xl space-y-6">
      <AuditHeader 
        loading={loading} 
        isCooldown={quota.isCooldown}
        scansLeft={quota.scansLeft}
        cached={auditData?.cached} 
        onRefresh={() => runAudit(true)} 
        t={t} 
      />

      {loading && (
        <div className="py-12 text-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-indigo-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">
            {t('Analizando ranking y competidores con IA y Extracción Distribuida...', 'Analyzing ranking and competitors with AI & Distributed Extraction...')}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => runAudit(true)} className="underline font-bold text-white hover:text-rose-200">
            {t('Reintentar', 'Retry')}
          </button>
        </div>
      )}

      {!loading && auditData && (
        <>
          <AuditScoreBoard 
            score={score} 
            scoreDiff={scoreDiff} 
            reviews={auditData.client.reviews} 
            rating={auditData.client.rating} 
            t={t} 
          />

          <AuditMetricsTable 
            auditData={auditData} 
            profile={profile} 
            clientName={clientName} 
            competitorName={competitorName} 
            t={t} 
          />

          <AuditInsightsGrid 
            insights={generateDynamicInsights(
              auditData.client,
              auditData.competitor,
              profile,
              growthStats,
              t
            )} 
            setActiveTab={setActiveTab} 
            t={t} 
          />

          {/* Client Acquisition Opportunity Engine Card */}
          {onGeneratePitch && (auditData.competitor?.name || auditData.client?.name) && (
            <div className="pt-2">
              <ClientOpportunityCard
                business={{
                  id: `audit_comp_${Date.now()}`,
                  name: auditData.competitor?.name || auditData.client?.name || 'Negocio Local',
                  category: profile?.category || 'Servicios locales',
                  location: profile?.location || '',
                  rating: auditData.competitor?.rating ?? auditData.client?.rating ?? 'N/D',
                  reviews: auditData.competitor?.reviews ?? auditData.client?.reviews ?? 'N/D',
                  website: auditData.competitor?.web ? 'Registrado' : 'N/D',
                  phone: '',
                  dataStatus: 'Verified',
                  source: 'Audit Scanner Engine'
                }}
                onGeneratePitch={(biz) => onGeneratePitch(biz)}
                onUpdateLeadStatus={onUpdateLeadStatus}
                onOpenCalculationModal={onOpenCalculationModal}
                t={t}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default AuditScannerCard;
