import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  TrendingUp, 
  Zap, 
  Target, 
  Star,
  X,
  Layers,
  ChevronRight,
  Compass,
  Briefcase,
  MessageSquare,
  Copy
} from 'lucide-react';
import { IndustryResolver, ProspectCommercialContext } from '../../knowledge/resolvers/industryResolver';
import { MarketReferenceEngine, MarketGap } from '../../knowledge/engine/marketReferenceEngine';
import { BveltTrustLayer, TrustScore } from '../../lib/bveltTrustLayer';
import { ActionEngine } from '../../knowledge/engine/actionEngine';
import { executeBusinessScan } from '../../services/businessScanService';
import { trackBveltEvent } from '../../lib/bveltObservability';
import { BusinessDnaService } from '../../knowledge/memory/businessDnaService';
import { recordBveltEvent } from '../../knowledge/memory/bemStore';
import { auth } from '../../lib/firebase';
import { getScanUsageInfo, recordScanUsage } from '../../lib/scanLimiter';
import { notifyOwner } from '../../services/ownerNotifier';
import { TypeaheadInput } from '../ui/TypeaheadInput';
import { getTradeSuggestions, getCitySuggestions } from '../../lib/typeaheadSuggestions';

export interface OnboardingData {
  name: string;
  category: string;
  niche: string;
  subNiche?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  gmbLink?: string;
  marketRadius: number;
  lat?: number;
  lng?: number;
}

interface BveltOnboardingWizardProps {
  isOpen: boolean;
  onClose?: () => void;
  onComplete: (data: OnboardingData, deepLinkAction?: { targetTab?: string; taskCode?: string; action?: any }) => Promise<void> | void;
  initialData?: Partial<OnboardingData>;
  userEmail?: string;
  userName?: string;
  t: (es: string, en: string) => string;
  language?: 'es' | 'en';
  setLanguage?: (lang: 'es' | 'en') => void;
  showToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onGoToPlans?: () => void;
  onStartTrial?: () => void;
  hasUsedTrial?: boolean;
}

