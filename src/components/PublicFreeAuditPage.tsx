import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Star, 
  Award, 
  Download, 
  Mail, 
  ArrowRight, 
  Lock, 
  Building, 
  MapPin, 
  Globe, 
  Moon, 
  Sun,
  ShieldCheck,
  Smartphone,
  PhoneCall,
  Search,
  Share2,
  Copy,
  Send,
  Sparkles,
  AlertTriangle,
  Target,
  Zap,
  ChevronRight
} from 'lucide-react';
import { getFirebaseDB } from '../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { IndustryResolver } from '../knowledge/resolvers/industryResolver';
import { MarketReferenceEngine } from '../knowledge/engine/marketReferenceEngine';
import { BveltTrustLayer } from '../lib/bveltTrustLayer';
import { ActionEngine } from '../knowledge/engine/actionEngine';
import { getEvidenceBadge } from '../lib/bveltEvidence';
import { trackBveltEvent } from '../lib/bveltObservability';
import { executeBusinessScan, BusinessScanResult } from '../services/businessScanService';

interface PublicFreeAuditPageProps {
  language: 'es' | 'en';
  setLanguage: (lang: 'es' | 'en') => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  t: (es: string, en: string) => string;
  isFirebaseReady: boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onGoToLogin?: () => void;
  onActivateTrial?: (data: { name: string; location: string; category: string }) => void;
}

interface AuditItem {
  id: string;
  category: string;
  labelEs: string;
  labelEn: string;
  descEs: string;
  descEn: string;
  tipEs: string;
  tipEn: string;
  points: number;
}

