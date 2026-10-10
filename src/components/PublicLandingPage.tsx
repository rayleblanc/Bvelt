import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle, 
  TrendingUp, 
  Target, 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Search, 
  Sparkles, 
  Star, 
  Award, 
  Phone, 
  MapPin, 
  MessageSquare, 
  Share2, 
  Globe, 
  Lock, 
  BarChart3, 
  ChevronRight, 
  DollarSign,
  AlertTriangle,
  Layers,
  Clock,
  Compass
} from 'lucide-react';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { FreeMarketCheckModal } from './dashboard/FreeMarketCheckModal';

interface FAQItem {
  question: string;
  answer: string;
}

interface WebsiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  description: string;
  features: string[];
  keyFeatures?: Array<{ title: string; description?: string }>;
  services?: string[];
  hours?: string;
  faq?: FAQItem[];
  photos?: string[];
  showReviews?: boolean;
  themeColor: string;
  accentColor?: string;
  published: boolean;
  lastUpdated: string;
  siteLanguage?: string;
  serviceArea?: string;
  phone?: string;
  email?: string;
  ctaLabel?: string;
  hideBveltBadge?: boolean;
}

interface Profile {
  name: string;
  category: string;
  location: string;
  phone: string;
  gmbLink: string;
  googleVerified?: boolean;
  reviews?: any[];
  syncedReviews?: any[];
  googleReviews?: any[];
  reviewsList?: any[];
  telephone?: string;
  email?: string;
  niche?: string;
  city?: string;
}

interface PublicLandingPageProps {
  businessId?: string;
  db?: any;
  isFirebaseReady?: boolean;
  language: 'es' | 'en';
  setLanguage?: (lang: 'es' | 'en') => void;
  t: (es: string, en: string) => string;
  onGetStarted?: (bizData: { name: string; location: string; category: string }) => void;
  onLoginWithGoogle?: () => void;
  onExploreDemo?: () => void;
}

