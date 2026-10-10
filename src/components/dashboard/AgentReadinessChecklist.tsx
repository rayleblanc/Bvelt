import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, PhoneCall, ArrowRight, ShieldCheck, 
  Clock, Tag, DollarSign, Calendar, MessageSquare, MapPin, 
  Code2, ExternalLink, RefreshCw, AlertCircle, Sparkles, Check
} from 'lucide-react';
import { 
  AgentReadinessService, 
  AgentReadinessReport, 
  AgentReadinessItem 
} from '../../services/agentReadinessService';
import { navigateTo } from '../../lib/navigateTo';

export interface AgentReadinessChecklistProps {
  profile?: any;
  gmbConnected?: boolean;
  gmbReviews?: any[];
  onNavigateTab?: (tab: string, subRow?: number) => void;
  onOpenGmbModal?: () => void;
  language?: 'es' | 'en';
  t?: (es: string, en: string) => string;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  isCompact?: boolean;
}

export const AgentReadinessChecklist: React.FC<AgentReadinessChecklistProps> = ({
  profile = {},
  gmbConnected = false,
  gmbReviews = [],
  onNavigateTab,
  onOpenGmbModal,
  language = 'es',
  t = (es: string, en: string) => (language === 'en' ? en : es),
  showToast,
  isCompact = false
}) => {
  const [toggleTick, setToggleTick] = useState(0);

  const report: AgentReadinessReport = AgentReadinessService.evaluateReadiness(
    profile,
    gmbConnected,
    gmbReviews
  );

  const getItemIcon = (id: AgentReadinessItem['id']) => {
    switch (id) {
      case 'horario':
        return <Clock size={16} className="text-amber-500" />;
      case 'categorias':
        return <Tag size={16} className="text-blue-500" />;
      case 'servicios_precios':
        return <DollarSign size={16} className="text-emerald-500" />;
      case 'cta_reserva':
        return <Calendar size={16} className="text-indigo-500" />;
      case 'resenas_respondidas':
        return <MessageSquare size={16} className="text-purple-500" />;
      case 'contacto_coherente':
        return <MapPin size={16} className="text-rose-500" />;
      case 'local_business':
        return <Code2 size={16} className="text-cyan-500" />;
      default:
        return <CheckCircle2 size={16} className="text-slate-400" />;
    }
  };

  const handleToggleManual = (item: AgentReadinessItem) => {
    if (report.isGmbOAuthConnected && item.source === 'oauth_gmb') {
      if (showToast) {
        showToast(
          t(
            'Este ítem está verificado automáticamente mediante tu Google Business Profile conectado.',
            'This item is verified automatically through your connected Google Business Profile.'
          ),
          'info'
        );
      }
      return;
    }

    const nextState = !item.isVerified;
    AgentReadinessService.setManualCheck(item.id, nextState);
    setToggleTick(prev => prev + 1);

    if (showToast) {
      showToast(
        nextState 
          ? t(`✓ "${item.labelEs}" marcado como verificado`, `✓ "${item.labelEn}" marked as verified`)
          : t(`"${item.labelEs}" marcado como pendiente`, `"${item.labelEn}" marked as pending`),
        'info'
      );
    }
  };

  const handleFixClick = (item: AgentReadinessItem) => {
    if (onNavigateTab) {
      onNavigateTab(item.fixTab);
    } else {
      navigateTo({ tab: item.fixTab, scrollId: item.fixScrollId });
    }
  };

  const scoreBadgeColor = 
    report.score >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
    report.score >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
    'text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <PhoneCall size={18} />
            </span>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                {t('Agent Readiness: Preparación para Asistentes y Llamadas', 'Agent Readiness: Automated Call & Assistant Audit')}
              </h3>
              <p className="text-xs text-slate-400">
                {report.isGmbOAuthConnected 
                  ? t('Verificación automática mediante conexión OAuth de Google', 'Automatic verification via connected Google OAuth')
                  : t('Evaluación técnica de datos del perfil y verificación explicable', 'Technical audit of profile data with explainable verification')}
              </p>
            </div>
          </div>
        </div>

        {/* Score Pill */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {t('Score Verificable', 'Verifiable Score')}
            </div>
            <div className="text-xs font-semibold text-slate-300">
              {report.passedCount}/{report.totalCount} {t('ítems listos', 'items ready')}
            </div>
          </div>
          <div className={`px-3.5 py-1.5 rounded-2xl border text-xl font-black ${scoreBadgeColor}`}>
            {report.score}%
          </div>
        </div>
      </div>

      {/* Copy Oficial Permitido (Sin Alarmismo Inventado) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
        <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
          <ShieldCheck size={16} />
        </span>
        <div>
          <strong className="text-white font-semibold">
            {t('¿Por qué importa este checklist?', 'Why this checklist matters:')}
          </strong>{' '}
          {language === 'en' ? report.callReadinessSummaryEn : report.callReadinessSummaryEs}
        </div>
      </div>

      {/* Checklist Items List */}
      <div className="space-y-3">
        {report.items.map((item) => {
          const isPassed = item.isVerified;
          return (
            <div
              key={item.id}
              className={`p-3.5 md:p-4 rounded-2xl border transition-all ${
                isPassed 
                  ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80' 
                  : 'bg-rose-950/10 border-rose-900/30 hover:border-rose-800/50'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Icon & Description */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleManual(item)}
                    title={isPassed ? t('Click para cambiar verificación', 'Click to toggle verification') : t('Marcar como verificado', 'Mark as verified')}
                    className="mt-0.5 cursor-pointer transition shrink-0"
                  >
                    {isPassed ? (
                      <CheckCircle2 size={20} className="text-emerald-400" />
                    ) : (
                      <XCircle size={20} className="text-rose-400 opacity-80 hover:opacity-100" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1 rounded-md bg-slate-800/60">
                        {getItemIcon(item.id)}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {language === 'en' ? item.labelEn : item.labelEs}
                      </span>
                      
                      {/* Source tag */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                        {item.source === 'oauth_gmb' 
                          ? 'OAuth GBP' 
                          : item.source === 'profile_data' 
                            ? t('Perfil Bvelt', 'Bvelt Profile') 
                            : item.source === 'manual_verified' 
                              ? t('Manual', 'Manual') 
                              : t('Pendiente', 'Pending')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'en' ? item.descEn : item.descEs}
                    </p>

                    <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5 pt-0.5">
                      <span className={isPassed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isPassed ? '✓' : '✗'}
                      </span>
                      <span>{language === 'en' ? item.evidenceEn : item.evidenceEs}</span>
                    </div>
                  </div>
                </div>

                {/* Right: CTA to fix screen */}
                <div className="flex items-center gap-2 self-end md:self-auto shrink-0 pt-1 md:pt-0">
                  {!isPassed ? (
                    <button
                      onClick={() => handleFixClick(item)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      <span>{t('Corregir', 'Fix')}</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFixClick(item)}
                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                    >
                      {t('Revisar', 'Review')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info: OAuth vs Manual */}
      {!report.isGmbOAuthConnected && onOpenGmbModal && (
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            {t(
              '¿Tienes perfil de Google Business verificado? Conéctalo para auditoría automática.',
              'Have a verified Google Business listing? Connect it for automatic verification.'
            )}
          </span>
          <button
            onClick={onOpenGmbModal}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            {t('Vincular Google Business', 'Connect Google Business')}
          </button>
        </div>
      )}
    </div>
  );
};