export function PublicFreeAuditPage({
  language,
  setLanguage,
  isDarkMode,
  setIsDarkMode,
  t,
  isFirebaseReady,
  showToast,
  onGoToLogin,
  onActivateTrial
}: PublicFreeAuditPageProps) {
  // Step 1: Landing Form State
  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // States for Real OSM / Geoapify competitors and scanning status
  const [realCompetitors, setRealCompetitors] = useState<any[]>([]);
  const [scanResult, setScanResult] = useState<BusinessScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Run the real maps/business scan when landing on step 2
  useEffect(() => {
    if (step === 2 && category && city) {
      setIsScanning(true);
      executeBusinessScan({
        businessName: businessName || 'Negocio Local',
        city,
        niche: category
      }).then((res) => {
        setScanResult(res);
        if (res.competitors) {
          setRealCompetitors(res.competitors);
        }
      }).catch((e) => {
        console.warn("Audit page real scan failed, falling back to deterministic: ", e);
      }).finally(() => {
        setIsScanning(false);
      });
    }
  }, [step, category, city]);

  // Parse URL search parameters on load for shareability
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const nameParam = params.get('name') || params.get('bname');
      const nicheParam = params.get('niche') || params.get('category') || params.get('cat');
      const cityParam = params.get('city') || params.get('location') || params.get('loc');

      if (nameParam) setBusinessName(nameParam);
      if (nicheParam) setCategory(nicheParam);
      if (cityParam) setCity(cityParam);

      if (nicheParam && cityParam) {
        setStep(2);
        trackBveltEvent('free_market_check', { niche: nicheParam, location: cityParam });
      } else {
        trackBveltEvent('analysis_started', {});
      }
    } catch (e) {
      console.error('Error parsing URL params for free audit', e);
    }
  }, []);

  // Copy shareable link callback
  const handleCopyShareLink = () => {
    try {
      const origin = window.location.origin;
      const shareUrl = `${origin}/report?biz=${encodeURIComponent(businessName)}&city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`;
      navigator.clipboard.writeText(shareUrl);
      showToast(t("¡Enlace de reporte de fugas copiado al portapapeles! Listo para compartir.", "Revenue leak report link copied to clipboard! Ready to share."), "success");
      trackBveltEvent('first_insight_viewed', { niche: category, location: city });
    } catch (err) {
      console.error(err);
      showToast(t("No se pudo copiar el enlace", "Could not copy the link"), "error");
    }
  };

  // Step 2: Checklist Toggle States
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    hours: true,
    link: false,
  });

  const auditItems: AuditItem[] = [
    {
      id: 'keywords',
      category: 'Visibilidad',
      labelEs: 'Oficio Claro en el Nombre',
      labelEn: 'Clear Trade in Business Name',
      descEs: '¿Tu nombre comercial en Google indica con claridad tu oficio y ciudad? (Ej. "Fontanería Express Miami - Fontanería García").',
      descEn: 'Does your business name on Google clearly state your main trade and city? (e.g. "Express Plumbing Miami - Garcia Plumbing").',
      tipEs: '💡 Los clientes en emergencias tocan primero el perfil que dice con exactitud el trabajo que realizan.',
      tipEn: '💡 Homeowners in emergencies tap the business that clearly states their trade first.',
      points: 20
    },
    {
      id: 'hours',
      category: 'Operatividad',
      labelEs: 'Horarios Completos y Festivos',
      labelEn: 'Complete & Holiday Hours',
      descEs: '¿Tienes tus horarios normales actualizados y configuras los horarios especiales en días festivos?',
      descEn: 'Are your opening hours updated and do you configure special hours on national holidays?',
      tipEs: '💡 Mantener los horarios de apertura y festivos actualizados previene reclamos y refuerza la confiabilidad de tu ficha.',
      tipEn: '💡 Keeping standard and holiday hours updated prevents customer frustration and reinforces profile reliability.',
      points: 10
    },
    {
      id: 'photos',
      category: 'Geolocalización',
      labelEs: 'Fotos Semanales de Trabajos',
      labelEn: 'Weekly Job Photos',
      descEs: '¿Subes al menos 1 o 2 fotos reales de tus trabajos terminados a tu ficha de Google cada semana?',
      descEn: 'Do you upload at least 1 or 2 actual project photos to your Google Business Profile weekly?',
      tipEs: '📸 Fotos reales de trabajos demuestran a propietarios que tu servicio es activo y confiable.',
      tipEn: '📸 Point-and-shoot job photos show homeowners you do real work in their neighborhood.',
      points: 15
    },
    {
      id: 'categories',
      category: 'Servicios',
      labelEs: 'Lista Completa de Servicios',
      labelEn: 'Complete Services List',
      descEs: '¿Has rellenado la lista de servicios específicos con descripciones claras de lo que resuelves?',
      descEn: 'Have you filled out the specific services list with clear descriptions of what you fix?',
      tipEs: '🛠️ Los clientes locales llaman cuando ven exactamente la reparación o instalación que necesitan.',
      tipEn: '🛠️ Local customers call when they see the exact repair or install service they need listed.',
      points: 15
    },
    {
      id: 'replies',
      category: 'Atención',
      labelEs: 'Respuestas Rápidas a Clientes',
      labelEn: 'Prompt Review Responses',
      descEs: '¿Respondes a cada reseña recibida en menos de 24 horas confirmando el trabajo realizado?',
      descEn: 'Do you reply to every review within 24 hours confirming the completed job?',
      tipEs: '✍️ Las respuestas rápidas y atentas aumentan la confianza de nuevos clientes que comparan contratistas.',
      tipEn: '✍️ Fast, attentive responses build high trust for homeowners comparing nearby contractors.',
      points: 15
    },
    {
      id: 'textback',
      category: 'Conversión',
      labelEs: 'Text-Back de Llamadas Perdidas',
      labelEn: 'Missed Call Text-Back',
      descEs: '¿Has configurado un mensaje automatizado de WhatsApp o SMS en tu móvil para responder al instante cuando no puedes contestar una llamada?',
      descEn: 'Have you configured an auto-responder text on your phone to instantly rescue missed customer phone calls?',
      tipEs: '📞 Los clientes locales que buscan un servicio urgente suelen llamar a otro competidor si no reciben respuesta inmediata.',
      tipEn: '📞 Local prospects searching for urgent services often dial the next competitor immediately if they do not receive an immediate reply.',
      points: 10
    },
    {
      id: 'link',
      category: 'Reputación',
      labelEs: 'Link Directo de Opinión Guardado',
      labelEn: 'Direct Review Link Saved',
      descEs: '¿Has guardado tu link corto oficial de opiniones de Google Business en tu perfil de Bvelt para que funcione el Escudo Preventivo?',
      descEn: 'Have you added your official short Google Maps review link in your Bvelt Profile so the Reputation Shield redirects customers?',
      tipEs: '🛡️ Sin este link, el sistema no puede guiar de forma automatizada a los clientes satisfechos a publicar sus opiniones.',
      tipEn: '🛡️ Keeping this link updated is vital so satisfied customers are instantly redirected to rate you publicly on Maps.',
      points: 10
    },
    {
      id: 'flyer',
      category: 'Reputación',
      labelEs: 'Envío de QR o Enlaces Post-Servicio',
      labelEn: 'Post-Service QR/Link Outreach',
      descEs: '¿Evitas solicitar reseñas en caliente dentro del local o en el momento físico de entrega del trabajo (que viola las normas de Google de abril 2026) y en su lugar entregas folletos para llevar a casa o envías solicitudes de seguimiento automatizadas por SMS/Email?',
      descEn: 'Do you avoid gathering instant reviews inside your premises or during in-person delivery (violating Google’s April 2026 terms) and instead deliver take-home printouts or send automated SMS/Email follow-up requests?',
      tipEs: '🛡️ Google suspende fichas que recopilan opiniones desde IPs co-ubicadas o dispositivos en tienda. Utiliza folletos o door hangers para que tus clientes califiquen de forma segura desde sus hogares.',
      tipEn: '🛡️ Google penalizes reviews sent from co-located store IPs or same-device terminals. Use take-home printouts or door hangers so your customers review safely from their own homes.',
      points: 5
    }
  ];

  const handleToggle = (id: string) => {
    setCheckedItems(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      if (updated[id]) {
        showToast(t('¡Requisito optimizado! Puntaje aumentado.', 'Requirement optimized! Score boosted.'), 'success');
      } else {
        showToast(t('Puntaje restado.', 'Score deducted.'), 'info');
      }
      return updated;
    });
  };

  const totalScore = auditItems.reduce((acc, item) => acc + (checkedItems[item.id] ? item.points : 0), 0);

  const getSEOLevel = () => {
    if (totalScore < 40) {
      return { 
        title: t('Bajo (Invisible 📉)', 'Low (Invisible 📉)'), 
        color: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5', 
        callMult: 'x1.1', 
        desc: t('Tu negocio apenas aparece en las búsquedas locales. Tus competidores con fichas optimizadas están captando la demanda directa de tu zona.', 'Your business is barely showing up in local searches. Competitors with optimized listings are capturing most local inquiries.') 
      };
    }
    if (totalScore < 75) {
      return { 
        title: t('Medio (Competitivo 📊)', 'Medium (Competitive 📊)'), 
        color: 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5', 
        callMult: 'x1.8', 
        desc: t('Apareces ocasionalmente en el "Local Pack". Pequeños ajustes en fotos y palabras clave duplicarán tus llamadas orgánicas.', 'You appear occasionally in the local map pack. Making minor adjustments in photos & keywords will double your calls.') 
      };
    }
    return { 
      title: t('Élite (Dominador Local 🏆)', 'Elite (Local Dominator 🏆)'), 
      color: 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5', 
      callMult: 'x3.2', 
      desc: t('¡Excelente! Google te considera una autoridad local. Tu ficha está perfectamente estructurada para captar la mayoría de llamadas en tu ciudad.', 'Excellent! Google considers you a top local authority. Your profile is perfectly configured to capture most inbound leads.') 
    };
  };

  const seoLevel = getSEOLevel();

  // --- Start of deterministic Calculations for Bvelt Moment and Gaps ---
  const parsedRating = scanResult?.rating ?? null;
  const parsedReviews = scanResult?.reviewCount ?? null;
  const realWebsite = scanResult?.website || undefined;
  const hasWebsite = realWebsite ? true : (scanResult?.hasWebsite !== undefined ? scanResult.hasWebsite : undefined);

  const resolvedNiche = IndustryResolver.resolve(category || 'Servicios');
  const gaps = (category && city) ? MarketReferenceEngine.detectMarketGaps(
    {
      businessName: businessName || 'Negocio Local',
      niche: category,
      city,
      rating: parsedRating ?? undefined,
      reviewCount: parsedReviews ?? undefined,
      website: realWebsite,
      hasWebsite
    },
    realCompetitors,
    language === 'en' ? 'en' : 'es'
  ) : [];

  const trustScore = BveltTrustLayer.calculateMarketOpportunityScore({
    hasWebsite,
    rating: parsedRating,
    reviewCount: parsedReviews,
    competitorCount: realCompetitors.length > 0 ? realCompetitors.length : null,
    city: city || null,
    niche: category || null
  });

  const actions = ActionEngine.computeNextBestActions({
    leads: [],
    opportunities: [],
    marketContext: {
      industry: category || 'Servicios',
      niche: category || 'Servicios',
      city: city || 'Ciudad Local',
      marketGaps: gaps
    },
    profile: {
      businessName: businessName || 'Negocio Local',
      category: category || 'Servicios',
      location: city || 'Ciudad Local',
      rating: parsedRating,
      reviewsCount: parsedReviews
    },
    lang: language === 'en' ? 'en' : 'es'
  });

  // Dynamic Bvelt Moment Synthesis based strictly on real evidence
  const isEn = language === 'en';
  const competitorCountLabel = realCompetitors.length;
  const happening = competitorCountLabel > 0
    ? (isEn
        ? `In ${city || 'your city'}, scan of ${category || 'your niche'} detected ${competitorCountLabel} mapped competitor POIs and ${gaps.length} observable market gaps.`
        : `En la zona de ${city || 'tu ciudad'}, el escaneo de ${category || 'tu nicho'} detectó ${competitorCountLabel} competidores mapeados y ${gaps.length} brechas de visibilidad observadas.`)
    : (isEn
        ? `In ${city || 'your city'}, competitor data is currently limited in open public maps for ${category || 'your niche'}.`
        : `En la zona de ${city || 'tu ciudad'}, los datos de competidores son limitados en mapas públicos abiertos para ${category || 'tu nicho'}.`);

  const gapTitles = gaps.map(g => g.title).join(', ');
  const whyItMatters = gaps.length > 0
    ? (isEn
        ? `Observed market gaps (${gapTitles}) highlight uncaptured local customer intent.`
        : `Las brechas observadas (${gapTitles}) indican demanda de clientes locales sin capturar.`)
    : (isEn
        ? `Maintaining verified profile details and review cadence protects local search authority.`
        : `Mantener datos de contacto verificados y velocidad de reseñas protege el posicionamiento local.`);

  const opportunity = trustScore.score !== null
    ? (isEn
        ? `Calculated Opportunity Score: ${trustScore.score}/100. ${trustScore.explanation}`
        : `Score de Oportunidad calculado: ${trustScore.score}/100. ${trustScore.explanation}`)
    : (isEn
        ? `Opportunity Score: Insufficient verifiable signals for score calculation. ${trustScore.explanation}`
        : `Score de Oportunidad: Datos insuficientes para cálculo responsable. ${trustScore.explanation}`);

  const topActionTitle = actions.length > 0 ? actions[0].title : (isEn ? 'Verify Google Business Profile listing' : 'Verificar ficha de Google Business Profile');
  const nextAction = isEn ? `Recommended immediate step: ${topActionTitle}.` : `Paso inmediato recomendado: ${topActionTitle}.`;

  const bveltMoment = {
    happening,
    whyItMatters,
    opportunity,
    nextAction
  };

  const handleStartAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !category.trim() || !city.trim()) {
      showToast(t("Por favor rellena todos los campos", "Please fill in all fields"), "error");
      return;
    }
    setStep(2);
    showToast(t("¡Ficha inicial configurada! Comienza la auditoría.", "Initial business profile configured! Start your audit."), "success");
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showToast(t("Por favor introduce un correo válido", "Please enter a valid email"), "error");
      return;
    }

    setIsSubmittingLead(true);
    try {
      const leadData = {
        date: new Date().toLocaleDateString(),
        text: `Informe Solicitado: ${businessName} (${category} en ${city})`,
        business_name: businessName,
        category: category,
        city: city,
        email: email,
        score: totalScore,
        urgency: totalScore < 50 ? 'Alta' : 'Media',
        size: 'Medio',
        action: 'Enviar PDF de Auditoría Gratuita y agendar llamada de consultoría local.',
        strategy: `Ficha con puntuación del ${totalScore}%. Ofrecer servicio de posicionamiento Local SEO.`,
        userId: 'public_free_audit',
        source: 'public_free_audit',
        created_at: new Date().toISOString()
      };

      // Save to localStorage so if the owner logs in, they might see it
      const savedLeads = localStorage.getItem('lf_leads');
      const currentLeads = savedLeads ? JSON.parse(savedLeads) : [];
      localStorage.setItem('lf_leads', JSON.stringify([leadData, ...currentLeads]));

      // Save to Firestore for actual live synchronization
      if (isFirebaseReady) {
        const db = getFirebaseDB();
        console.log("🔥 ESCRITURA EN FIRESTORE:", 'leads');
        await addDoc(collection(db, 'leads'), leadData);
      }

      setLeadSubmitted(true);
      showToast(t("¡Reporte solicitado con éxito! Te enviaremos el PDF.", "Report requested successfully! We will email you the PDF."), "success");
    } catch (err) {
      console.error(err);
      showToast(t("Error al solicitar el reporte", "Error requesting the report"), "error");
    } finally {
      setIsSubmittingLead(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} bg-[#f8fafc] dark:bg-[#080b11] text-slate-900 dark:text-white transition-colors duration-500 font-sans`}>
      {/* Public Header */}
      <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md">
            B
          </div>
          <span className="font-black tracking-tight text-xl">Bvelt<span className="text-indigo-600">.</span></span>
          <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-500/10">
            {t("AUDITORÍA PÚBLICA", "FREE PUBLIC AUDIT")}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-slate-400">
            <button 
              onClick={() => setLanguage('es')} 
              className={`hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase cursor-pointer ${language === 'es' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'font-medium'}`}
            >
              ES
            </button>
            <span className="opacity-40">|</span>
            <button 
              onClick={() => setLanguage('en')} 
              className={`hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase cursor-pointer ${language === 'en' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'font-medium'}`}
            >
              EN
            </button>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition cursor-pointer"
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {onGoToLogin && (
            <button
              onClick={onGoToLogin}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {t("Iniciar Sesión", "Log In")}
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-3xl mx-auto text-center space-y-8"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20 text-xs font-black uppercase tracking-wider">
                  <Star size={12} className="fill-current" />
                  {t("Optimiza tu Ficha de Google Business", "Optimize Your Google Business Profile")}
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {t("¿Por qué tu negocio no aparece en", "Why is your business not appearing in")} <br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 dark:from-indigo-400 dark:to-cyan-400">
                    Google Maps?
                  </span>
                </h1>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  {t("Averigua tu puntaje de visibilidad SEO local actual de forma gratuita. Descubre los errores críticos de tu ficha de Google que te hacen perder clientes frente a tu competencia.", 
                     "Check your current local SEO visibility score for free. Identify critical errors in your Google profile that cause you to lose clients to competitors daily.")}
                </p>
              </div>

              {/* Input Form Card */}
              <div className="bg-white dark:bg-slate-900/60 p-6 md:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-xl max-w-xl mx-auto text-left space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60 pb-3 flex items-center gap-2">
                  <Building size={16} className="text-indigo-500" />
                  {t("Detalles de tu Negocio", "Business Details")}
                </h3>

                <form onSubmit={handleStartAudit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {t("Nombre Comercial del Negocio", "Business Commercial Name")}
                    </label>
                    <input 
                      type="text" 
                      placeholder={t("Ej. Cerrajeros Urgentes Pérez", "e.g. Pérez Emergency Locksmiths")}
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {t("Categoría o Servicio Principal", "Primary Service / Category")}
                      </label>
                      <input 
                        type="text" 
                        placeholder={t("Ej. Cerrajería, Pintor, Clínica", "e.g. Locksmith, Painter, Clinic")}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {t("Ciudad / Localidad de Servicio", "City / Area of Service")}
                      </label>
                      <input 
                        type="text" 
                        placeholder={t("Ej. Madrid, Miami, Barcelona", "e.g. Madrid, Miami, Barcelona")}
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-slate-200 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer text-xs uppercase tracking-widest"
                  >
                    <span>{t("Comenzar Auditoría Gratis 🚀", "Start Free Audit 🚀")}</span>
                  </button>
                </form>
              </div>

              {/* Quick Trust Flags */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  {t("100% Gratis y Confidencial", "100% Free & Confidential")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Search size={14} className="text-indigo-500" />
                  {t("Optimizado para el Algoritmo 2026", "Optimized for the 2026 Algorithm")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone size={14} className="text-cyan-500" />
                  {t("Formato Móvil Amigable", "Mobile Friendly Format")}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Back to details button */}
              <button 
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                ← {t("Cambiar Datos del Negocio", "Change Business Details")}
              </button>

              {isScanning ? (
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 md:p-12 text-center space-y-6 max-w-xl mx-auto shadow-xl">
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 dark:border-indigo-500/10 animate-ping" />
                    <div className="absolute inset-2 rounded-full border-4 border-indigo-500/40 dark:border-indigo-500/20 animate-spin border-t-indigo-600" />
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full">
                      <Search size={24} className="animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      {t("Escaneando Señales de Demanda Real", "Auditing Real Demand Signals")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                      {t("Consultando registros públicos de OpenStreetMap y Geoapify. Resolviendo competidores y posicionamiento sin simular datos.",
                         "Querying public OpenStreetMap and Geoapify registries. Locating real competitors and visibility gaps dynamically.")}
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/10 px-3 py-1 rounded-full animate-pulse">
                      {t("Radar Activo...", "Radar Active...")}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Quick Profile Brief */}
                  <div className="bg-white dark:bg-[#0f172a]/70 border border-slate-200/50 dark:border-slate-800/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Building size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{businessName}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {category} • <span className="font-bold">{city}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                        {t("Estado: Análisis Basado en Evidencia", "Status: Evidence-Based Analysis")}
                      </span>
                    </div>
                  </div>

              {/* BVELT MOMENT - DECISION SYNTHESIS */}
              <div className="bg-gradient-to-br from-indigo-900/10 via-indigo-950/20 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-indigo-500/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
                      <Sparkles size={16} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {t('Bvelt Moment — Síntesis del Diagnóstico', 'Bvelt Moment — Diagnosis Synthesis')}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('Perspectiva algorítmica y de oportunidad local', 'Algorithmic perspective & local opportunity footprint')}
                      </p>
                    </div>
                  </div>
                  {/* Evidence Badge */}
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const evStatus = realCompetitors.length > 0 ? 'DERIVED' : 'INSUFFICIENT_DATA';
                      const badge = getEvidenceBadge(evStatus, t);
                      return (
                        <span className={`text-[9px] font-black uppercase border px-2.5 py-0.5 rounded-full ${badge.colorClass}`}>
                          {badge.icon} {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* 1. Qué está pasando */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      1. {t('¿Qué está pasando?', 'What is happening?')}
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {bveltMoment.happening}
                    </p>
                  </div>

                  {/* 2. Por qué importa */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      2. {t('¿Por qué importa?', 'Why does it matter?')}
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {bveltMoment.whyItMatters}
                    </p>
                  </div>

                  {/* 3. Oportunidad */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      3. {t('Oportunidad Comercial', 'Commercial Opportunity')}
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {bveltMoment.opportunity}
                    </p>
                  </div>

                  {/* 4. Próxima Acción */}
                  <div className="space-y-2 bg-indigo-500/5 dark:bg-indigo-500/10 p-3.5 rounded-xl border border-indigo-500/20">
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      4. {t('Siguiente Paso Crítico', 'Critical Next Step')}
                    </span>
                    <p className="text-xs text-slate-800 dark:text-indigo-200 leading-relaxed font-bold">
                      {bveltMoment.nextAction}
                    </p>
                  </div>
                </div>

                {/* Primary Acquisition CTA Bar */}
                <div className="pt-4 border-t border-indigo-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('¿Listo para activar estas oportunidades?', 'Ready to lock in these opportunities?')}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t('Inicia tu prueba gratuita de 7 días con estos datos ya cargados.', 'Launch your 7-day free trial with this exact profile context preloaded.')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Share Button */}
                    <button
                      onClick={handleCopyShareLink}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition uppercase tracking-wider border border-slate-300/40 dark:border-slate-700 w-full sm:w-auto cursor-pointer"
                    >
                      <Share2 size={14} />
                      {t('Compartir Diagnóstico', 'Share Diagnosis')}
                    </button>

                    {/* Activate CTA */}
                    {onActivateTrial && (
                      <button
                        onClick={() => onActivateTrial({ name: businessName, location: city, category: category })}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition uppercase tracking-wider shadow-lg shadow-indigo-600/30 w-full sm:w-auto cursor-pointer"
                      >
                        <Zap size={14} className="fill-current" />
                        {t('Activar Bvelt Gratis', 'Activate Bvelt Free')}
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Scorecard and Items */}
              <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-8 shadow-sm dark:shadow-xl">
                {/* Score Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{t('Auditoría de Captación Local', 'Local Customer Capture Audit')}</span>
                    <h3 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      🔍 {t('Diagnóstico de Ficha y Llamadas', 'Local Listing & Inquiries Audit')}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t('Selecciona los criterios que ya cumples actualmente en tu negocio para evaluar tu preparación para captar llamadas de clientes.', 
                         'Select the criteria you currently meet to evaluate your business readiness to capture client inquiries.')}
                    </p>
                  </div>

                  {/* Score circle replacement/card */}
                  <div className={`p-4 rounded-xl border flex flex-col items-center text-center min-w-[160px] ${seoLevel.color}`}>
                    <span className="text-[9px] uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-widest">{t('Salud Local SEO', 'Local SEO Health')}</span>
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 my-1">{totalScore}%</span>
                    <span className="text-[10px] font-bold uppercase">{seoLevel.title}</span>
                    <div className="mt-2 text-[10px] bg-slate-100 dark:bg-slate-900/80 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-300">
                      📞 {t('Tráfico de Llamadas:', 'Inbound Calls:')} <strong className="text-emerald-600 dark:text-emerald-400">{seoLevel.callMult}</strong>
                    </div>
                  </div>
                </div>

                {/* Main list & lead capture section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Items */}
                  <div className="lg:col-span-8 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('Factores Clave para Ganar Clientes Locales', 'Key Factors to Win Local Inquiries')}
                    </h4>

                    <div className="space-y-3">
                      {auditItems.map((item) => {
                        const isChecked = !!checkedItems[item.id];
                        return (
                          <div 
                            key={item.id}
                            onClick={() => handleToggle(item.id)}
                            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex gap-4 items-start ${
                              isChecked 
                                ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 text-slate-700 dark:text-slate-300' 
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#080b11]/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isChecked ? (
                                <CheckCircle size={18} className="text-emerald-500 fill-current" />
                              ) : (
                                <div className="w-[18px] h-[18px] border-2 border-slate-300 dark:border-slate-700 rounded-md"></div>
                              )}
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                  {t(item.labelEs, item.labelEn)}
                                </span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  isChecked 
                                    ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                                    : 'border-indigo-100 dark:border-indigo-500/10 bg-indigo-50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400'
                                }`}>
                                  {t(item.category, item.category)} (+{item.points} pts)
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                {t(item.descEs, item.descEn)}
                              </p>

                              {!isChecked && (
                                <p className="text-[10px] text-slate-500 italic pt-1 leading-relaxed">
                                  {t(item.tipEs, item.tipEn)}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-150 dark:border-slate-800/40">
                                {(() => {
                                  const evStatus = isChecked ? 'VERIFIED' : 'ESTIMATED';
                                  const badge = getEvidenceBadge(evStatus, t);
                                  return (
                                    <span className={`text-[8px] font-bold uppercase border px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.colorClass}`}>
                                      <span>{badge.icon}</span>
                                      <span>{badge.label}</span>
                                    </span>
                                  );
                                })()}
                                <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                  {isChecked ? t("Confirmado por entrada directa", "Confirmed by direct input") : t("Evidencia estimada por modelo de mercado", "Evidence estimated by market model")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sidebar with diagnostic & lead conversion capture */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <TrendingUp size={14} />
                        {t('Diagnóstico Estratégico', 'Strategic Diagnostics')}
                      </h4>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {seoLevel.desc}
                      </p>

                      {totalScore < 100 && (
                        <div className="space-y-3 pt-2">
                          <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                            {t('Próxima Acción Recomendada:', 'Next Recommended Action:')}
                          </span>

                          <div className="p-3 bg-white dark:bg-[#080b11] rounded-xl border border-slate-200 dark:border-slate-800 flex gap-3 items-start">
                            <AlertCircle size={16} className="text-indigo-600 dark:text-indigo-400 pt-0.5 shrink-0" />
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
                              {totalScore < 50 
                                ? t('Asegura que tu nombre de Google indique claramente tu oficio y ciudad para que los clientes te llamen primero.', 'Ensure your business listing clearly displays your trade and city so customers tap your phone number first.')
                                : t('Activa respuestas rápidas y cotización móvil para captar llamadas de clientes antes que la competencia local.', 'Activate fast responses and mobile quotes to capture service calls before nearby competitors.')
                              }
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Top Gaps in Plain Language + What to Do This Week (Max 3 Steps) */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider block">
                          {t("DIAGNÓSTICO EN LENGUAJE CLARO", "PLAIN LANGUAGE DIAGNOSIS")}
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                          {t("Principales Brechas de Clientes Detectadas", "Top Customer Gaps Identified")}
                        </h4>
                      </div>

                      {/* Top gaps in plain language */}
                      <div className="space-y-2 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            1. {t("Velocidad de Respuesta a Mensajes:", "Inquiry Response Speed:")}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                            {t("Las llamadas y textos que no se cotizan en 15 min van directo al competidor de guardia.", "Inquiries not quoted within 15 min go straight to the next contractor on call.")}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            2. {t("Volumen de Reseñas Recientes:", "Recent Review Advantage:")}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                            {t("Los perfiles con opiniones de las últimas 2 semanas capturan la primera llamada de urgencia.", "Profiles with reviews in the last 2 weeks win the first emergency call on Maps.")}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            3. {t("Seguimiento a Presupuestos Pasados:", "Follow-Up on Past Quotes:")}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                            {t("Contactos que no agendaron quedan olvidados sin un mensaje de reactivación.", "Inquiries that didn't book right away are forgotten without a follow-up text.")}
                          </p>
                        </div>
                      </div>

                      {/* What to do this week (3 steps max) */}
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider block">
                          {t("QUÉ HACER ESTA SEMANA (3 PASOS MÁXIMO)", "WHAT TO DO THIS WEEK (MAX 3 STEPS)")}
                        </span>
                        <div className="space-y-2 text-[11px]">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <p className="text-slate-700 dark:text-slate-300">
                              {t("Responder cada mensaje entrante en menos de 15 minutos con un presupuesto listo.", "Reply to every incoming inquiry within 15 minutes with a ready quote.")}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <p className="text-slate-700 dark:text-slate-300">
                              {t("Enviar tu enlace de reseña por SMS a tus últimos 3 clientes satisfechos.", "Send your review request link via SMS to your last 3 happy customers.")}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <p className="text-slate-700 dark:text-slate-300">
                              {t("Reactivar presupuestos del mes pasado para recuperar trabajos pendientes con 0 gasto en anuncios.", "Follow up on last month's quotes to recover unscheduled jobs with zero ad spend.")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Verified fact vs estimate */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] space-y-1">
                        <p className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle size={10} />
                          {t("Hecho Verificado: Datos públicos de ubicación y competidores en tu ciudad.", "Verified Fact: Public map listings and real competitors located in your area.")}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          {t("Nota: Las estimaciones de volumen son orientativas según la media del sector, no ingresos garantizados.", "Note: Volume projections are industry averages, not guaranteed revenue.")}
                        </p>
                      </div>
                    </div>

                    {/* Bvelt Commercial Golden Path CTA Card */}
                    <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-2xl border border-indigo-500/40 space-y-3.5 shadow-xl">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-400 text-slate-950 rounded-lg font-black text-xs">
                          <Zap size={14} className="fill-current" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                            {t('ENCONTRAMOS LOS MOVIMIENTOS QUE MÁS IMPORTAN', 'WE FOUND THE MOVES THAT MATTER MOST')}
                          </h4>
                          <p className="text-[10px] text-indigo-300">
                            {t('Diagnóstico y ejecución automática Bvelt Pro', 'Bvelt Pro automated diagnosis & execution')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-[11px] bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest block">{t('1. LO QUE ENCONTRAMOS', '1. WHAT WE FOUND')}</span>
                          <p className="text-slate-200 mt-0.5">{happening}</p>
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest block">{t('2. POR QUÉ IMPORTA', '2. WHY IT MATTERS')}</span>
                          <p className="text-slate-200 mt-0.5">{whyItMatters}</p>
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-400 uppercase text-[9px] tracking-widest block">{t('3. TU SIGUIENTE MEJOR ACCIÓN', '3. YOUR NEXT BEST ACTION')}</span>
                          <p className="text-slate-200 mt-0.5">{nextAction}</p>
                        </div>
                        <div>
                          <span className="font-extrabold text-amber-400 uppercase text-[9px] tracking-widest block">{t('4. LO QUE PUEDES HACER AHORA', '4. WHAT YOU CAN DO NEXT')}</span>
                          <p className="text-amber-200 mt-0.5 font-bold">{t('Activar Bvelt Pro ($49/mes o $390/año) con 7 Días de Prueba Sin Riesgo.', 'Activate Bvelt Pro ($49/mo or $390/yr) with 7-Day Risk-Free Trial.')}</p>
                        </div>
                      </div>

                      {onGoToLogin && (
                        <button
                          type="button"
                          onClick={onGoToLogin}
                          className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Zap size={14} className="fill-current" />
                          <span>{t('Activar Bvelt Pro (7 Días Sin Riesgo)', 'Activate Bvelt Pro (7-Day Trial)')}</span>
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>

                    {/* Highly Compelling Lead Form Card (TAREA 3) */}
                    <div className="p-5 bg-gradient-to-br from-indigo-550 to-indigo-700 text-white dark:from-indigo-950 dark:to-slate-950 rounded-2xl border border-indigo-500/20 space-y-4 shadow-xl">
                      {!leadSubmitted ? (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-white/10 dark:bg-indigo-500/10 text-white dark:text-indigo-400 rounded-xl">
                              <Download size={16} />
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-wider">
                              {t('Resumen de Oportunidades Locales (PDF)', 'Local Opportunities Summary (PDF)')}
                            </h4>
                          </div>

                          <p className="text-[11px] text-indigo-100 dark:text-slate-400 leading-relaxed">
                            {t(`Descarga el informe resumido para ${businessName}. Recibe un desglose en PDF con los 3 pasos clave para ganar más trabajos en ${city} sin gastar en anuncios.`, 
                               `Download the summary report for ${businessName}. Receive a PDF breakdown with the 3 key steps to win more local jobs in ${city} with zero ad spend.`)}
                          </p>

                          <form onSubmit={handleSubmitLead} className="space-y-3 pt-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-indigo-200 dark:text-slate-400 uppercase tracking-widest block">
                                {t('Tu Correo Electrónico', 'Your Email Address')}
                              </label>
                              <div className="relative">
                                <input 
                                  type="email" 
                                  placeholder="ejemplo@negocio.com"
                                  value={email}
                                  onChange={e => setEmail(e.target.value)}
                                  className="w-full bg-white/10 dark:bg-slate-900/60 border border-white/20 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-indigo-200 dark:placeholder-slate-500 outline-none focus:border-white dark:focus:border-indigo-500"
                                  required
                                />
                                <Mail size={12} className="absolute left-3.5 top-3.5 text-indigo-200 dark:text-slate-500" />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmittingLead}
                              className="w-full bg-white dark:bg-indigo-600 hover:bg-slate-50 dark:hover:bg-indigo-500 text-indigo-600 dark:text-white font-black py-2.5 rounded-xl text-[11px] transition uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-black/10"
                            >
                              {isSubmittingLead ? t("Generando...", "Generating...") : t("Solicitar Reporte Gratuito", "Request Free Report")}
                              <ArrowRight size={12} />
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="text-center py-4 space-y-3">
                          <CheckCircle size={32} className="text-emerald-400 mx-auto" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-white">
                            {t('¡Reporte Solicitado! 📩', 'Report Requested! 📩')}
                          </h4>
                          <p className="text-[11px] text-indigo-100 dark:text-slate-400 leading-relaxed">
                            {t(`Hemos guardado tu solicitud. En unos minutos recibirás tu reporte personalizado y guía para captar más llamadas en ${city}.`, 
                               `We have received your request. In a few minutes you will receive your personalized report and actionable steps to capture more calls in ${city}.`)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/50 dark:border-slate-800/60 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span>&copy; {new Date().getFullYear()} Bvelt. {t("Todos los derechos reservados.", "All rights reserved.")}</span>
          <div className="flex flex-wrap gap-4">
            <a href="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">{t("Sobre el creador", "About the creator")}</a>
            <a href="/terms.html" className="hover:text-indigo-600 transition">{t("Términos", "Terms")}</a>
            <a href="/privacy.html" className="hover:text-indigo-600 transition">{t("Privacidad", "Privacy")}</a>
            <a href="/legal.html" className="hover:text-indigo-600 transition">{t("Legal", "Legal")}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