export const BveltOnboardingWizard: React.FC<BveltOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialData,
  userEmail = '',
  userName = '',
  t,
  language = 'en',
  setLanguage,
  showToast,
  onGoToPlans,
  onStartTrial,
  hasUsedTrial = false
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);

  // New states for geolocation and multiple sources (Rule 2)
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<'message' | 'csv' | 'budget' | 'connected'>('message');
  
  // Budget source states
  const [budgetClientName, setBudgetClientName] = useState<string>('');
  const [budgetAmount, setBudgetAmount] = useState<string>('');
  const [budgetDetails, setBudgetDetails] = useState<string>('');

  // Form State - ZERO fake placeholder defaults
  const [formData, setFormData] = useState<OnboardingData>({
    name: initialData?.name || userName || '',
    category: initialData?.category || initialData?.niche || 'hvac',
    niche: initialData?.niche || initialData?.category || 'hvac',
    subNiche: initialData?.subNiche || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    country: initialData?.country || (language === 'es' ? 'ES' : 'US'),
    phone: initialData?.phone || '',
    email: initialData?.email || userEmail || '',
    gmbLink: initialData?.gmbLink || '',
    marketRadius: initialData?.marketRadius || 5,
    lat: initialData?.lat,
    lng: initialData?.lng
  });

  // Geolocation reverse-lookup function using Nominatim OSM Proxy (Rule 1: Cuba/Habana or any works)
  const handleDetectLocation = (silent: boolean = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!silent && showToast) {
        showToast(t("La geolocalización no está soportada.", "Geolocation is not supported."), "error");
      }
      return;
    }

    if (!silent) setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/nominatim?endpoint=reverse&format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json() as any;
            const address = data.address || {};
            const detectedCity = address.city || address.town || address.village || address.hamlet || address.municipality || address.county || address.state || '';
            const detectedState = address.state || '';
            const detectedCountry = address.country_code ? address.country_code.toUpperCase() : '';

            setFormData(prev => ({
              ...prev,
              city: detectedCity || prev.city,
              state: detectedState || prev.state,
              country: detectedCountry || prev.country,
              lat: latitude,
              lng: longitude
            }));

            if (!silent && showToast && detectedCity) {
              showToast(t(`Ubicación detectada: ${detectedCity}`, `Location detected: ${detectedCity}`), "success");
            }
          }
        } catch (err) {
          console.warn("Silent reverse geocoding failed:", err);
        } finally {
          if (!silent) setIsDetectingLocation(false);
        }
      },
      (err) => {
        if (!silent) {
          setIsDetectingLocation(false);
          if (showToast) {
            showToast(t("No se pudo obtener la ubicación o permiso denegado.", "Could not retrieve location or permission denied."), "info");
          }
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Step 2 & 3 state
  const [commercialContext, setCommercialContext] = useState<ProspectCommercialContext | null>(null);
  const [isScanningMarket, setIsScanningMarket] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    trustScore: TrustScore;
    gaps: MarketGap[];
    actions: any[];
    bveltMoment: {
      happening: string;
      whyItMatters: string;
      opportunity: string;
      nextAction: string;
    };
    competitorCount: number;
  } | null>(null);

  // New Client Message Flow State
  const [messageText, setMessageText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [analyzingMessage, setAnalyzingMessage] = useState<boolean>(false);

  const getSampleMessage = (category: string): string => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('landscap') || cat.includes('lawn') || cat.includes('jard')) {
      return t(
        "Hola! Necesito presupuesto para cortar el césped de mi jardín delantero y trasero. Está bastante alto porque estuve de viaje, y también hay que recortar unos arbustos. ¿Cuándo podrían venir?",
        "Hi! I need a quote for mowing my front and back lawn. It is pretty high because I was traveling, and some bushes also need trimming. When could you come over?"
      );
    }
    if (cat.includes('pool') || cat.includes('pisc')) {
      return t(
        "Buenas, quería saber el precio del mantenimiento mensual de mi piscina. Tiene filtro de arena pero el agua se está poniendo algo verde y necesita limpieza profunda ahora mismo. Gracias.",
        "Hello, I wanted to know the price for monthly maintenance of my pool. It has a sand filter but the water is starting to turn a bit green and needs a deep clean right now. Thanks."
      );
    }
    if (cat.includes('clean') || cat.includes('limp')) {
      return t(
        "Hola, me gustaría cotizar una limpieza profunda de una casa de 3 habitaciones y 2 baños para este viernes por la mañana. Es para entrega de alquiler por lo que debe quedar impecable. ¿Tienen disponibilidad?",
        "Hi, I would like to get a quote for a deep cleaning of a 3-bedroom, 2-bathroom house for this Friday morning. It is for a rental handover so it needs to be spotless. Do you have availability?"
      );
    }
    if (cat.includes('plumb') || cat.includes('font') || cat.includes('plom')) {
      return t(
        "Hola, tengo una fuga de agua en el fregadero de la cocina que está goteando bastante. Necesito un fontanero que venga urgente a repararlo hoy mismo si es posible. ¿Cuánto cobran por la visita?",
        "Hello, I have a water leak under the kitchen sink that is dripping quite a bit. I need a plumber to come urgently to repair it today if possible. How much do you charge for the visit?"
      );
    }
    return t(
      "Hola, quería pedir un presupuesto para realizar un servicio en mi casa esta semana. ¿Tienen libre algún día para venir a verlo o darme una estimación de precio?",
      "Hi, I wanted to ask for a quote to perform a service at my house this week. Do you have any free day to come see it or give me a price estimate?"
    );
  };

  // Synchronize initial email/name when prop updates
  useEffect(() => {
    if (userEmail && !formData.email) {
      setFormData(prev => ({ ...prev, email: userEmail }));
    }
  }, [userEmail]);

  useEffect(() => {
    if (isOpen) {
      // Refresh context based on initial or current category
      const resolved = IndustryResolver.resolveDeepNiche(
        `${formData.category} ${formData.subNiche || ''}`,
        formData.city
      );
      if (resolved.subNiche && !formData.subNiche) {
        setFormData(prev => ({ ...prev, subNiche: resolved.subNiche }));
      }
      // Auto-detect browser location silently if not set
      if (!formData.city) {
        handleDetectLocation(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateStep1 = (): boolean => {
    let valid = true;
    setEmailError(null);
    setNameError(null);
    setCityError(null);

    const cleanName = formData.name.trim();
    if (!cleanName || cleanName.toLowerCase() === 'local business' || cleanName.toLowerCase() === 'mi negocio') {
      setNameError(t("Por favor introduce el nombre real de tu negocio.", "Please enter the real name of your business."));
      valid = false;
    }

    const cleanEmail = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail) {
      setEmailError(t("El correo electrónico es obligatorio para completar el onboarding de Bvelt.", "Email is required to complete Bvelt onboarding."));
      valid = false;
    } else if (!emailRegex.test(cleanEmail)) {
      setEmailError(t("Por favor introduce un formato de correo válido (ej. contacto@negocio.com).", "Please enter a valid email address format (e.g. contact@business.com)."));
      valid = false;
    }

    const cleanCity = formData.city.trim();
    if (!cleanCity) {
      setCityError(t("La ciudad es obligatoria para calcular tu radio de mercado.", "City is required to compute your local market radius."));
      valid = false;
    }

    return valid;
  };

  const runBackgroundScan = async () => {
    try {
      const bScan = await executeBusinessScan({
        businessName: formData.name,
        city: formData.city,
        state: formData.state,
        niche: formData.category
      });
      const realCompetitors = bScan.competitors || [];
      const ratingEv = bScan.evidences?.['rating'] || Object.values(bScan.evidences || {}).find((e: any) => e?.field === 'rating');
      const reviewEv = bScan.evidences?.['reviewsCount'] || bScan.evidences?.['reviewCount'] || Object.values(bScan.evidences || {}).find((e: any) => e?.field === 'reviewsCount' || e?.field === 'reviewCount');
      const detectedRating = (ratingEv as any)?.value ? Number((ratingEv as any).value) : null;
      const detectedReviewsCount = (reviewEv as any)?.value ? Number((reviewEv as any).value) : null;

      const trustScore = BveltTrustLayer.calculateMarketOpportunityScore({
        hasWebsite: Boolean(bScan.identity.website),
        rating: detectedRating,
        reviewCount: detectedReviewsCount,
        competitorCount: realCompetitors.length > 0 ? realCompetitors.length : null,
        city: formData.city,
        niche: formData.category
      });

      const gaps = MarketReferenceEngine.detectMarketGaps(
        {
          businessName: formData.name,
          niche: formData.category,
          city: formData.city,
          rating: detectedRating ?? undefined,
          reviewCount: detectedReviewsCount ?? undefined,
          website: bScan.identity.website ?? undefined,
          hasWebsite: Boolean(bScan.identity.website)
        },
        realCompetitors,
        language === 'en' ? 'en' : 'es'
      );

      localStorage.setItem('bvelt_cached_competitors', JSON.stringify(realCompetitors));
      localStorage.setItem('bvelt_latest_business_scan', JSON.stringify(bScan));
      localStorage.setItem('bvelt_first_win_ready', 'true');
    } catch (e) {
      console.warn("[OnboardingWizard] Background scan failed silently, fallback is fine:", e);
    }
  };

  const handleNextToStep2 = () => {
    if (!validateStep1()) return;

    // Resolve market context using IndustryResolver
    const ctx = IndustryResolver.buildCommercialContext({
      businessName: formData.name,
      category: formData.category,
      city: formData.city
    });

    const deepNiche = IndustryResolver.resolveDeepNiche(
      `${formData.category} ${formData.subNiche || ''}`,
      formData.city
    );

    setCommercialContext(ctx);
    if (deepNiche.subNiche && !formData.subNiche) {
      setFormData(prev => ({ ...prev, subNiche: deepNiche.subNiche }));
    }

    // Pre-fill client message based on resolved category/trade
    setMessageText(getSampleMessage(formData.category));
    runBackgroundScan();
    setCurrentStep(2);
    trackBveltEvent('onboarding_step_2_viewed', { niche: formData.category, location: formData.city });
  };

  const handleAnalyzeMessage = async () => {
    if (!messageText.trim()) {
      if (showToast) showToast(t("Por favor introduce un mensaje de cliente para analizar.", "Please enter a client message to analyze."), "error");
      return;
    }

    setAnalyzingMessage(true);
    setCurrentStep(3);
    try {
      const locationContext = formData.city ? (language === 'en' ? `in ${formData.city}` : `en ${formData.city}`) : '';
      const promptText = language === 'en'
        ? `Analyze this incoming client message for a "${formData.category}" local business ${locationContext}:
"${messageText}"

Provide a brief diagnosis and draft a professional, persuasive response: <150 words, ready for WhatsApp/SMS, with a CTA to schedule/visit, without inventing fixed prices if the profile does not have them.`
        : `Analiza detalladamente este mensaje de cliente entrante para un servicio o negocio de tipo "${formData.category}" (oficio local) ${locationContext ? 'ubicado en ' + locationContext : ''}:
"${messageText}"

Proporciona un diagnóstico rápido del problema o servicio solicitado y redacta una respuesta comercial profesional, extremadamente persuasiva: respuesta <150 palabras, lista para WhatsApp, con CTA de agendar/visitar, sin inventar precios fijos si el profile no tiene.
Responde de forma limpia con un texto amigable y que contenga la respuesta lista.`;

      const systemInstruction = language === 'en'
        ? `You are an elite sales assistant and business operations expert for local service companies. Your goal is to convert inquiries into paid jobs instantly. Requirements: response <150 words, ready for WhatsApp, with a CTA to schedule/visit, without inventing fixed prices if the profile does not provide them.`
        : `Eres un asistente de ventas de élite y experto de operaciones comerciales para negocios locales. Tu objetivo es convertir consultas en trabajos pagados al instante. Exige: respuesta <150 palabras, lista para WhatsApp, con CTA de agendar/visitar, sin inventar precios fijos si el profile no tiene.`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptText,
          systemInstruction,
          taskType: 'diagnosis_rewrite'
        })
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json() as any;
      setAnalysisResult(data.text || t("Error al analizar el mensaje.", "Failed to analyze message."));
      trackBveltEvent('onboarding_message_analyzed' as any, { niche: formData.category, location: formData.city });
      try {
        const curCount = parseInt(localStorage.getItem('bvelt_successful_analyzes') || '0', 10);
        localStorage.setItem('bvelt_successful_analyzes', (curCount + 1).toString());
      } catch (e) {}
      notifyOwner({
        event: 'analyze_message_success',
        emailOrUid: formData.email || auth?.currentUser?.email || auth?.currentUser?.uid,
        details: { niche: formData.category, location: formData.city }
      });
      recordBveltEvent({
        uid: auth?.currentUser?.uid || formData.email,
        type: 'analyze_message_success',
        trade: formData.category,
        city: formData.city,
        meta: { source: 'onboarding', clientMessageLength: messageText?.length }
      });
    } catch (err) {
      console.error("[OnboardingWizard] Message analysis error:", err);
      if (showToast) showToast(t("Error al conectar con la IA. Se usará una plantilla de respuesta estándar.", "Connection error with AI. Falling back to a standard template."), "error");
      
      // Fallback response draft
      const isEn = language === 'en';
      setAnalysisResult(
        isEn
          ? `Thanks for reaching out! I'd be happy to help with your request. Let's schedule a quick call or visit to confirm details and provide an accurate estimate. What time works best for you?`
          : `¡Hola! Gracias por contactarnos. Con gusto podemos ayudarte con tu solicitud. ¿Te vendría bien agendar una llamada breve o una visita rápida hoy para revisar los detalles y darte un presupuesto exacto?`
      );
      try {
        const curCount = parseInt(localStorage.getItem('bvelt_successful_analyzes') || '0', 10);
        localStorage.setItem('bvelt_successful_analyzes', (curCount + 1).toString());
      } catch (e) {}
      notifyOwner({
        event: 'analyze_message_success',
        emailOrUid: formData.email || auth?.currentUser?.email || auth?.currentUser?.uid,
        details: { niche: formData.category, location: formData.city, fallbackUsed: true }
      });
    } finally {
      setAnalyzingMessage(false);
    }
  };

  const handleNextToStep3 = async () => {
    // Deprecated in favor of direct handleAnalyzeMessage step transition
  };

  const handleFinishOnboarding = async (deepLinkAction?: { targetTab?: string; taskCode?: string; action?: any }) => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const completionData = {
        ...formData,
        clientMessage: messageText || '',
        draftResponse: analysisResult || '',
        leadSource: selectedSource,
        leadDetails: {
          clientName: selectedSource === 'budget' ? budgetClientName : '',
          amount: selectedSource === 'budget' ? budgetAmount : '',
          details: selectedSource === 'budget' ? budgetDetails : ''
        }
      };
      await onComplete(completionData, deepLinkAction);
      trackBveltEvent('onboarding_completed', {
        niche: formData.category,
        location: formData.city,
        source: deepLinkAction?.targetTab || 'dashboard'
      });
      notifyOwner({
        event: 'signup_or_trial',
        emailOrUid: formData.email || auth?.currentUser?.email || auth?.currentUser?.uid,
        details: { name: formData.name, niche: formData.category, city: formData.city }
      });

      // Passively initialize Business DNA profile on onboarding completion
      const uid = auth?.currentUser?.uid || formData.email || 'current_user';
      BusinessDnaService.recordUserAccess(uid, { force: true });

      if (showToast) {
        showToast(t("¡Bienvenido a Bvelt! Configuración completada.", "Welcome to Bvelt! Setup completed."), 'success');
      }
    } catch (err: any) {
      console.error("[OnboardingWizard] Completion error:", err);
      if (showToast) {
        showToast(err.message || t("Error al guardar la configuración del negocio.", "Error saving business setup."), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
      >
        {/* Header with Steps Tracker */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-sm tracking-wider shadow-md">
                BV
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight leading-none text-white">
                  {t("Configuración de Negocio", "Business Onboarding")}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t("Conecta tu perfil con el motor de crecimiento de Bvelt", "Connect your profile with Bvelt's growth engine")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {setLanguage && (
                <div className="inline-flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5 text-[10px] font-black shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      localStorage.setItem('lf_lang', 'en');
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('es');
                      localStorage.setItem('lf_lang', 'es');
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      language === 'es'
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ES
                  </button>
                </div>
              )}
              {onClose && (
                <button 
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title={t("Cerrar", "Close")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
            <div className={`flex items-center gap-2 pb-1 border-b-2 transition ${currentStep >= 1 ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                1
              </div>
              <span className="text-[11px] font-bold truncate">
                {t("Negocio", "Business")}
              </span>
            </div>

            <div className={`flex items-center gap-2 pb-1 border-b-2 transition ${currentStep >= 2 ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                2
              </div>
              <span className="text-[11px] font-bold truncate">
                {t("Ciudad / Zona", "Location / Zone")}
              </span>
            </div>

            <div className={`flex items-center gap-2 pb-1 border-b-2 transition ${currentStep >= 3 ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                3
              </div>
              <span className="text-[11px] font-bold truncate">
                {t("Tu Acción de Hoy", "Your Action Today")}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          <AnimatePresence mode="wait">
            {/* STEP 1: BUSINESS PROFILE */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    {t("Paso 1 de 3 — Información de Negocio", "Step 1 of 3 — Business Info")}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {t("Cuéntale a Bvelt sobre tu negocio", "Tell Bvelt about your business")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("Confirmaremos los datos de tu empresa para calibrar la inteligencia local y las alertas comerciales.", "We will confirm your business details to calibrate local intelligence and sales alerts.")}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Business Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t("Nombre Comercial del Negocio", "Business Name")} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          if (nameError) setNameError(null);
                        }}
                        placeholder={t("Ej. Fontanería y Reformas García", "e.g. Garcia Plumbing & Heating")}
                        className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${nameError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none`}
                      />
                    </div>
                    {nameError && <p className="text-[11px] text-rose-500 font-semibold mt-1">{nameError}</p>}
                  </div>

                  {/* Category / Niche Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TypeaheadInput
                      label={t("Oficio / Sector Principal", "Primary Trade / Sector")}
                      value={formData.category}
                      onChange={(cat) => {
                        const resolved = IndustryResolver.resolveDeepNiche(cat, formData.city);
                        setFormData({
                          ...formData,
                          category: cat,
                          niche: cat,
                          subNiche: resolved.subNiche || ''
                        });
                      }}
                      suggestions={getTradeSuggestions(formData.category)}
                      placeholder={t("Ej. HVAC, Fontanería", "e.g. HVAC, Plumbing")}
                      icon={<Briefcase size={16} />}
                    />

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Especialidad / Sub-Nicho (Opcional)", "Specialty / Sub-Niche (Optional)")}
                      </label>
                      <input
                        type="text"
                        value={formData.subNiche}
                        onChange={(e) => setFormData({ ...formData, subNiche: e.target.value })}
                        placeholder={t("Ej. Desatascos 24h, Bombas de Calor, Cuadros", "e.g. 24h Emergency, Heat Pumps")}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Location (City, Address, Country) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          {t("Ciudad", "City")} <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDetectLocation(false)}
                          disabled={isDetectingLocation}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 bg-transparent border-none cursor-pointer disabled:opacity-50"
                        >
                          {isDetectingLocation ? (
                            <span className="animate-pulse">{t("Buscando...", "Detecting...")}</span>
                          ) : (
                            <>
                              <Compass size={11} />
                              <span>{t("Auto-detectar", "Auto-detect")}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <TypeaheadInput
                        label=""
                        value={formData.city}
                        onChange={(city) => setFormData({ ...formData, city })}
                        suggestions={getCitySuggestions(formData.city)}
                        placeholder={t("Ej. Miami", "e.g. Miami")}
                        icon={<MapPin size={14} />}
                      />
                      {cityError && <p className="text-[10px] text-rose-500 font-semibold mt-1">{cityError}</p>}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Dirección Comercial", "Street Address")}
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder={t("Calle / Avda, Número", "Street address")}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Optional Google Maps / GBP Link */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t("Enlace o Perfil de Google Maps (Opcional)", "Google Maps Link or Profile (Optional)")}
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="url"
                        value={formData.gmbLink || ''}
                        onChange={(e) => setFormData({ ...formData, gmbLink: e.target.value })}
                        placeholder={t("https://maps.google.com/?cid=... o nombre en Maps", "https://maps.google.com/?cid=... or Maps place")}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Phone & Mandatory Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Teléfono Comercial", "Business Phone")}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder={t("Ej. +34 612 345 678", "e.g. +1 (555) 000-0000")}
                          className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t("Correo Electrónico", "Email Address")} <span className="text-rose-500">* (Obligatorio)</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (emailError) setEmailError(null);
                          }}
                          placeholder={t("contacto@tu-negocio.com", "contact@your-business.com")}
                          className={`w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border ${emailError ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none`}
                        />
                      </div>
                      {emailError && <p className="text-[10px] text-rose-500 font-semibold mt-1">{emailError}</p>}
                    </div>
                  </div>
                </div>

                {/* Email requirement note */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    {t(
                      "El correo electrónico es estrictamente obligatorio para sincronizar alertas de oportunidades, reportes de visibilidad y acceso Pro seguro.",
                      "Email is strictly mandatory to sync opportunity alerts, visibility reports and secure Pro access."
                    )}
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 2: PASTE CLIENT MESSAGE / MULTIPLE SOURCES */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    {t("Paso 2 de 3 — Tu Primer Cliente", "Step 2 of 3 — Your First Customer")}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {t("Selecciona tu fuente de datos", "Select your data source")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("Bvelt necesita al menos un prospecto o trabajo inicial para calibrar tu motor de ventas.", "Bvelt needs at least one initial prospect or job to calibrate your sales engine.")}
                  </p>
                </div>

                {/* Source Selection Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('message')}
                    className={`px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${selectedSource === 'message' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    💬 {t("Mensaje", "Message")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('csv')}
                    className={`px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${selectedSource === 'csv' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    📄 {t("Subir CSV", "Upload CSV")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('budget')}
                    className={`px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${selectedSource === 'budget' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    💰 {t("Presupuesto", "Estimate")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSource('connected');
                      // Load connected sample or gaps
                      setMessageText(t(
                        `Oportunidad detectada en ${formData.city || 'tu zona'}: Tu competidor directo tiene reseñas desatendidas. Puedes capturar clientes insatisfechos ofreciendo una garantía del oficio de ${formData.category}.`,
                        `Opportunity spotted in ${formData.city || 'your area'}: Your direct competitor has unresponded reviews. Capture unhappy clients by offering ${formData.category} guarantee.`
                      ));
                    }}
                    className={`px-3 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${selectedSource === 'connected' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    🔗 {t("Conectados", "Connected")}
                  </button>
                </div>

                {/* Tab content rendering */}
                <div className="space-y-4">
                  {selectedSource === 'message' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t("Mensaje de WhatsApp, SMS o Email", "Incoming WhatsApp, SMS, or Email Message")}
                      </label>
                      <textarea
                        rows={4}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={t("Pega el texto del cliente aquí...", "Paste the client's text here...")}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setMessageText(getSampleMessage(formData.category))}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
                        >
                          <Sparkles size={12} />
                          {t("Cargar ejemplo del sector", "Load industry sample")}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedSource === 'csv' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        {t("Sube tu archivo CSV de prospectos", "Upload your prospect CSV file")}
                      </label>
                      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center space-y-2">
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const text = event.target?.result as string;
                                if (text) {
                                  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                                  if (lines.length > 0) {
                                    setMessageText(lines[0]);
                                    if (showToast) showToast(t("¡Archivo CSV cargado e importado con éxito!", "CSV file loaded and imported successfully!"), "success");
                                  }
                                }
                              };
                              reader.readAsText(file);
                            }
                          }}
                          className="hidden"
                          id="csv-file-input"
                        />
                        <label
                          htmlFor="csv-file-input"
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition inline-block border border-slate-200 dark:border-slate-700"
                        >
                          {t("Seleccionar archivo CSV", "Select CSV file")}
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t("Soporta archivos de texto con nombres, correos o números separados por comas.", "Supports plain text files with names, emails or numbers separated by commas.")}
                        </p>
                      </div>
                      {messageText && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                          <strong>{t("Fila cargada:", "Loaded Row:")}</strong> {messageText}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSource === 'budget' && (
                    <div className="space-y-3 text-left">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t("Nombre del Cliente", "Client Name")}
                          </label>
                          <input
                            type="text"
                            value={budgetClientName}
                            onChange={(e) => {
                              setBudgetClientName(e.target.value);
                              setMessageText(`Seguimiento de presupuesto pendiente para ${e.target.value}. Detalle: ${budgetDetails || 'Sin detalles'}. Importe estimado: $${budgetAmount || '0'}`);
                            }}
                            placeholder="Ej. Juan Pérez"
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t("Presupuesto Estimado ($)", "Estimated Budget ($)")}
                          </label>
                          <input
                            type="number"
                            value={budgetAmount}
                            onChange={(e) => {
                              setBudgetAmount(e.target.value);
                              setMessageText(`Seguimiento de presupuesto pendiente para ${budgetClientName || 'Cliente'}. Detalle: ${budgetDetails || 'Sin detalles'}. Importe estimado: $${e.target.value || '0'}`);
                            }}
                            placeholder="Ej. 350"
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t("Detalles del Servicio", "Service Details")}
                        </label>
                        <textarea
                          rows={2}
                          value={budgetDetails}
                          onChange={(e) => {
                            setBudgetDetails(e.target.value);
                            setMessageText(`Seguimiento de presupuesto pendiente para ${budgetClientName || 'Cliente'}. Detalle: ${e.target.value}. Importe estimado: $${budgetAmount || '0'}`);
                          }}
                          placeholder={t("Ej. Mantenimiento y desatasco urgente", "e.g. Maintenance and emergency unclogging")}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {selectedSource === 'connected' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            {t("Google Business Profile Conectado", "Google Business Profile Connected")}
                          </h4>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                            {t(
                              "Bvelt ha analizado de manera autónoma los competidores y ha extraído una oportunidad competitiva basada en tu visibilidad en mapas locales.",
                              "Bvelt has autonomously analyzed competitors and extracted a competitive opportunity based on your local map visibility."
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic font-medium leading-relaxed">
                        "{messageText}"
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                    <Zap size={14} />
                    {t("Conversión al Instante", "Instant Conversion")}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t(
                      "Nuestra IA comercial responderá el mensaje con técnicas de venta consultiva para cerrar el trabajo hoy mismo.",
                      "Our sales AI will answer the message using consultative selling techniques to close the deal today."
                    )}
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 3: FIRST VALUE (TU ACCIÓN DE HOY) */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    {t("Paso 3 de 3 — Tu Respuesta Lista", "Step 3 of 3 — Your Ready Response")}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {t("Respuesta redactada para cerrar el trabajo", "Response drafted to close the job")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("Copia el texto o envíalo directamente por WhatsApp a tu cliente potencial.", "Copy the text or send it directly via WhatsApp to your prospective client.")}
                  </p>
                </div>

                {analyzingMessage ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t("Analizando mensaje y redactando respuesta con IA...", "Analyzing message and drafting response with AI...")}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {t("Aplicando técnicas de cierre de ventas acelerado...", "Applying accelerated sales closing techniques...")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Analysis Draft Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 relative">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <MessageSquare size={12} />
                          {t("BORRADOR SUGERIDO", "SUGGESTED DRAFT")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed">
                        {analysisResult}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(analysisResult);
                            if (showToast) showToast(t("¡Borrador copiado al portapapeles!", "Draft copied to clipboard!"), "success");
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Copy size={13} />
                          {t("Copiar borrador", "Copy draft")}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const phoneMatch = messageText.match(/(\+?\d[\d\s\-().]{7,}\d)/);
                            const targetPhone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : (formData.phone ? formData.phone.replace(/\D/g, '') : '');
                            if (targetPhone && targetPhone.length >= 7) {
                              window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(analysisResult)}`, '_blank', 'noopener,noreferrer');
                            } else {
                              navigator.clipboard.writeText(analysisResult);
                              if (showToast) showToast(t("¡Borrador copiado! No se detectó teléfono en el mensaje para abrir directo.", "Draft copied! No phone number detected in message to open directly."), "info");
                            }
                          }}
                          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Phone size={13} />
                          {t("Enviar por WhatsApp", "Send via WhatsApp")}
                        </button>
                      </div>
                    </div>

                    {/* Pro Upgrade Block */}
                    <div className="p-5 bg-gradient-to-tr from-amber-500/15 via-indigo-500/10 to-amber-500/15 border-2 border-amber-500/40 rounded-2xl shadow-sm text-left space-y-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                          <Zap size={20} className="fill-current" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                            {t("Pro is $49/mo", "Pro is $49/mo")}
                          </h4>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                            {t(
                              "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
                              "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {t(
                              "Desbloquea escaneos profundos de mapas ilimitados, prospectos automáticos calificados en tu radio y asistentes de venta integrados.",
                              "Unlock unlimited deep map scans, automated qualified prospects in your radius, and built-in sales assistants."
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onGoToPlans) onGoToPlans();
                          else if (onStartTrial) onStartTrial();
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Sparkles size={14} className="text-amber-300" />
                        <span>{t("Activar Pro ($49/mes)", "Upgrade to Pro ($49/mo)")}</span>
                        <ArrowRight size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFinishOnboarding({ targetTab: 'dashboard' })}
                        className="w-full py-1 text-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition underline cursor-pointer"
                      >
                        {t("Continuar al dashboard", "Continue to dashboard")}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <ArrowLeft size={14} />
              {t("Atrás", "Back")}
            </button>
          ) : (
            <div />
          )}

          {currentStep === 1 && (
            <button
              onClick={handleNextToStep2}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-indigo-500/25 min-h-[44px]"
            >
              <span>{t("Continuar al Mensaje", "Continue to Message")}</span>
              <ArrowRight size={14} />
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={handleAnalyzeMessage}
              disabled={analyzingMessage}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-indigo-500/25 min-h-[44px] disabled:opacity-50"
            >
              {analyzingMessage ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t("Analizando...", "Analyzing...")}</span>
                </>
              ) : (
                <>
                  <span>{t("Analizar Mensaje con IA", "Analyze Message with AI")}</span>
                  <Sparkles size={14} />
                </>
              )}
            </button>
          )}

          {currentStep === 3 && (
            <button
              type="button"
              onClick={() => handleFinishOnboarding({ targetTab: 'dashboard' })}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t("Guardando...", "Saving...")}</span>
                </div>
              ) : (
                <>
                  <span>{t("Continuar al Dashboard", "Continue to Dashboard")}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
