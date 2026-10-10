import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, CheckCircle, ShieldCheck, ArrowRight, Share2, 
  Copy, ExternalLink, Zap, PhoneCall, MessageSquare, Star, Clock, 
  MapPin, Sparkles, AlertCircle
} from 'lucide-react';
import { 
  ModeledOpportunityReport, 
  getFunnelReport, 
  OpportunitySignal 
} from '../services/signalsGenerator';
import { AgentReadinessService } from '../services/agentReadinessService';

export interface PublicReportFunnelPageProps {
  reportId: string;
  onActivateTrial?: (businessName: string) => void;
  onNavigateHome?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PublicReportFunnelPage: React.FC<PublicReportFunnelPageProps> = ({
  reportId,
  onActivateTrial,
  onNavigateHome,
  showToast
}) => {
  const [report, setReport] = useState<ModeledOpportunityReport | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [optOutSuccess, setOptOutSuccess] = useState(false);

  useEffect(() => {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    const loadedReport = getFunnelReport(reportId, searchParams);
    setReport(loadedReport);

    // Check opt-out status
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('bvelt_optout_prospects');
        if (raw) {
          const list: string[] = JSON.parse(raw);
          if (list.includes(reportId) || list.includes(loadedReport.businessName)) {
            setIsOptedOut(true);
          }
        }
      } catch {}
    }

    // SEO Title & Meta tags
    if (typeof document !== 'undefined') {
      const pageTitle = `Opportunity Report: ${loadedReport.businessName} | Bvelt`;
      document.title = pageTitle;

      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute(
        'content',
        `Public signals audit for ${loadedReport.businessName}. Estimated opportunity ${loadedReport.modeledMonthlyRange.formatted} (MODELED). Zero false claims.`
      );

      // OpenGraph tags
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', pageTitle);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute(
        'content',
        `Public friction signals and recoverable revenue potential for ${loadedReport.businessName}. Modeled projection.`
      );
    }
  }, [reportId]);

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const handleOptOut = () => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('bvelt_optout_prospects');
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(reportId)) list.push(reportId);
        if (report.businessName && !list.includes(report.businessName)) list.push(report.businessName);
        localStorage.setItem('bvelt_optout_prospects', JSON.stringify(list));

        // Mark in operator prospects list
        const rawProspects = localStorage.getItem('bvelt_operator_funnel_prospects');
        if (rawProspects) {
          const prospectsList = JSON.parse(rawProspects);
          const updated = prospectsList.map((p: any) => 
            p.slug === reportId || p.businessName === report.businessName 
              ? { ...p, status: 'opt_out', notes: 'Prospect requested removal (STOP)' }
              : p
          );
          localStorage.setItem('bvelt_operator_funnel_prospects', JSON.stringify(updated));
        }
      } catch {}
    }
    setIsOptedOut(true);
    setOptOutSuccess(true);
    if (showToast) {
      showToast('✓ Removal requested. This business has been marked opt-out.', 'info');
    }
  };

  const handleShare = async () => {
    try {
      if (typeof window !== 'undefined') {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        if (showToast) {
          showToast('✓ Report link copied to clipboard', 'success');
        }
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      if (showToast) {
        showToast('Error copying link', 'error');
      }
    }
  };

  const handleCtaClick = () => {
    if (onActivateTrial) {
      onActivateTrial(report.businessName);
    } else if (typeof window !== 'undefined') {
      const targetUrl = `/?trial=true&biz=${encodeURIComponent(report.businessName)}&source=funnel_report`;
      window.location.href = targetUrl;
    }
  };

  const getSeverityBadge = (severity: OpportunitySignal['severity']) => {
    switch (severity) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle size={10} /> High Friction
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle size={10} /> Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles size={10} /> Opportunity
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-md">
            <Zap size={14} className="text-white fill-white" />
          </div>
          <div>
            <div className="text-xs font-black tracking-widest text-white uppercase flex items-center gap-1.5">
              Bvelt <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">Audit</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
        >
          {copiedLink ? <CheckCircle size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          <span>{copiedLink ? 'Copied' : 'Share'}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        
        {/* Business Header Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={14} /> Public Business Audit
            </div>
            {isOptedOut && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Opted-Out
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
              {report.businessName}
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-slate-500" /> {report.city}
              </span>
              <span>•</span>
              <span className="text-slate-300">{report.category}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed pt-1">
            This report analyzes visible public signals on your local channels to identify quotes and leads that aren't reaching closure.
          </p>
        </section>

        {/* HERO: Estimated Monthly Opportunity (SIEMPRE MODELED) */}
        <section className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Estimated Monthly Opportunity
            </span>
            {/* BADGE OBLIGATORIO: MODELED */}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {report.modeledBadge}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-black text-white tracking-tight">
              {report.modeledMonthlyRange.formatted}
            </div>
            {/* TEXTO OBLIGATORIO: We don't claim this money was already lost */}
            <p className="text-[11px] text-amber-200/90 leading-relaxed font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              ⚠️ <strong className="text-amber-200 font-bold">Transparent Notice:</strong> {report.disclaimerText || 'We don’t claim this money was already lost. This represents estimated potential revenue modeled from public signals.'}
            </p>
          </div>
        </section>

        {/* SIGNALS FOUND */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-400" />
              Signals Found ({report.signals.length})
            </h2>
            <span className="text-[11px] text-slate-400">Public Channels</span>
          </div>

          <div className="space-y-3">
            {report.signals.map((sig, idx) => (
              <div 
                key={sig.id || idx}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {sig.title}
                  </h3>
                  {getSeverityBadge(sig.severity)}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {sig.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <span className="font-semibold text-indigo-400">
                    Source: {sig.source}
                  </span>
                  {sig.date && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={10} /> {sig.date}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AGENT READINESS */}
        {(() => {
          const readiness = AgentReadinessService.evaluateReadiness({
            name: report.businessName,
            location: report.city,
            category: report.category,
            services: [report.category],
            phone: '+1 800 555 0199'
          });

          return (
            <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <PhoneCall size={16} />
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Agent Readiness ({readiness.passedCount}/{readiness.totalCount})
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {readiness.score}% Verified
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {readiness.publicCopyEn || readiness.publicCopyEs}
              </p>

              <div className="space-y-2 pt-1">
                {readiness.items.map((it) => (
                  <div 
                    key={it.id} 
                    className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <span className={it.isVerified ? "text-emerald-400 font-bold mt-0.5" : "text-amber-400 font-bold mt-0.5"}>
                        {it.isVerified ? "✓" : "○"}
                      </span>
                      <div>
                        <div className="font-bold text-slate-200">{it.labelEn || it.labelEs}</div>
                        <div className="text-[11px] text-slate-400">{it.evidenceEn || it.evidenceEs}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      {it.isVerified ? "Ready" : "Needs adjustment"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Mechanism Card: How Bvelt Resolves These Signals */}
        <section className="bg-slate-900/50 border border-slate-800/70 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            How Bvelt Resolves These Signals
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>1-Click Professional Reply:</strong> Professional responses to public reviews to protect your online reputation.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Quote Follow-Up Recovery:</strong> Personalized follow-up messages via WhatsApp or SMS that win back undecided clients.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Zero Friction Contact:</strong> Seamless call & inquiry follow-up with real-time verification.</span>
            </li>
          </ul>
        </section>

        {/* 1 PRIORITY CTA: Recover an opportunity with Bvelt — $0 if no result */}
        <section className="pt-2">
          <div className="bg-gradient-to-b from-indigo-900/40 to-slate-900 border border-indigo-500/40 rounded-3xl p-5 text-center space-y-3 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck size={12} /> Zero Risk Guarantee
            </div>

            <button
              onClick={handleCtaClick}
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/20 transition transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{report.ctaText || 'Recover an opportunity with Bvelt — $0 if no result'}</span>
              <ArrowRight size={16} />
            </button>

            <p className="text-[11px] text-slate-400 leading-snug">
              {report.ctaSubtext || '2-minute setup with no credit card required. Bvelt Guarantee: you only pay if you win back revenue.'}
            </p>
          </div>
        </section>

        {/* Minimal Legal Footer & Opt-Out */}
        <footer className="pt-6 border-t border-slate-800/80 text-center space-y-3 text-xs text-slate-500">
          <p className="leading-relaxed text-[11px]">
            This report is prepared by Bvelt on behalf of verified local operators to assist with customer retention and lead recovery.
          </p>

          <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800/80 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-[11px]">Do not want report updates or want this audit removed?</span>
            </div>
            {optOutSuccess || isOptedOut ? (
              <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle size={12} /> Removal requested. This business has been marked opt-out.
              </p>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOptOut}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700 text-[11px] font-semibold rounded-xl transition cursor-pointer"
                >
                  Reply STOP / Request Removal (Opt-Out)
                </button>
              </div>
            )}
          </div>
        </footer>

      </main>

      {/* Floating Bottom Sticky Bar for Mobile Conversion */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 p-3 sm:hidden">
        <button
          onClick={handleCtaClick}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-black text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Recover an opportunity with Bvelt — $0 if no result</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
