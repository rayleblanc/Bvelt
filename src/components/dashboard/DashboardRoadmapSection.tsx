import React, { useState, useRef } from 'react';
import { Award, CheckCircle, Lock, Mail, Clock, ShieldCheck, Heart } from 'lucide-react';
import { loadBveltCore, exportBveltDataJson, importBveltDataJson, logBveltActivity } from '../../lib/bveltCore';

interface DashboardRoadmapSectionProps {
  t: (es: string, en: string) => string;
  growthStats: any;
  setActiveTab: (tab: string) => void;
  onRunSeoAudit: () => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenReferralModal?: () => void;
}

export const DashboardRoadmapSection: React.FC<DashboardRoadmapSectionProps> = ({
  t,
  growthStats,
  setActiveTab,
  onRunSeoAudit,
  showToast,
  onOpenReferralModal,
}) => {
  const [coreData, setCoreData] = useState(() => loadBveltCore());
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshCore = () => {
    setCoreData(loadBveltCore());
  };

  const handleExportData = () => {
    const jsonStr = exportBveltDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bvelt-core-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logBveltActivity('DATA_EXPORTED', 'Bvelt Core Data exported to JSON backup file.');
    refreshCore();
    if (showToast) showToast(t('¡Datos de Bvelt exportados correctamente!', 'Bvelt core data exported successfully!'), 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importBveltDataJson(content);
        if (res.success) {
          setImportSuccess(t('¡Datos importados con éxito! Recargando...', 'Data successfully imported! Reloading...'));
          setImportError(null);
          refreshCore();
          if (showToast) showToast(t('¡Copia de seguridad restaurada con éxito!', 'Backup successfully restored!'), 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setImportError(res.error || t('Error al importar archivo.', 'Import error.'));
          setImportSuccess(null);
        }
      }
    };
    reader.readAsText(file);
  };

  // Authority levels calculation
  const l1 = (growthStats?.reviews || 0) >= 5;
  const l2 = l1 && (growthStats?.posts || 0) >= 10;
  const l3 = l2 && (growthStats?.leads || 0) >= 50;
  const lvlNum = l3 ? 4 : (l2 ? 3 : (l1 ? 2 : 1));
  const lvlLabel = lvlNum === 4 ? t("Nivel 4: Platino", "Level 4: Platinum")
    : lvlNum === 3 ? t("Nivel 3: Oro", "Level 3: Gold")
    : lvlNum === 2 ? t("Nivel 2: Plata", "Level 2: Silver")
    : t("Nivel 1: Bronce", "Level 1: Bronze");

  const steps = [
    { 
      level: t("Bronce", "Bronze"), 
      status: (growthStats?.reviews || 0) >= 5 ? 'completed' : 'active',
      task: t("Verificar GMB y 5 Reseñas", "Verify GMB & 5 Reviews"),
      color: 'bg-orange-500',
      tab: 'reviews'
    },
    { 
      level: t("Plata", "Silver"), 
      status: (growthStats?.reviews || 0) >= 5 ? ((growthStats?.posts || 0) >= 10 ? 'completed' : 'active') : 'locked',
      task: t("Posts Semanales y Respuestas Automáticas", "Weekly Posts & Auto Replies"),
      color: 'bg-slate-400',
      tab: 'social'
    },
    { 
      level: t("Oro", "Gold"), 
      status: (growthStats?.posts || 0) >= 10 ? ((growthStats?.leads || 0) >= 50 ? 'completed' : 'active') : 'locked',
      task: t("Cobertura de Vecindario", "Neighborhood Coverage"),
      color: 'bg-amber-500',
      tab: 'tools'
    },
    { 
      level: t("Platino", "Platinum"), 
      status: (growthStats?.leads || 0) >= 50 ? 'active' : 'locked',
      task: t("Top 3 en toda la Ciudad", "Top 3 City-wide"),
      color: 'bg-indigo-600',
      tab: 'growth'
    }
  ];

  return (
    <div id="section-roadmap-support" className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            {t("5. Hoja de Ruta, Respaldo y Soporte", "5. Authority Roadmap, Core Data & Support")}
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {t("Progreso hacia el Nivel Platino, respaldo de datos seguro y canal de soporte directo.", "Progress toward Platinum Level, secure local data backup & direct support channel.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-full border border-purple-100 dark:border-purple-900/30">
            {lvlLabel}
          </span>
        </div>
      </div>

      {/* Authority Roadmap */}
      <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-purple-500/20 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
              <Award className="text-amber-500" />
              {t("Hoja de Ruta de Autoridad", "Authority Roadmap")}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              {t("Tu camino de visibilidad y liderazgo local", "Your local visibility & growth roadmap")}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
            <div className="flex -space-x-2">
              {[1,2,3,4].map(i => (
                <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black ${i <= lvlNum ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                  {i}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-black uppercase text-slate-500">{lvlLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className={`relative p-6 rounded-[2.5rem] border flex flex-col gap-4 transition-all ${step.status === 'active' ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/20 shadow-lg scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'}`}>
              {step.status === 'completed' && <div className="absolute top-4 right-4 text-emerald-500"><CheckCircle size={20} fill="currentColor" className="text-white dark:text-slate-900" /></div>}
              {step.status === 'locked' && <div className="absolute top-4 right-4 text-slate-300 dark:text-slate-600"><Lock size={18} /></div>}
              
              <div className="space-y-1">
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white ${step.color}`}>
                  {step.level}
                </span>
                <h4 className={`text-sm font-black mt-2 leading-tight ${step.status === 'locked' ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                  {step.task}
                </h4>
              </div>
              
              {step.status === 'active' && (
                <button 
                  onClick={() => {
                    if (step.level === t("Bronce", "Bronze")) {
                      setActiveTab('growth');
                      onRunSeoAudit();
                    } else {
                      setActiveTab(step.tab);
                    }
                  }}
                  className="w-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-indigo-700 transition cursor-pointer"
                >
                  {t("Completar Ahora", "Complete Now")}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bvelt Core Data Layer 1.0 Section */}
      <div className="bg-white dark:bg-[#0f172a]/85 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-indigo-500/30 p-6 md:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("Capa de Datos Central Bvelt 1.0", "Bvelt Core Data Layer 1.0")}
              </h3>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {t("Almacenamiento central, historial de actividad y respaldo seguro.", "Centralized store, activity history, and secure local backup.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20">
              v{coreData?.version || '1.0.0'}
            </span>
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
              🔒 {t('Tus Datos y Privacidad Bvelt', 'Your Bvelt Data & Privacy')}
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('Bvelt sincroniza tus datos comerciales, leads y planes de forma segura en la nube (Firestore) con respaldo en caché local para acceso instantáneo y privacidad.', 'Bvelt securely syncs your commercial data, leads, and plans in the cloud (Firestore) with local cache backup for instant access and privacy.')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportData}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>{t('Exportar Datos Bvelt', 'Export Bvelt Data')}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs uppercase px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <span>{t('Importar Datos Bvelt', 'Import Bvelt Data')}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {importError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 font-bold">
            {importError}
          </div>
        )}
        {importSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-500 font-bold">
            {importSuccess}
          </div>
        )}

        {/* Activity Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t('Línea de Tiempo de Actividad Bvelt', 'Bvelt Activity Timeline')}
            </h4>
            <span className="text-[10px] font-bold text-slate-400">
              {coreData?.activityHistory?.length || 0} {t('eventos registrados', 'events recorded')}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-3">
            {(!coreData?.activityHistory || coreData.activityHistory.length === 0) ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {t('No hay actividad registrada todavía.', 'No activity recorded yet.')}
              </p>
            ) : (
              coreData.activityHistory.slice(0, 15).map((act: any) => (
                <div key={act.id} className="flex items-start justify-between gap-4 pb-2.5 border-b border-slate-200/60 dark:border-slate-800/80 last:border-0 last:pb-0">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        {act.type}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {act.description}
                      </span>
                    </div>
                    {act.relatedEntityId && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        ID: {act.relatedEntityId}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 flex-shrink-0">
                    <Clock size={11} /> {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Viral Referral Banner */}
      {onOpenReferralModal && (
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border border-amber-500/30 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
              <Heart size={18} className="text-red-500 fill-red-500" />
              {t("¡Regala un mes gratis a otro negocio!", "Gift a free month to another business!")}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t("Invita a un colega o negocio amigo y ambos recibirán 30 días de Bvelt Pro gratis.", "Invite a colleague or business friend and both get 30 days of Bvelt Pro free.")}
            </p>
          </div>
          <button
            onClick={onOpenReferralModal}
            className="bg-gradient-to-r from-amber-500 to-indigo-600 text-white font-black text-xs uppercase px-6 py-3 rounded-xl shadow-lg transition hover:scale-105 cursor-pointer shrink-0"
          >
            {t("Compartir Enlace", "Share Link")}
          </button>
        </div>
      )}

      {/* Support Section */}
      <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-indigo-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white rounded-[2rem] border border-indigo-200 dark:border-slate-800 p-4 md:p-6 shadow-xl relative overflow-hidden my-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-3 font-sans">
          <span className="mx-auto bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-500/20 font-mono w-fit block">
            {t("Soporte y Atención Directa", "Direct Support & Contact")}
          </span>
          <h4 className="text-lg md:text-xl font-black tracking-tight leading-tight">
            {t("¿Tienes dudas o necesitas ayuda personalizada?", "Have questions or need custom assistance?")}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal max-w-xl mx-auto font-normal">
            {t("Escríbenos directamente por Gmail para recibir soporte y atención rápida a tu cuenta.", 
               "Write to us directly via Gmail for direct support and fast assistance for your account.")}
          </p>

          <div className="pt-1 flex flex-col items-center justify-center">
            <button 
              type="button"
              onClick={() => {
                const subject = encodeURIComponent("Soporte Bvelt");
                const body = encodeURIComponent("Hola equipo de Bvelt,\n\nEscribo desde mi cuenta del negocio:\n\n");
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=rainerblanco405@gmail.com&su=${subject}&body=${body}`;
                window.open(gmailUrl, '_blank');
              }}
              className="w-full bg-gradient-to-r from-red-500 via-red-600 to-amber-500 hover:scale-[1.02] active:scale-[0.98] text-white font-black py-2 px-4 rounded-xl text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 max-w-xs border-none"
            >
              <Mail size={14} />
              {t("Abrir Gmail y Escribir", "Open Gmail & Compose")}
            </button>
            <p className="text-[9px] text-slate-500 mt-1.5 italic font-medium">
              {t("Se abrirá un borrador directo en tu cuenta para tu comodidad.", "This opens a direct compose draft in your Gmail account for your comfort.")}
            </p>
          </div>
        </div>
      </div>

      {/* Why Bvelt Section */}
      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[3rem] p-8 md:p-12 border border-slate-100 dark:border-slate-800 text-center space-y-4">
        <h4 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {t("¿Por qué Bvelt?", "Why Bvelt?")}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
          {t(
            "Hemos diseñado esta herramienta bajo un principio simple: Business Velocity & Trust. Automatiza tu visibilidad, impulsa tus reseñas y capta clientes sin perder el tiempo en tecnología compleja ni configuraciones confusas.",
            "We've designed this tool under a simple principle: Business Velocity & Trust. Automate your visibility, boost reviews, and capture clients without wasting time on complex tech or confusing setups."
          )}
        </p>
      </div>
    </div>
  );
};