export function PublicLandingPage({ 
  businessId, 
  db, 
  isFirebaseReady, 
  language, 
  setLanguage,
  t,
  onGetStarted,
  onLoginWithGoogle,
  onExploreDemo
}: PublicLandingPageProps) {
  // Contractor Microsite State (if businessId exists)
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(businessId));
  const [notFound, setNotFound] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', contact: '', message: '', website_url: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [resolvedUid, setResolvedUid] = useState<string>(businessId || '');

  // SaaS Audit Interactive Form State
  const [bizName, setBizName] = useState('');
  const [bizCity, setBizCity] = useState('');
  const [bizNiche, setBizNiche] = useState('HVAC & Cooling');
  const [selectedResultTab, setSelectedResultTab] = useState<'opportunity' | 'actions' | 'evidence'>('opportunity');
  const [isFreeMarketCheckOpen, setIsFreeMarketCheckOpen] = useState(false);

  // SaaS Opportunities Hero State
  const [oppTrade, setOppTrade] = useState('Plumbing');
  const [oppZip, setOppZip] = useState('');
  const [oppLoading, setOppLoading] = useState(false);
  const [opportunitiesResult, setOpportunitiesResult] = useState<any[] | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleFetchOpportunities = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppTrade || !oppZip) return;
    setOppLoading(true);
    setOpportunitiesResult(null);
    setEmailSubmitted(false);
    try {
      const res = await fetch(`/api/opportunities?trade=${encodeURIComponent(oppTrade)}&zip=${encodeURIComponent(oppZip)}`);
      const data = (await res.json()) as any;
      setOpportunitiesResult(data.opportunities || []);
    } catch (err) {
      console.error("Error fetching opportunities:", err);
      setOpportunitiesResult([]);
    } finally {
      setOppLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    setEmailSubmitted(true);
    try {
      if (db) {
        await addDoc(collection(db, 'opportunity_subscribers'), {
          email: userEmail,
          trade: oppTrade,
          zip: oppZip,
          createdAt: new Date().toISOString()
        });
      }
    } catch {}
  };

  // Dynamic SEO & Meta Tags Management
  useEffect(() => {
    if (businessId && (profile || config)) {
      const bizDisplayName = profile?.name || config?.heroTitle || humanizeSlug(businessId);
      const bizCategory = profile?.category || 'Servicios Profesionales';
      const bizLocation = profile?.location || '';
      const pageTitle = bizLocation ? `${bizDisplayName} | ${bizCategory} en ${bizLocation}` : `${bizDisplayName} | ${bizCategory}`;
      const pageDesc = config?.heroSubtitle || config?.description || `Página oficial y contacto directo de ${bizDisplayName}. Solicita presupuestos sin compromiso.`;

      document.title = pageTitle;

      // Meta Description
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', pageDesc);

      // Open Graph Tags
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
      ogDesc.setAttribute('content', pageDesc);

      // Canonical URL
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', window.location.href);

      // Robots Meta Tag for Demo
      const cleanBizId = businessId.toLowerCase().trim();
      if (cleanBizId === 'demo-lawn-care') {
        let metaRobots = document.querySelector('meta[name="robots"]');
        if (!metaRobots) {
          metaRobots = document.createElement('meta');
          metaRobots.setAttribute('name', 'robots');
          document.head.appendChild(metaRobots);
        }
        metaRobots.setAttribute('content', 'noindex');
      }
    }
  }, [businessId, profile, config]);

  useEffect(() => {
    if (businessId) {
      loadContractorData();
    } else {
      setLoading(false);
    }
  }, [businessId, isFirebaseReady, db]);

  const humanizeSlug = (slug: string): string => {
    if (!slug) return 'Servicios Profesionales';
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  };

  const loadContractorData = async () => {
    if (!businessId) return;
    setLoading(true);
    setNotFound(false);

    const cleanId = businessId.toLowerCase().trim();

    // 1. Built-in Demo & Reference Cases
    if (cleanId === 'ekorosales-s-gardens') {
      const demoProfile: Profile = {
        name: "EkoRosales's Gardens",
        category: 'Landscaping & Garden Design',
        location: 'Naples, FL',
        phone: '(239) 555-0144',
        whatsapp: '+12395550144',
        email: 'contacto@ekorosales.com',
        gmbLink: 'https://maps.google.com'
      };
      const demoConfig: WebsiteConfig = {
        heroTitle: "EkoRosales's Gardens",
        heroSubtitle: 'Diseño paisajístico profesional, mantenimiento de jardines y ecología urbana en Naples, FL.',
        description: 'Especialistas en paisajismo sostenible, instalación de césped, sistemas de riego y mantenimiento integral para crear espacios verdes excepcionales.',
        services: [
          'Diseño y Paisajismo',
          'Mantenimiento de Césped',
          'Sistemas de Riego Inteligente',
          'Poda y Cuidado de Árboles'
        ],
        phone: '(239) 555-0144',
        whatsapp: '+12395550144',
        email: 'contacto@ekorosales.com',
        serviceArea: 'Naples, FL',
        ctaLabel: 'Solicitar Presupuesto Gratuito',
        themeColor: '#059669',
        published: true,
        lastUpdated: new Date().toISOString()
      };
      setProfile(demoProfile);
      setConfig(demoConfig);
      setResolvedUid('ekorosales_uid');
      setLoading(false);
      return;
    }

    if (cleanId === 'demo-lawn-care') {
      const demoProfile: Profile = {
        name: 'S. Mendoza Complete Lawn Care',
        category: 'Landscaping & Tree Care',
        location: 'Naples, FL',
        phone: '(239) 555-0198',
        whatsapp: '+12395550198',
        email: 'contacto@mendozalawn.com',
        gmbLink: 'https://maps.google.com'
      };
      const demoConfig: WebsiteConfig = {
        heroTitle: 'S. Mendoza Complete Lawn Care',
        heroSubtitle: 'Mantenimiento integral de jardines, diseño paisajístico y poda especializada en Naples, FL.',
        description: 'Empresa familiar con más de 12 años de experiencia ofreciendo soluciones de máxima calidad para propiedades residenciales y comerciales.',
        services: [
          'Mantenimiento de Césped',
          'Diseño Paisajístico',
          'Poda de Árboles',
          'Instalación de Riego'
        ],
        phone: '(239) 555-0198',
        whatsapp: '+12395550198',
        email: 'contacto@mendozalawn.com',
        serviceArea: 'Naples, FL',
        ctaLabel: 'Solicitar Presupuesto Gratuito',
        themeColor: '#059669',
        published: true,
        lastUpdated: new Date().toISOString()
      };
      setProfile(demoProfile);
      setConfig(demoConfig);
      setResolvedUid('demo_mendoza_uid');
      setLoading(false);
      return;
    }

    try {
      let uidToUse = cleanId;
      let foundConfig: WebsiteConfig | null = null;
      let foundProfile: Profile | null = null;

      // 2. Query Firestore if available
      if (db) {
        try {
          // Check slugs mapping collection first
          const slugRef = doc(db, 'slugs', cleanId);
          const slugSnap = await getDoc(slugRef);
          if (slugSnap.exists()) {
            const slugData = slugSnap.data();
            if (slugData && slugData.ownerUid) {
              uidToUse = slugData.ownerUid;
            }
          }
        } catch (err) {
          console.warn("Could not check slugs collection, checking direct document ID:", err);
        }

        setResolvedUid(uidToUse);

        // Fetch website config & profile in parallel
        try {
          const configRef = doc(db, 'websites', uidToUse);
          const profileRef = doc(db, 'profiles', uidToUse);
          
          const [configSnap, profileSnap] = await Promise.all([
            getDoc(configRef).catch(() => null),
            getDoc(profileRef).catch(() => null)
          ]);

          if (configSnap && configSnap.exists()) {
            foundConfig = configSnap.data() as WebsiteConfig;
          }
          
          if (profileSnap && profileSnap.exists()) {
            foundProfile = profileSnap.data() as Profile;
          }
        } catch (fetchErr) {
          console.warn("Error reading from Firestore:", fetchErr);
        }
      }

      // 3. Check LocalStorage fallback (for local previews/active session)
      if (!foundConfig) {
        try {
          const localWeb = localStorage.getItem(`website_config_${uidToUse}`) || localStorage.getItem(`website_config_${cleanId}`);
          if (localWeb) {
            foundConfig = JSON.parse(localWeb);
          }
        } catch (e) {}
      }

      if (!foundProfile) {
        try {
          const localProf = localStorage.getItem('lf_profile');
          if (localProf) {
            const parsedProf = JSON.parse(localProf);
            if (parsedProf && (parsedProf.id === uidToUse || parsedProf.uid === uidToUse || parsedProf.slug === cleanId)) {
              foundProfile = parsedProf;
            }
          }
        } catch (e) {}
      }

      // 4. Safe Synthesis & Fallback Strategy
      if (foundConfig || foundProfile) {
        const finalProfile: Profile = foundProfile || {
          name: foundConfig?.heroTitle || humanizeSlug(cleanId),
          category: 'Servicios Locales',
          location: '',
          phone: '',
          gmbLink: ''
        };

        const finalConfig: WebsiteConfig = foundConfig || {
          heroTitle: finalProfile.name,
          heroSubtitle: `Servicio profesional y de confianza en ${finalProfile.location || 'tu zona'}.`,
          description: `${finalProfile.name} ofrece atención especializada en ${finalProfile.category}. Compromiso, calidad y rapidez en cada proyecto.`,
          features: [],
          themeColor: '#4f46e5',
          published: true,
          lastUpdated: new Date().toISOString()
        };

        setProfile(finalProfile);
        setConfig(finalConfig);
      } else if (cleanId.length >= 3 && cleanId.includes('-')) {
        // If it's a readable slug format, synthesize graceful default business page
        const synthName = humanizeSlug(cleanId);
        const synthProfile: Profile = {
          name: synthName,
          category: 'Servicios Profesionales',
          location: '',
          phone: '',
          gmbLink: ''
        };
        const synthConfig: WebsiteConfig = {
          heroTitle: synthName,
          heroSubtitle: 'Servicios profesionales de alta calidad con garantía y atención personalizada.',
          description: `Bienvenido a la página oficial de ${synthName}. Contáctanos para recibir atención directa y solicitar tu presupuesto.`,
          features: [],
          themeColor: '#4f46e5',
          published: true,
          lastUpdated: new Date().toISOString()
        };
        setProfile(synthProfile);
        setConfig(synthConfig);
      } else {
        // Business truly does not exist
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error loading contractor public page data:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadSubmit = async (e: any) => {
    e.preventDefault();
    if (!resolvedUid) return;

    // Honeypot check
    if (leadForm.website_url && leadForm.website_url.trim().length > 0) {
      setFormStatus('success');
      setLeadForm({ name: '', contact: '', message: '', website_url: '' });
      return;
    }

    setFormStatus('sending');
    const contactValue = (leadForm.contact || '').trim();
    const isEmail = contactValue.includes('@');
    const leadName = (leadForm.name || '').trim();
    const leadMsg = (leadForm.message || '').trim();

    try {
      if (db) {
        const leadPayload: any = {
          userId: resolvedUid,
          contractorId: resolvedUid,
          name: leadName,
          text: `Consulta web de ${leadName}: "${leadMsg}"`,
          source: 'website',
          sourceDetail: 'Public Web Page',
          date: new Date().toLocaleDateString(),
          urgency: 'Media',
          size: 'Medio',
          createdAt: new Date().toISOString()
        };

        if (isEmail) {
          leadPayload.email = contactValue;
        } else {
          leadPayload.phone = contactValue;
        }

        await addDoc(collection(db, 'leads'), leadPayload);
      }

      setFormStatus('success');
      setLeadForm({ name: '', contact: '', message: '', website_url: '' });

      // Notify asynchronously without awaiting or showing errors to visitor
      fetch('/api/lead-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: businessId || '',
          name: leadName,
          contact: contactValue,
          message: leadMsg
        })
      }).catch(() => {});
    } catch (err) {
      console.error("Error saving lead from public page:", err);
      setFormStatus('error');
    }
  };

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFreeMarketCheckOpen(true);
  };

  // ==========================================
  // CASE 1A: Loading State for Contractor Page
  // ==========================================
  if (businessId && loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">
          {language === 'es' ? 'Cargando información del negocio...' : 'Loading business page...'}
        </p>
      </div>
    );
  }

  // ==========================================
  // CASE 1B: Not Found State for Invalid Slug
  // ==========================================
  if (businessId && notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl md:text-3xl font-black mb-3">
          {language === 'es' ? 'Página de Negocio No Encontrada' : 'Business Page Not Found'}
        </h1>
        <p className="text-slate-400 text-sm max-w-md mb-8">
          {language === 'es'
            ? `No encontramos un sitio público registrado para "${businessId}". Verifica el enlace o contacta directamente al negocio.`
            : `We could not find a registered public business page for "${businessId}". Please verify the URL or contact the owner.`}
        </p>
        <a
          href="/"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2"
        >
          <span>{language === 'es' ? 'Ir al Inicio de Bvelt' : 'Go to Bvelt Home'}</span>
          <ArrowRight size={14} />
        </a>
      </div>
    );
  }

  // ==========================================
  // CASE 1C: Individual Contractor Microsite
  // ==========================================
  if (businessId && (config || profile)) {
    const siteLang = config?.siteLanguage || (profile as any)?.language || (profile as any)?.locale || (language === 'en' ? 'en' : 'es');
    const ts = (esStr: string, enStr: string) => siteLang === 'en' ? enStr : esStr;

    const primaryColor = config?.accentColor || config?.themeColor || '#16a34a';
    const bizDisplayName = profile?.name || config?.heroTitle || humanizeSlug(businessId);
    const bizCategory = profile?.category || profile?.niche || (siteLang === 'en' ? 'Professional Services' : 'Servicios Profesionales');
    const bizLocation = config?.serviceArea || profile?.location || profile?.city || '';
    const bizPhone = config?.phone || profile?.phone || profile?.telephone || '';
    const bizEmail = config?.email || profile?.email || '';
    const heroTitle = config?.heroTitle || bizDisplayName;
    const heroSubtitle = config?.heroSubtitle || (siteLang === 'en' ? `Professional guaranteed service in ${bizLocation || 'your local area'}.` : `Servicio profesional y garantizado en ${bizLocation || 'tu localidad'}.`);
    const description = config?.description || (siteLang === 'en' ? `We are dedicated specialists committed to excellence, prompt communication, and total client satisfaction on every job.` : `Somos especialistas comprometidos con la excelencia, puntualidad y satisfacción en cada trabajo.`);
    const ctaButtonText = config?.ctaLabel || ts("Solicitar Presupuesto Gratuito", "Get a Free Quote");

    const distinctDefaultDescriptions = [
      ts('Soluciones a medida para cada cliente con asesoramiento técnico especializado.', 'Tailored solutions for every client with specialized technical guidance.'),
      ts('Atención ágil en tu zona con cotizaciones claras y comunicación directa.', 'Prompt local availability with clear estimates and direct communication.'),
      ts('Compromiso riguroso con los más altos estándares de calidad y profesionalismo.', 'Rigorous commitment to the highest trade standards and professionalism.')
    ];

    const isDemo = businessId?.toLowerCase().trim() === 'demo-lawn-care';

    // Compute reviews
    const allReviewsList: any[] = [
      ...(profile?.syncedReviews || []),
      ...(profile?.googleReviews || []),
      ...(profile?.reviewsList || []),
      ...(profile?.reviews || [])
    ];
    
    // Deduplicate and filter 4-5 star reviews
    const uniqueReviewTexts = new Set();
    const validReviews = allReviewsList.filter(r => {
      const rating = r.rating || r.stars || 0;
      const text = (r.text || r.comment || '').trim();
      if (rating >= 4 && text.length > 0 && !uniqueReviewTexts.has(text)) {
        uniqueReviewTexts.add(text);
        return true;
      }
      return false;
    });

    const hasServices = Boolean(config?.services && config.services.filter(s => s.trim().length > 0).length > 0);
    const hasPhotos = Boolean(config?.photos && config.photos.filter(p => p.trim().length > 0).length > 0);
    const hasReviews = Boolean(config?.showReviews && validReviews.length >= 3);
    const hasFaq = Boolean(config?.faq && config.faq.filter(f => f.question.trim().length > 0 && f.answer.trim().length > 0).length > 0);
    const hasHours = Boolean(config?.hours && config.hours.trim().length > 0);

    const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([bizDisplayName, bizLocation].filter(Boolean).join(' '))}`;

    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-indigo-500/25 flex flex-col justify-between pb-28 lg:pb-16" style={{ '--brand': primaryColor } as any}>
        {isDemo && (
          <div className="w-full bg-indigo-600 text-white text-xs sm:text-sm font-bold py-2.5 px-4 text-center">
            Ejemplo de página creada con Bvelt
          </div>
        )}

        {/* 1) Encabezado fijo con anclas (Servicios, Reseñas, Contacto) y botón de llamar */}
        <nav className="w-full bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 px-6 py-4">
          <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-md text-lg shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {bizDisplayName.charAt(0)}
              </div>
              <div>
                <span className="font-extrabold text-base sm:text-lg tracking-tight block text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-xs">{bizDisplayName}</span>
                {bizLocation && (
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{bizLocation}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              {hasServices && (
                <a href="#services-section" className="hover:text-slate-900 transition hidden sm:inline">{ts("Servicios", "Services")}</a>
              )}
              {hasReviews && (
                <a href="#reviews-section" className="hover:text-slate-900 transition hidden sm:inline">{ts("Reseñas", "Reviews")}</a>
              )}
              <a href="#contact-section" className="hover:text-slate-900 transition hidden sm:inline">{ts("Contacto", "Contact")}</a>

              {bizPhone && (
                <a 
                  href={`tel:${bizPhone}`}
                  className="px-4 py-2 rounded-full font-black text-xs text-white shadow-md transition hover:opacity-90 flex items-center gap-1.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Phone size={13} />
                  <span className="hidden sm:inline">{bizPhone}</span>
                  <span className="sm:hidden">{ts("Llamar", "Call")}</span>
                </a>
              )}
            </div>
          </div>
        </nav>

        <main className="flex-1">
          {/* 2) Hero con degradado del themeColor, o la primera foto con capa oscura si existe photos[0], con dos botones */}
          <section 
            className="relative pt-16 pb-20 overflow-hidden text-center"
            style={
              hasPhotos && config?.photos?.[0]
                ? {
                    backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.85)), url(${config.photos[0]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#ffffff'
                  }
                : {
                    background: `linear-gradient(135deg, ${primaryColor}12 0%, #ffffff 100%)`
                  }
            }
          >
            <div className="max-w-[1100px] mx-auto px-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider mb-6 border border-slate-200 dark:border-slate-700">
                <ShieldCheck size={14} style={{ color: primaryColor }} />
                <span>{bizCategory} {bizLocation ? `• ${bizLocation}` : ''}</span>
              </div>

              <h1 className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6 ${hasPhotos && config?.photos?.[0] ? 'text-white' : 'text-slate-900'}`}>
                {heroTitle}
              </h1>

              <p className={`text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal ${hasPhotos && config?.photos?.[0] ? 'text-slate-200' : 'text-slate-600'}`}>
                {heroSubtitle}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-white text-sm shadow-xl transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>{ctaButtonText}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* New Feature/Pillar Cards Section */}
          {config?.keyFeatures && config.keyFeatures.length > 0 && (
            <section className="py-12 bg-white">
              <div className="max-w-[1100px] mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {config.keyFeatures.slice(0, 3).map((feat, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                        <Star size={20} />
                      </div>
                      <h3 className="font-black text-slate-900 text-lg mb-2">{feat.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{feat.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Sticky CTA */}
          {bizPhone && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-50 lg:hidden flex justify-center">
                <a
                  href={`tel:${bizPhone}`}
                  className="w-full max-w-sm px-6 py-3 rounded-2xl font-black text-white text-sm shadow-lg transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Phone size={16} />
                  <span>{ts("Llamar ahora", "Call now")}</span>
                </a>
            </div>
          )}


          {/* 3) "Servicios" en cuadrícula */}
          {hasServices && (
            <section id="services-section" className="py-16 bg-slate-50 border-y border-slate-200/60">
              <div className="max-w-[1100px] mx-auto px-6">
                <div className="text-center mb-10">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {ts("Nuestros Servicios", "Our Services")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">
                    {ts("Soluciones Profesionales", "Professional Solutions")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {config?.services?.filter(s => s.trim().length > 0).map((serviceName, idx) => (
                    <div 
                      key={idx}
                      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center gap-3.5 text-left"
                    >
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <CheckCircle size={18} />
                      </div>
                      <span className="font-extrabold text-slate-900 text-sm">{serviceName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 4) "Cómo trabajamos" en 3 pasos neutrales */}
          <section className="py-16 max-w-[1100px] mx-auto px-6">
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                {ts("Proceso Sencillo", "Simple Process")}
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">
                {ts("Cómo trabajamos", "How We Work")}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 relative">
                <span className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center mb-4" style={{ backgroundColor: primaryColor }}>1</span>
                <h3 className="font-black text-slate-900 text-base mb-2">{ts("Cuéntanos qué necesitas", "Tell us what you need")}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {ts("Envía tu consulta o contáctanos directamente para detallar los requerimientos de tu proyecto.", "Send your inquiry or contact us directly to detail your project requirements.")}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 relative">
                <span className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center mb-4" style={{ backgroundColor: primaryColor }}>2</span>
                <h3 className="font-black text-slate-900 text-base mb-2">{ts("Te damos un presupuesto", "We give you a quote")}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {ts("Evaluamos la solicitud y te entregamos una cotización clara, transparente y sin compromiso.", "We evaluate your request and deliver a clear, transparent estimate with no commitment.")}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 relative">
                <span className="w-8 h-8 rounded-full text-white text-xs font-black flex items-center justify-center mb-4" style={{ backgroundColor: primaryColor }}>3</span>
                <h3 className="font-black text-slate-900 text-base mb-2">{ts("Agendamos el trabajo", "We schedule the job")}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {ts("Coordinamos la fecha y hora conveniente para realizar el servicio con máxima puntualidad.", "We coordinate a convenient date and time to perform the service promptly.")}
                </p>
              </div>
            </div>
          </section>

          {/* 5) "Galería" si hay fotos */}
          {hasPhotos && (
            <section id="gallery-section" className="py-16 bg-slate-50 border-y border-slate-200/60">
              <div className="max-w-[1100px] mx-auto px-6">
                <div className="text-center mb-10">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {ts("Galería de Proyectos", "Photo Gallery")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">
                    {ts("Nuestros Trabajos Recientes", "Recent Work")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {config?.photos?.filter(p => p.trim().length > 0).map((photoUrl, idx) => (
                    <div key={idx} className="rounded-2xl overflow-hidden border border-slate-200 aspect-video shadow-xs bg-slate-100">
                      <img 
                        src={photoUrl} 
                        alt={`Proyecto ${idx + 1}`} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 6) "Reseñas" solo si showReviews es true y hay al menos 3 reseñas reales de 4-5 estrellas */}
          {hasReviews && (
            <section id="reviews-section" className="py-16 max-w-[1100px] mx-auto px-6">
              <div className="text-center mb-10">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {ts("Opiniones de Clientes", "Client Reviews")}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">
                  {ts("Lo que dicen nuestros clientes", "What Our Clients Say")}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {validReviews.slice(0, 6).map((rev, idx) => {
                  const authorName = rev.name || rev.author || rev.author_name || ts('Cliente Satisfecho', 'Satisfied Client');
                  const firstInitial = authorName.charAt(0).toUpperCase();
                  const ratingVal = Math.min(5, Math.max(4, rev.rating || rev.stars || 5));
                  const reviewText = rev.text || rev.comment || '';

                  return (
                    <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4 text-left">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: ratingVal }).map((_, i) => (
                            <Star key={i} size={16} className="fill-amber-500" />
                          ))}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          "{reviewText}"
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-slate-200/60">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {firstInitial}
                        </div>
                        <span className="text-xs font-extrabold text-slate-800 truncate">{authorName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 7) "Preguntas frecuentes" si hay faq */}
          {hasFaq && (
            <section className="py-16 bg-slate-50 border-y border-slate-200/60">
              <div className="max-w-[1100px] mx-auto px-6">
                <div className="text-center mb-10">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {ts("Dudas Comunes", "FAQ")}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">
                    {ts("Preguntas Frecuentes", "Frequently Asked Questions")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto text-left">
                  {config?.faq?.filter(f => f.question.trim().length > 0 && f.answer.trim().length > 0).map((f, idx) => (
                    <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-2">
                      <h3 className="font-extrabold text-slate-900 text-sm">{f.question}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 8) Zona de servicio, horario y enlace "Cómo llegar" */}
          {(bizLocation || hasHours) && (
            <section className="py-16 max-w-[1100px] mx-auto px-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs text-left grid grid-cols-1 md:grid-cols-3 gap-6">
                {bizLocation && (
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">{ts("Zona de Servicio", "Service Area")}</span>
                    <p className="text-sm font-extrabold text-slate-800">{bizLocation}</p>
                  </div>
                )}

                {hasHours && (
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">{ts("Horario de Atención", "Business Hours")}</span>
                    <p className="text-sm font-extrabold text-slate-800">{config?.hours}</p>
                  </div>
                )}

                <div className="flex items-center md:justify-end">
                  <a
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-800 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    <MapPin size={14} style={{ color: primaryColor }} />
                    <span>{ts("Cómo llegar", "Get Directions")}</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* About Description */}
          {description && (
            <section className="py-12 max-w-[1100px] mx-auto px-6">
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-left space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">{ts("Sobre El Negocio", "About The Business")}</span>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{description}</p>
                {profile?.gmbLink && (
                  <a
                    href={profile.gmbLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold underline inline-flex items-center gap-1 hover:opacity-80"
                    style={{ color: primaryColor }}
                  >
                    <span>{profile?.googleVerified === true ? ts("Verificado en Google Maps", "Verified on Google Maps") : ts("Ver en Google Maps", "View on Google Maps")}</span>
                    <ArrowRight size={13} />
                  </a>
                )}
              </div>
            </section>
          )}

          {/* 9) Formulario de contacto */}
          <section id="contact-section" className="py-20 bg-slate-950 text-white">
            <div className="max-w-2xl mx-auto px-6 text-center">
              <span className="inline-block px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400 mb-4">
                {ts("Atención Directa", "Direct Contact")}
              </span>
              <h2 className="text-3xl md:text-4xl font-black mb-3">
                {ts("Solicita Tu Presupuesto", "Request Your Free Quote")}
              </h2>
              <p className="text-slate-400 text-xs max-w-md mx-auto mb-8">
                {ts("Envíanos los detalles de tu proyecto y nos pondremos en contacto contigo a la brevedad.", "Send us your project details and we will get back to you promptly.")}
              </p>

              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-left shadow-2xl">
                {formStatus === 'error' ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-base font-black text-white">
                      {ts("No pudimos enviar tu solicitud. Llámanos o escríbenos directamente", "We could not send your request. Call or message us directly")}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {bizPhone && (
                        <a
                          href={`tel:${bizPhone}`}
                          className="px-4 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-md transition"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Phone size={14} />
                          <span>{bizPhone}</span>
                        </a>
                      )}
                      {bizPhone && (
                        <a
                          href={`https://wa.me/${bizPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-md transition"
                        >
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <button
                        onClick={() => setFormStatus('idle')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        {ts("Reintentar", "Retry")}
                      </button>
                    </div>
                  </div>
                ) : formStatus === 'success' ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle size={28} />
                    </div>
                    <h3 className="text-lg font-black text-white">{ts("¡Solicitud Recibida con Éxito!", "Request Successfully Sent!")}</h3>
                    <p className="text-xs text-slate-300 max-w-sm mx-auto">
                      {ts("Hemos recibido tu mensaje. Nos comunicaremos contigo lo antes posible.", "We have received your message and will follow up with you shortly.")}
                    </p>
                    <button
                      onClick={() => setFormStatus('idle')}
                      className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer mt-2"
                    >
                      {ts("Enviar otra consulta", "Send another inquiry")}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <input 
                      type="text" 
                      name="website_url" 
                      value={leadForm.website_url || ''} 
                      onChange={(e) => setLeadForm({ ...leadForm, website_url: e.target.value })} 
                      className="hidden" 
                      autoComplete="off" 
                      tabIndex={-1} 
                      aria-hidden="true" 
                    />

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {ts("Tu Nombre Completo", "Your Full Name")} *
                      </label>
                      <input 
                        required
                        type="text" 
                        value={leadForm.name}
                        onChange={(e) => setLeadForm({...leadForm, name: e.target.value})}
                        placeholder={siteLang === 'es' ? "Ej. Juan Pérez" : "E.g. John Doe"}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {ts("Teléfono o correo", "Phone or email")} *
                      </label>
                      <input 
                        required
                        type="text" 
                        value={leadForm.contact}
                        onChange={(e) => setLeadForm({...leadForm, contact: e.target.value})}
                        placeholder={siteLang === 'es' ? "Ej. (555) 000-0000 o correo@ejemplo.com" : "E.g. (555) 000-0000 or email@example.com"}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {ts("Detalles del Trabajo o Consulta", "Project Details / Service Needed")} *
                      </label>
                      <textarea 
                        required
                        value={leadForm.message}
                        onChange={(e) => setLeadForm({...leadForm, message: e.target.value})}
                        placeholder={ts("Describe brevemente el servicio que necesitas...", "Briefly describe the service or estimate you need...")}
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 transition resize-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={formStatus === 'sending'}
                      className="w-full py-3.5 rounded-xl font-black text-white text-xs shadow-xl transition-all hover:opacity-90 cursor-pointer flex items-center justify-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {formStatus === 'sending' ? (
                        <span>{ts("Enviando Solicitud...", "Sending Request...")}</span>
                      ) : (
                        <>
                          <MessageSquare size={14} />
                          <span>{ts("Enviar Solicitud al Negocio", "Send Request to Business")}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>

        {/* Microsite Footer */}
        <footer className="w-full bg-slate-950 border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-500">
          <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-bold text-slate-400">{bizDisplayName}</span> © {new Date().getFullYear()}. {ts("Todos los derechos reservados.", "All rights reserved.")}
            </div>
            <div className="flex items-center gap-4">
              {!config?.hideBveltBadge && (
                <a
                  href={`https://bvelt.app/?ref=${encodeURIComponent(resolvedUid || businessId || 'bvelt')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slate-400 hover:text-indigo-400 transition underline underline-offset-2"
                >
                  Hecho con Bvelt
                </a>
              )}
            </div>
          </div>
        </footer>

        {/* Mobile Fixed Bottom Bar (Llamar, Texto, WhatsApp) */}
        {bizPhone && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 py-3 px-4 shadow-2xl flex items-center justify-center gap-2 sm:hidden">
            {/* Llamar (tel:) */}
            <a
              href={`tel:${bizPhone}`}
              className="flex-1 py-2.5 px-2 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-1 transition active:scale-95 text-center"
              style={{ backgroundColor: primaryColor }}
            >
              <Phone size={13} />
              <span>{ts("Llamar", "Call")}</span>
            </a>

            {/* Texto (sms:) */}
            <a
              href={`sms:${bizPhone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(siteLang === 'es' ? 'Hola, necesito un presupuesto' : 'Hello, I need a quote')}`}
              className="flex-1 py-2.5 px-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white shadow-md flex items-center justify-center gap-1 transition active:scale-95 border border-slate-700 text-center"
            >
              <MessageSquare size={13} />
              <span>{ts("Texto", "SMS")}</span>
            </a>

            {/* WhatsApp (wa.me) */}
            <a
              href={`https://wa.me/${bizPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(siteLang === 'es' ? 'Hola, necesito un presupuesto' : 'Hello, I need a quote')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center justify-center gap-1 transition active:scale-95 text-center"
            >
              <Zap size={13} />
              <span>WhatsApp</span>
            </a>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CASE 2: Phase 3 B2B SaaS Landing Page
  // ==========================================
  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 font-sans antialiased selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* SaaS Sticky Navbar */}
      <nav className="w-full bg-[#080b11]/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">B</span>
            <span className="font-extrabold text-lg tracking-tight text-white">Bvelt <span className="text-indigo-400 font-bold">Suite</span></span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            {setLanguage && (
              <div className="inline-flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px] font-black shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    localStorage.setItem('lf_lang', 'en');
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
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
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    language === 'es'
                      ? 'bg-indigo-600 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ES
                </button>
              </div>
            )}

            {onLoginWithGoogle && (
              <button
                onClick={onLoginWithGoogle}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer shadow-md"
              >
                {t("Iniciar Sesión", "Sign In")}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 1. HERO SECTION (REDESIGNED FOR OPPORTUNITIES) */}
      <header className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
            <Sparkles size={14} />
            <span>{t("Agente Comercial Local", "Local Commercial Growth Agent")}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.08]">
            {t("Encuentra ingresos perdidos.", "Find lost revenue.")}<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
              {t("Recupéralos. Demuéstralo.", "Recover it. Prove it.")}
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {t(
              "Detecta fugas de facturación en tu zona, prioriza las acciones de mayor ROI y recupera ingresos de clientes no atendidos y perfiles incompletos.",
              "Detect local revenue leaks in your service area, prioritize high-ROI growth actions, and recover lost income from unhandled leads and missing profile details."
            )}
          </p>

          <p className="text-xs sm:text-sm font-semibold text-emerald-400 max-w-xl mx-auto">
            {t(
              "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
              "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
            )}
          </p>

          <div id="audit-engine" className="max-w-2xl mx-auto">
            <form onSubmit={handleFetchOpportunities} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row gap-3">
              <div className="flex-1 text-left">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t("Oficio", "Trade")}
                </label>
                <select
                  value={oppTrade}
                  onChange={(e) => setOppTrade(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="Plumbing">Plumbing / Fontanería</option>
                  <option value="HVAC">HVAC & Cooling</option>
                  <option value="Electrical">Electrical / Electricista</option>
                  <option value="Roofing">Roofing & Siding</option>
                  <option value="Landscaping">Landscaping / Jardinería</option>
                  <option value="General Contracting">General Contracting</option>
                  <option value="Cleaning">Cleaning & Restoration</option>
                </select>
              </div>

              <div className="flex-1 text-left">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {t("Código Postal", "Zip Code")}
                </label>
                <input
                  type="text"
                  required
                  value={oppZip}
                  onChange={(e) => setOppZip(e.target.value)}
                  placeholder={t("Ej. 33101", "E.g. 33101")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={oppLoading}
                  className="w-full sm:w-auto py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {oppLoading ? (
                    <span className="animate-pulse">{t("Escaneando...", "Scanning...")}</span>
                  ) : (
                    <span>{t("Escanear Fugas de Ingresos", "Find My Revenue Leaks")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Opportunities Results Display */}
          {opportunitiesResult !== null && (
            <div className="mt-8 space-y-4 text-left max-w-3xl mx-auto animate-in fade-in duration-300">
              {opportunitiesResult.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                  <p className="text-sm font-black text-white">
                    {t("Estamos buscando en tu zona, te avisamos por correo", "We're scanning your area, we'll notify you by email")}
                  </p>
                  {emailSubmitted ? (
                    <p className="text-xs text-emerald-400 font-bold">
                      {t("¡Correo registrado! Te avisaremos cuando haya trabajos en tu zona.", "Email registered! We'll notify you when jobs are available in your area.")}
                    </p>
                  ) : (
                    <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                      <input
                        type="email"
                        required
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder={t("Tu correo electrónico", "Your email address")}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        {t("Avisarme", "Notify Me")}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {t("Trabajos Encontrados Esta Semana", "Jobs Found This Week")} ({opportunitiesResult.length})
                    </h3>
                    <span className="text-xs text-indigo-400 font-bold">
                      {t("Mostrando los 3 primeros", "Showing top 3")}
                    </span>
                  </div>

                  {/* First 3 Real Opportunities */}
                  <div className="space-y-3">
                    {opportunitiesResult.slice(0, 3).map((opp: any, idx: number) => (
                      <div key={opp.id || idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                            {opp.status || 'Open'} • {opp.budget || '$200 - $500'}
                          </span>
                          <span className="text-xs text-slate-400">{opp.postedTime || 'Recently'}</span>
                        </div>
                        <h4 className="text-base font-black text-white">{opp.title}</h4>
                        <p className="text-xs text-slate-300">{opp.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                          <span>📍 {opp.location}</span>
                          <span>👤 {opp.customerName}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Remaining Blurred Opportunities + Email Capture */}
                  {opportunitiesResult.length > 3 && (
                    <div className="relative pt-2">
                      <div className="space-y-3 filter blur-sm select-none opacity-50 pointer-events-none">
                        {opportunitiesResult.slice(3, 6).map((opp: any, idx: number) => (
                          <div key={opp.id || idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black">
                                {opp.budget || '$300'}
                              </span>
                              <span className="text-xs text-slate-400">{opp.postedTime}</span>
                            </div>
                            <h4 className="text-base font-black text-white">{opp.title}</h4>
                            <p className="text-xs text-slate-300">{opp.description}</p>
                          </div>
                        ))}
                      </div>

                      {/* Overlay Notice & Email Capture */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-indigo-500/30 text-center space-y-3">
                        <p className="text-base font-black text-white">
                          {t("Te enviamos el resto por correo", "We'll send you the rest by email")}
                        </p>
                        {emailSubmitted ? (
                          <p className="text-xs text-emerald-400 font-bold">
                            {t("¡Enviado! Revisa tu bandeja de entrada.", "Sent! Check your inbox.")}
                          </p>
                        ) : (
                          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                            <input
                              type="email"
                              required
                              value={userEmail}
                              onChange={(e) => setUserEmail(e.target.value)}
                              placeholder={t("Tu correo electrónico", "Your email address")}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                            />
                            <button
                              type="submit"
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              {t("Recibir Todo", "Get All Jobs")}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 2. PROBLEM SECTION (THE HIDDEN REVENUE LEAK) */}
      <section className="py-20 bg-[#0c1017] border-y border-slate-800/80 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-[11px] font-black uppercase tracking-widest text-rose-400 bg-rose-950/40 border border-rose-500/20 px-3.5 py-1 rounded-full">
              {t("La Realidad del Mercado Local", "The Local Market Dilemma")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {language === 'es' 
                ? '¿Por qué tantos negocios locales cualificados pierden contratos frente a competidores con peor reputación?'
                : 'Why Great Local Contractors Lose High-Paying Jobs to Competitors with Weaker Reputations'}
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              {language === 'es'
                ? 'El algoritmo de Google Maps no premia al que trabaja más duro: premia la velocidad de respuesta, las reseñas recientes de clientes y la consistencia de tu perfil.'
                : 'Google Maps algorithms don’t reward the hardest worker: they reward fast response times, recent customer reviews, and clear verified service profiles.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-black text-white">
                {t("1. Servicios No Listados en Tu Perfil", "1. Missing Services on Your Profile")}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t(
                  "Tus competidores aparecen en búsquedas específicas (ej. 'Reparación de Emergencia', 'Mantenimiento Preventivo') porque tú nunca las añadiste a tu ficha.",
                  "Competitors capture high-intent calls in specific service categories (e.g. 'Emergency AC Repair', 'Commercial Flat Roofs') that your profile is currently missing."
                )}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock size={24} />
              </div>
              <h3 className="text-lg font-black text-white">
                {t("2. Falta de Reseñas Recientes", "2. Missing Recent Reviews")}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t(
                  "Tener 4.9 estrellas no sirve si tu última opinión fue hace semanas. Los clientes llaman al negocio que tiene opiniones frescas y fotos de trabajos de esta semana.",
                  "A 4.9 rating isn't enough if your last review was weeks ago. Homeowners call the business with fresh feedback and recent job photos from this week."
                )}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-lg font-black text-white">
                {t("3. Respuestas Genéricas a Reseñas", "3. Generic Review Responses")}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t(
                  "Responder simplemente 'Gracias por su preferencia' desperdicia la oportunidad de confirmar el trabajo realizado y generar confianza inmediata en futuros clientes.",
                  "Generic 'Thank you' replies waste the chance to confirm the exact job completed and build instant trust with homeowners reading your reviews."
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (THE BVELT FRAMEWORK: DETECT -> DECIDE -> EXECUTE) */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-3.5 py-1 rounded-full">
              {t("El Método Bvelt", "The Bvelt Execution Engine")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Detect → Decide → Execute
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              {t(
                "Sin dashboards confusos de 50 métricas irrelevantes. Bvelt te dice exactamente qué hacer cada semana con evidencia comprobable.",
                "Zero bloated dashboards with 50 useless vanity metrics. Bvelt tells you exactly what to prioritize every week with verifiable evidence."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1: DETECT */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 relative group hover:border-indigo-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-wider bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-500/30">
                  {t("Paso 01", "Step 01")}
                </span>
                <Search size={22} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">{t("Detectar", "Detect")}</h3>
                <p className="text-xs font-bold text-indigo-300 mb-3 uppercase tracking-wider">
                  {t("Diagnóstico de Mercado en Tiempo Real", "Real-Time Market Intelligence")}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t(
                    "El motor escanea tu ciudad, nicho y competidores clave para identificar tus brechas de posicionamiento y oportunidades de ingresos sin explotar.",
                    "Our engine scans your exact city, trade, and local competitors to pinpoint ranking gaps, review velocity deficits, and untapped revenue channels."
                  )}
                </p>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                <div>✓ {t("Puntos de Referencia Verificados", "Verified Benchmarks")}</div>
                <div>✓ {t("Análisis del 3-Pack de Competencia", "Competitor 3-Pack Analysis")}</div>
                <div>✓ {t("Mapa de Déficit de Búsqueda Local", "Geo-Search Deficit Map")}</div>
              </div>
            </div>

            {/* Step 2: DECIDE */}
            <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-8 space-y-6 relative group shadow-xl shadow-indigo-600/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
                  {t("Paso 02", "Step 02")}
                </span>
                <Target size={22} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">{t("Decidir", "Decide")}</h3>
                <p className="text-xs font-bold text-emerald-300 mb-3 uppercase tracking-wider">
                  {t("Acciones Prioritarias de Alto Impacto", "Prioritized Next Best Actions")}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t(
                    "Calculamos tus siguientes mejores acciones basándonos en retorno estimado y rapidez de cierre, separando hechos verificados de estimaciones.",
                    "We calculate your single most profitable Next Best Action with explicit evidence tiers (Verified Fact vs Estimate) so you never guess."
                  )}
                </p>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                <div>✓ {t("Mayor Impacto Económico", "Highest Economic Impact")}</div>
                <div>✓ {t("Recuperación Directa de Ingresos", "Direct Revenue Recovery")}</div>
                <div>✓ {t("Cero Alucinaciones / Capa de Confianza", "Zero Hallucinations / Trust Layer")}</div>
              </div>
            </div>

            {/* Step 3: EXECUTE */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 relative group hover:border-indigo-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wider bg-purple-950/80 px-3 py-1 rounded-full border border-purple-500/30">
                  {t("Paso 03", "Step 03")}
                </span>
                <Zap size={22} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">{t("Ejecutar", "Execute")}</h3>
                <p className="text-xs font-bold text-purple-300 mb-3 uppercase tracking-wider">
                  {t("Herramientas de Ejecución en 1-Clic", "1-Click Workflow Execution")}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t(
                    "Redacta respuestas a clientes y reseñas, da seguimiento a presupuestos pendientes, envía cotizaciones claras y reactiva contactos en un toque.",
                    "Draft client replies and review responses, follow up on unscheduled quotes, send clear estimates, and reactivate past clients in one tap."
                  )}
                </p>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 font-mono space-y-1">
                <div>✓ {t("Asistente de Respuestas a Reseñas en 1-Clic", "1-Click Review Reply Assistant")}</div>
                <div>✓ {t("Seguimiento de Cotizaciones por WhatsApp/SMS", "Direct WhatsApp/SMS Quote Follow-up")}</div>
                <div>✓ {t("Gestor Móvil de Presupuestos y Contactos", "Mobile Estimate & Job Lead Manager")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SAMPLE RESULT (INTERACTIVE PROOF OF VALUE PREVIEW) */}
      <section className="py-20 bg-[#0a0e16] border-y border-slate-800/80 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1 rounded-full">
              {t("Demostración de Resultados", "Live Sample Intelligence")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {t("Lo que Bvelt revela sobre tu mercado", "What a Real Bvelt Intelligence Report Delivers")}
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              {t(
                "Mira un ejemplo ilustrativo generado para un contratista de HVAC en Austin, TX:",
                "See an illustrative snapshot example for an HVAC & Cooling contractor in Austin, TX:"
              )}
            </p>
          </div>

          {/* Interactive Card Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            {/* Header Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-white">Apex Air Solutions</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">Austin, TX</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    {t("Ejemplo Ilustrativo", "Illustrative Example")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Niche: HVAC & AC Repair • Market Tier: 1 (High Competition)</p>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedResultTab('opportunity')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${selectedResultTab === 'opportunity' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {t("Resumen de Oportunidades", "Opportunity Snapshot")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedResultTab('actions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${selectedResultTab === 'actions' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {t("Cadencia de Acciones (7 Días)", "7-Day Action Cadence")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedResultTab('evidence')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${selectedResultTab === 'evidence' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {t("Evidencia y Confianza", "Evidence & Trust")}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {selectedResultTab === 'opportunity' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                      <Sparkles size={12} />
                      {t("Desbloqueo Clave de Ingresos", "Top Revenue Unlock")}
                    </span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      {t("+$2,400 a $4,800/mes estimado", "+$2,400 to $4,800/mo estimated")}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white mb-1">
                    {t("Optimización de Categoría de Reparación de Aire y Limpieza de Ductos", "Emergency AC Repair & Duct Cleanout Category Optimization")}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t(
                      "Apex Air figura entre los 5 primeros para 'contratista de HVAC', pero pierde 62 consultas mensuales de alta intención en códigos postales suburbanos (78704, 78745) debido a la falta de etiquetas de categorías secundarias y baja velocidad de reseñas (0.4/sem vs 2.8/sem del líder).",
                      "Apex Air ranks in the top 5 for generic 'HVAC contractor', but loses 62 high-intent monthly inquiries in suburban zip codes (78704, 78745) due to missing secondary service category tags and slow review velocity (0.4 reviews/wk vs competitor leader's 2.8/wk)."
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t("Rango en el Mercado", "Current Market Rank")}
                    </span>
                    <div className="text-2xl font-black text-white mt-1">
                      {t("#4 en 3-Pack de Mapas", "#4 in Maps 3-Pack")}
                    </div>
                    <p className="text-[11px] text-amber-400 mt-1">
                      {t("Brecha: 38 reseñas detrás del líder", "Gap: 38 reviews behind market leader")}
                    </p>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t("Tasa de Conversión de Búsqueda", "Search Conversion Rate")}
                    </span>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      {t("+28% Potencial", "+28% Potential")}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t("Con respuestas SEO locales", "With Local SEO keyword replies")}
                    </p>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t("Calidad de Evidencia", "Evidence Quality")}
                    </span>
                    <div className="text-2xl font-black text-indigo-400 mt-1">
                      {t("VERIFICADO", "VERIFIED")}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t("Directo del Índice de Búsqueda Local", "Direct from Local Search Index")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedResultTab === 'actions' && (
              <div className="space-y-3">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black text-xs">
                      D1
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">
                        {t("Añadir Categoría Secundaria: Servicio HVAC de Emergencia", "Add Secondary Category: Emergency HVAC Service")}
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        {t("Toma 3 minutos • Desbloquea impresiones de llamadas nocturnas de emergencia", "Takes 3 minutes • Unlocks emergency night call impressions")}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0">
                    {t("Alto ROI", "High ROI")}
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black text-xs">
                      D3
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">
                        {t("Enviar 4 SMS de Reseña a Clientes de Mantenimiento de Aire", "Dispatch 4 Review SMS to Completed AC Tune-Up Clients")}
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        {t("Usa plantillas predefinidas de alta conversión por WhatsApp/SMS", "Uses pre-written high-converting WhatsApp/SMS templates")}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-indigo-400 bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-500/20 shrink-0">
                    {t("Velocidad", "Velocity")}
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black text-xs">
                      D5
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">
                        {t("Publicar 1 Foto Geolocalizada en Google Business Profile", "Publish 1 Geotagged Project Photo to Google Business Profile")}
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        {t("Asistente integrado de foto a publicación con palabras clave locales", "Built-in photo-to-post assistant with local keyword injection")}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-purple-400 bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-500/20 shrink-0">
                    {t("SEO Visual", "Visual SEO")}
                  </span>
                </div>
              </div>
            )}

            {selectedResultTab === 'evidence' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <h4 className="text-sm font-black text-white">
                    {t("Garantía Estricta de Integridad de Datos Bvelt", "Bvelt Strict Data Integrity Guarantee")}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t(
                    "A diferencia de chatbots genéricos que inventan números de reseñas o métricas falsas, Bvelt segmenta la inteligencia estrictamente en 3 niveles transparentes:",
                    "Unlike generic AI chatbots that hallucinate fake review numbers or made-up competitor metrics, Bvelt strictly segments intelligence into 3 transparent tiers:"
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/30">
                    <span className="text-emerald-400 font-bold uppercase text-[10px] block">
                      {t("Nivel 1: Verificado", "Tier 1: Verified")}
                    </span>
                    <span className="text-slate-300">
                      {t("Registro público, datos en vivo de Google, valoraciones reales y conteo de reseñas.", "Public registry, GMB live data, real ratings & review counts.")}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-indigo-500/30">
                    <span className="text-indigo-400 font-bold uppercase text-[10px] block">
                      {t("Nivel 2: Derivado", "Tier 2: Derived")}
                    </span>
                    <span className="text-slate-300">
                      {t("Velocidad calculada, fórmulas de brechas de categoría y comparativas.", "Calculated velocity, category gap formulas, and rank benchmarks.")}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-amber-500/30">
                    <span className="text-amber-400 font-bold uppercase text-[10px] block">
                      {t("Nivel 3: Estimado", "Tier 3: Estimated")}
                    </span>
                    <span className="text-slate-300">
                      {t("ROI económico proyectado basado en tickets promedio estándar de la industria.", "Projected economic ROI based on US industry standard ticket sizes.")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. WHY BVELT (THE COMPARISON TABLE) */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-3.5 py-1 rounded-full">
              {t("Comparativa Transparente", "Why Contractors Choose Bvelt")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Bvelt vs. Traditional Digital Marketing Agencies
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              {t(
                "¿Por qué pagar miles a una agencia por reportes mensuales en PDF cuando puedes ejecutar optimizaciones en tiempo real?",
                "Why spend $1,500/month on vague agency retainers when you can manage actionable Local SEO in seconds?"
              )}
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60">
                  <th className="p-5 text-slate-400 font-black uppercase tracking-widest text-[11px]">
                    {t("Característica / Capacidad", "FEATURE / CAPABILITY")}
                  </th>
                  <th className="p-5 text-indigo-400 font-black text-sm bg-indigo-950/30">
                    {t("Bvelt ($49/mes)", "Bvelt ($49/mo)")}
                  </th>
                  <th className="p-5 text-slate-400 font-bold text-sm">
                    {t("Agencia SEO Tradicional ($1,500+/mes)", "Traditional SEO Agency ($1,500+/mo)")}
                  </th>
                  <th className="p-5 text-slate-500 font-bold text-sm">
                    {t("Herramientas Genéricas DIY", "Generic DIY Tools")}
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300">
                <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                  <td className="p-5 font-bold text-white">
                    {t("Inversión Mensual", "Monthly Investment")}
                  </td>
                  <td className="p-5 text-emerald-400 font-black text-sm bg-indigo-950/10">
                    {t("$49/mes tarifa plana (Sin contratos)", "$49/mo flat (No contracts)")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("$1,500 – $3,000 / mes", "$1,500 – $3,000 / month")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("$199 – $499 / mes", "$199 – $499 / month")}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                  <td className="p-5 font-bold text-white">
                    {t("Velocidad de Ejecución", "Speed of Execution")}
                  </td>
                  <td className="p-5 text-white font-bold bg-indigo-950/10">
                    {t("Instantánea (Acciones en tiempo real)", "Instant (Real-time actions)")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("2-4 semanas de espera", "2-4 weeks turnarounds")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Configuración manual compleja", "Complex manual setup")}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                  <td className="p-5 font-bold text-white">
                    {t("Motor de Acción (Qué hacer a continuación)", "Action Engine (What to do next)")}
                  </td>
                  <td className="p-5 text-emerald-400 font-bold bg-indigo-950/10">
                    {t("Incluido (Cadencia calculada a 7 días)", "Included (Calculated 7-day cadence)")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Resumen vago mensual en PDF", "Vague monthly PDF summary")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Gráficos confusos sin procesar", "Raw confusing charts")}
                  </td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition">
                  <td className="p-5 font-bold text-white">
                    {t("Respuestas a Reseñas de Google Maps", "Google Maps Review Replies")}
                  </td>
                  <td className="p-5 text-white font-bold bg-indigo-950/10">
                    {t("Respuestas Profesionales Locales en 1-Clic", "1-Click Professional Local Replies")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Manual o ignorado", "Manual or ignored")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Plantillas genéricas no locales", "Generic non-local templates")}
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="p-5 font-bold text-white">
                    {t("Herramientas para Contratistas Integradas", "Built-in Contractor Tools")}
                  </td>
                  <td className="p-5 text-emerald-400 font-bold bg-indigo-950/10">
                    {t("Presupuestos, Facturas, Leads CRM", "Estimates, Invoices, CRM Leads")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Ninguna (Solo SEO)", "None (SEO only)")}
                  </td>
                  <td className="p-5 text-slate-400">
                    {t("Requiere 3 suscripciones separadas", "Requires 3 separate subscriptions")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. TRANSPARENT PRICING */}
      <section className="py-24 bg-[#0a0d14] border-y border-slate-800/80 px-6">
        <div className="max-w-4xl mx-auto space-y-16 text-center">
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1 rounded-full">
              {t("Precios Claros y Transparentes", "Simple & Predictable Pricing")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {t("Sin sorpresas. Sin contratos ocultos.", "One Plan. Everything Included.")}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t(
                "Diseñado para generar un ROI positivo desde el primer cliente captado.",
                "Priced so a single additional service job pays for an entire year of Bvelt."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Monthly Plan */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">
                    {t("Pro Mensual", "Monthly Pro")}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                    {t("Cancela en Cualquier Momento", "Cancel Anytime")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">$49</span>
                  <span className="text-slate-400 text-xs font-bold">{t("/ mes", "/ month")}</span>
                </div>
                <p className="text-xs font-bold text-emerald-400">
                  {t(
                    "Deja de enviar presupuestos que ya iban a perderse. Bvelt verifica la completitud comercial antes de enviar.",
                    "Stop sending quotes that were already going to lose. Bvelt checks completeness before you send."
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {t(
                    "Ideal para contratistas que buscan flexibilidad mensual sin compromisos de permanencia.",
                    "Ideal for contractors wanting monthly flexibility without upfront commitment."
                  )}
                </p>
                <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300 font-medium">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Inteligencia de Mercado y Competencia en Tiempo Real", "Real-Time Market & Competitor Intelligence")}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Motor de Siguiente Mejor Acción (Verificado vs Estimado)", "Next Best Action Engine (Verified vs Estimated)")}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Asistente de Respuestas a Reseñas y Seguimiento (Ilimitado)", "Review Reply & Quote Follow-up Assistant (Unlimited)")}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Presupuestos, Seguimiento a Clientes y Leads CRM", "Estimates, Customer Follow-ups & CRM Leads")}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsFreeMarketCheckOpen(true);
                }}
                className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider transition border border-slate-700/60 cursor-pointer text-center"
              >
                {t("Empezar Prueba de 7 Días", "Start 7-Day Risk-Free Trial")}
              </button>
            </div>

            {/* Annual Plan (Featured) */}
            <div className="bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-8 space-y-6 flex flex-col justify-between relative shadow-2xl shadow-indigo-600/20">
              <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-emerald-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                {t("Mejor Valor • 4 Meses Gratis", "Best Value • 4 Months Free")}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">
                    {t("Pase Pro Anual", "Annual Pro Pass")}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {t("Ahorra $198/año", "Save $198/yr")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">$390</span>
                  <span className="text-slate-400 text-xs font-bold">{t("/ año (Ahorra $198)", "/ year (Save $198)")}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {t(
                    "Todo lo de Pro con el máximo descuento y acceso prioritario.",
                    "Everything in Pro, locked in at the maximum discount with priority roadmap access."
                  )}
                </p>
                <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-200 font-medium">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span className="font-bold">{t("Todo lo incluido en Pro Mensual", "Everything in Monthly Pro")}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Procesamiento Prioritario de Motor y Actualizaciones Instantáneas", "Priority Engine Processing & Instant Refreshes")}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Soporte Dedicado Directo por Correo", "Dedicated Direct Email Support")} (<span className="text-indigo-300">bveltpro@gmail.com</span>)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{t("Constructor de Micrositio Personalizado Incluido", "Custom Contractor Microsite Builder Included")}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  setIsFreeMarketCheckOpen(true);
                }}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 cursor-pointer text-center"
              >
                {t("Reclamar Oferta Anual", "Claim Annual Pro Discount")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA & FOOTER */}
      <footer className="pt-20 pb-12 px-6 border-t border-slate-800/80 bg-[#06080d]">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-900/40 border border-indigo-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {t("Toma el Control de tu Posicionamiento Local Hoy", "Take Control of Your Local Market Today")}
            </h2>
            <p className="text-slate-300 text-sm max-w-xl mx-auto">
              {t(
                "Ingresa el nombre de tu negocio para generar tu primer diagnóstico en menos de 60 segundos.",
                "Enter your business details to generate your first verified competitive report in under 60 seconds."
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button 
                onClick={() => {
                  setIsFreeMarketCheckOpen(true);
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-indigo-600/30 transition cursor-pointer"
              >
                {t("Iniciar Auditoría Gratis", "Start Free Market Audit")}
              </button>
              {onLoginWithGoogle && (
                <button 
                  onClick={onLoginWithGoogle}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition border border-slate-700/60 cursor-pointer"
                >
                  {t("Acceder con Google", "Sign In with Google")}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-800/60 text-xs text-slate-400">
            <div>
              <p className="font-bold text-slate-300">© {new Date().getFullYear()} Bvelt Suite. {t("Todos los derechos reservados.", "All rights reserved.")}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t("Impulsando a contratistas locales y empresas de servicios del hogar.", "Empowering US local contractors and home service businesses.")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
              <a href="/about" className="hover:text-indigo-400 transition">
                {t("Sobre el creador", "About the creator")}
              </a>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition">
                {t("Términos de Servicio", "Terms of Service")}
              </a>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition">
                {t("Política de Privacidad", "Privacy Policy")}
              </a>
              <a href="mailto:bveltpro@gmail.com" className="hover:text-indigo-400 transition flex items-center gap-1">
                {t("Soporte:", "Support:")} <span className="text-slate-300">bveltpro@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Free Market Check Modal (Public Acquisition Engine) */}
      <FreeMarketCheckModal
        isOpen={isFreeMarketCheckOpen}
        onClose={() => setIsFreeMarketCheckOpen(false)}
        t={t}
        language={language}
        initialBusinessName={bizName}
        initialCity={bizCity}
        initialNiche={bizNiche}
        onApplyToBusiness={(data) => {
          if (onGetStarted) {
            onGetStarted({
              name: data.businessName || bizName || 'My Local Business',
              location: data.city || bizCity || 'Austin, TX',
              category: data.niche || bizNiche || 'HVAC & Cooling'
            });
          }
        }}
      />
    </div>
  );
}
