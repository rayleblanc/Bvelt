import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { 
  Globe, Wand2, Eye, Save, Rocket, CheckCircle, ExternalLink, 
  Layout, Palette, Copy, Trash2, Plus, HelpCircle, Phone, Mail, 
  MapPin, Star, ShieldCheck, Sparkles, RefreshCw, QrCode, MessageSquare,
  Clock as ClockIcon, Image, ListChecks, HelpCircle as FaqIcon
} from 'lucide-react';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';

interface FeatureItem {
  title: string;
  description: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface WebsiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  description: string;
  features: string[];
  keyFeatures: FeatureItem[];
  services?: string[];
  hours?: string;
  faq?: FAQItem[];
  photos?: string[];
  showReviews?: boolean;
  phone: string;
  email: string;
  serviceArea: string;
  siteLanguage: 'es' | 'en';
  ctaLabel: string;
  themeColor: string;
  accentColor?: string;
  published: boolean;
  lastUpdated: string;
  slug?: string;
  hideBveltBadge?: boolean;
}

interface WebsiteViewProps {
  profile: any;
  db: any;
  isFirebaseReady: boolean;
  user: any;
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const normalizeSlug = (val: string) => {
  if (!val) return '';
  return val
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9-_]/g, '-') // replace non-alphanumeric with hyphen
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
};

const SWATCH_COLORS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#dc2626' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Slate', hex: '#1e293b' }
];

export function WebsiteView({ profile, db, isFirebaseReady, user, t, language, showToast }: WebsiteViewProps) {
  const [config, setConfig] = useState<WebsiteConfig>({
    heroTitle: '',
    heroSubtitle: '',
    description: '',
    features: [],
    keyFeatures: [],
    phone: '',
    email: '',
    serviceArea: '',
    siteLanguage: 'es',
    ctaLabel: '',
    themeColor: '#4f46e5',
    accentColor: '#4f46e5',
    published: true,
    lastUpdated: new Date().toISOString(),
    slug: ''
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [isFirebaseReady, user, db, profile]);

  const alignWithProfile = (remote: any, defaultConfig: WebsiteConfig): WebsiteConfig => {
    const merged = { ...defaultConfig, ...remote };

    const isPlaceholderTitle = (title?: string) => {
      if (!title) return true;
      const lower = title.toLowerCase().trim();
      return lower.includes('premium services toronto') || 
             lower.includes('your professional business') || 
             lower.includes('tu negocio profesional');
    };

    const isPlaceholderLocation = (loc?: string) => {
      if (!loc) return true;
      const lower = loc.toLowerCase().trim();
      return lower.includes('toronto') || lower.includes('ej.') || lower === 'local area';
    };

    const isPlaceholderPhone = (ph?: string) => {
      if (!ph) return true;
      const lower = ph.toLowerCase().trim();
      return lower.includes('(555)') || lower.includes('555-0000') || lower.includes('000-0000') || lower.includes('ej.');
    };

    const isPlaceholderEmail = (em?: string) => {
      if (!em) return true;
      const lower = em.toLowerCase().trim();
      return lower.includes('contacto@ejemplo.com') || lower.includes('example.com') || lower.includes('minegocio.com') || lower.includes('contacto@minegocio');
    };

    // 1. Prefill Title from Profile name if profile has a real name
    if (profile?.name && (isPlaceholderTitle(merged.heroTitle) || !merged.heroTitle)) {
      merged.heroTitle = profile.name;
    } else if (isPlaceholderTitle(merged.heroTitle)) {
      merged.heroTitle = "";
    }

    // 2. Prefill Service Area from Profile location/city if profile location exists
    const realLoc = profile?.location || profile?.city;
    if (realLoc && (isPlaceholderLocation(merged.serviceArea) || !merged.serviceArea)) {
      merged.serviceArea = realLoc;
    } else if (isPlaceholderLocation(merged.serviceArea)) {
      merged.serviceArea = "";
    }

    // Update heroSubtitle if it has Toronto or placeholder location
    if (realLoc && (merged.heroSubtitle?.toLowerCase().includes('toronto') || !merged.heroSubtitle)) {
      const siteLang = merged.siteLanguage || language || 'es';
      merged.heroSubtitle = [profile?.category || profile?.niche || '', realLoc].filter(Boolean).join(siteLang === 'en' ? ' in ' : ' en ') || (siteLang === 'en' ? 'Quality Professional Services' : 'Servicios Profesionales de Calidad');
    }

    // 3. Prefill Phone from Profile phone/telephone
    const realPhone = profile?.phone || profile?.telephone;
    if (realPhone) {
      merged.phone = realPhone;
    } else if (isPlaceholderPhone(merged.phone)) {
      merged.phone = "";
    }

    // 4. Prefill Email from Profile or User email
    const realEmail = profile?.email || user?.email;
    if (realEmail) {
      merged.email = realEmail;
    } else if (isPlaceholderEmail(merged.email)) {
      merged.email = "";
    }

    // 5. Prefill Description from Profile
    const realDesc = profile?.description || profile?.bio || profile?.about;
    if (realDesc && (!merged.description || merged.description.includes('Your Professional Business'))) {
      merged.description = realDesc;
    }

    // 6. Prefill Language
    const profLang = profile?.language || profile?.locale || language || 'es';
    if (profLang) {
      merged.siteLanguage = profLang === 'en' ? 'en' : 'es';
    }

    // 7. Slug Regenerate if current slug has Toronto and profile indicates Naples/other
    const profileLocStr = profile?.location || profile?.city || '';
    const isProfileToronto = profileLocStr.toLowerCase().includes('toronto');
    const isCurrentSlugToronto = merged.slug && merged.slug.toLowerCase().includes('toronto');

    if (profile?.name && (isCurrentSlugToronto && !isProfileToronto)) {
      merged.slug = normalizeSlug(profile.slug || profile.name);
    } else if (profile?.name && (!merged.slug || merged.slug === 'mi-negocio' || merged.slug === 'premium-services-toronto')) {
      merged.slug = normalizeSlug(profile.slug || profile.name);
    }

    // 8. Ensure Theme & Accent color sync
    const currentColor = merged.accentColor || merged.themeColor || profile?.themeColor || '#4f46e5';
    merged.themeColor = currentColor;
    merged.accentColor = currentColor;

    return merged;
  };

  const loadConfig = async () => {
    const siteLang = profile?.language || profile?.locale || language || 'es';
    const isEn = siteLang === 'en';
    const fallbackSlug = normalizeSlug(profile?.slug || profile?.name || 'mi-negocio');
    
    const servicesList = Array.isArray(profile?.services) && profile.services.length > 0 ? profile.services : [];
    const defaultKeyFeatures: FeatureItem[] = servicesList.length > 0
      ? [
          ...servicesList.slice(0, 3).map((s: string) => ({
            title: s,
            description: isEn ? `Professional and reliable ${s.toLowerCase()} services for your home or business.` : `Servicio profesional y garantizado de ${s.toLowerCase()} para tu hogar o empresa.`
          })),
          {
            title: isEn ? "Satisfaction Guarantee" : "Garantía de Satisfacción",
            description: isEn ? "Rigorous commitment to the highest trade standards and professionalism." : "Compromiso riguroso con los más altos estándares de calidad y profesionalismo."
          }
        ]
      : [
          {
            title: isEn ? "Personalized Attention" : "Atención Personalizada",
            description: isEn ? "Tailored solutions for every client with specialized technical guidance." : "Soluciones a medida para cada cliente con asesoramiento técnico especializado."
          },
          {
            title: isEn ? "Fast & Professional Response" : "Respuesta Rápida y Profesional",
            description: isEn ? "Prompt local availability with clear estimates and direct communication." : "Atención ágil en tu zona con cotizaciones claras y comunicación directa."
          },
          {
            title: isEn ? "Satisfaction Guarantee" : "Garantía de Satisfacción",
            description: isEn ? "Rigorous commitment to the highest trade standards and professionalism." : "Compromiso riguroso con los más altos estándares de calidad y profesionalismo."
          }
        ];

    const defaultConfig: WebsiteConfig = {
      heroTitle: profile?.name || (isEn ? "Your Professional Business" : "Tu Negocio Profesional"),
      heroSubtitle: [profile?.category || profile?.niche || '', profile?.location || profile?.city || ''].filter(Boolean).join(isEn ? ' in ' : ' en ') || (isEn ? "Quality Professional Services" : "Servicios Profesionales de Calidad"),
      description: profile?.description || profile?.bio || profile?.about || (isEn ? "We are committed to excellence, prompt communication, and high-quality results in every project." : "Estamos comprometidos con la excelencia, comunicación ágil y resultados de máxima calidad en cada proyecto."),
      features: servicesList,
      keyFeatures: defaultKeyFeatures,
      phone: profile?.phone || profile?.telephone || "",
      email: profile?.email || user?.email || "",
      serviceArea: profile?.location || profile?.city || "",
      siteLanguage: siteLang === 'en' ? 'en' : 'es',
      ctaLabel: isEn ? "Get a Free Quote" : "Pedir presupuesto gratis",
      themeColor: profile?.themeColor || '#4f46e5',
      accentColor: profile?.themeColor || '#4f46e5',
      published: true,
      lastUpdated: new Date().toISOString(),
      slug: fallbackSlug
    };

    if (!user?.uid || !db) {
      const local = localStorage.getItem('website_config_demo');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setConfig(alignWithProfile(parsed, defaultConfig));
        } catch {
          setConfig(defaultConfig);
        }
      } else {
        setConfig(defaultConfig);
      }
      setLoading(false);
      return;
    }

    const uid = user.uid;
    const docRef = doc(db, 'websites', uid);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as WebsiteConfig;
        const aligned = alignWithProfile(remoteData, defaultConfig);
        setConfig(aligned);
        try {
          localStorage.setItem(`website_config_${uid}`, JSON.stringify(aligned));
        } catch (e) {}
      } else {
        const local = localStorage.getItem(`website_config_${uid}`);
        if (local) {
          const parsed = JSON.parse(local);
          setConfig(alignWithProfile(parsed, defaultConfig));
        } else {
          setConfig(defaultConfig);
        }
      }
    } catch (error) {
      const local = localStorage.getItem(`website_config_${uid}`);
      if (local) {
        try {
          setConfig(alignWithProfile(JSON.parse(local), defaultConfig));
        } catch {
          setConfig(defaultConfig);
        }
      } else {
        setConfig(defaultConfig);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig = config) => {
    const newSlug = normalizeSlug(newConfig.slug || '');
    const activeColor = newConfig.themeColor || newConfig.accentColor || '#4f46e5';
    
    const reservedSlugs = [
      'demo',
      'demo-lawn-care',
      'admin',
      'api',
      'web',
      'app',
      'www',
      'login',
      'bvelt',
      's-mendoza-complete-lawn-care'
    ];

    if (!newSlug || newSlug.length < 3 || reservedSlugs.includes(newSlug)) {
      showToast("Ese enlace no está disponible", "error");
      return;
    }

    const preparedConfig: WebsiteConfig = {
      ...newConfig,
      themeColor: activeColor,
      accentColor: activeColor,
      keyFeatures: newConfig.keyFeatures || [],
      featureCards: newConfig.keyFeatures || [],
      heroTitle: newConfig.heroTitle,
      heroSubtitle: newConfig.heroSubtitle,
      services: newConfig.services,
      phone: newConfig.phone,
      whatsapp: (newConfig as any).whatsapp || '',
      slug: newSlug,
      lastUpdated: new Date().toISOString()
    };

    if (!user?.uid || !db) {
      try {
        localStorage.setItem('website_config_demo', JSON.stringify(preparedConfig));
        localStorage.setItem(`website_config_${newSlug}`, JSON.stringify(preparedConfig));
      } catch (e) {
        console.warn("Error writing to localStorage:", e);
      }
      setConfig(preparedConfig);
      showToast(t("✓ Configuración guardada localmente (Modo Demo)", "✓ Configuration saved locally (Demo Mode)"), "success");
      return;
    }

    const uid = user.uid;
    
    try {
      localStorage.setItem(`website_config_${uid}`, JSON.stringify(preparedConfig));
      localStorage.setItem(`website_config_${newSlug}`, JSON.stringify(preparedConfig));
    } catch (e) {
      console.warn("Error writing to localStorage:", e);
    }

    setSaving(true);
    try {
      const websiteRef = doc(db, 'websites', uid);
      const newSlugRef = doc(db, 'slugs', newSlug);

      await runTransaction(db, async (transaction) => {
        const websiteSnap = await transaction.get(websiteRef);
        const oldSlug = websiteSnap.exists() ? (websiteSnap.data()?.slug || '') : '';

        if (newSlug && newSlug !== oldSlug) {
          const newSlugSnap = await transaction.get(newSlugRef);
          if (newSlugSnap.exists()) {
            const data = newSlugSnap.data();
            if (data && data.ownerUid !== uid) {
              throw new Error("SLUG_ALREADY_EXISTS");
            }
          }
        }

        if (oldSlug && oldSlug !== newSlug) {
          const oldSlugRef = doc(db, 'slugs', oldSlug);
          transaction.delete(oldSlugRef);
        }

        if (newSlug) {
          transaction.set(newSlugRef, { ownerUid: uid });
        }

        transaction.set(websiteRef, preparedConfig, { merge: true });
      });

      setConfig(preparedConfig);
      showToast(t("✓ ¡Configuración y color guardados con éxito!", "✓ Configuration and accent color saved successfully!"), "success");
    } catch (error: any) {
      if (error.message === "SLUG_ALREADY_EXISTS") {
        showToast(t("❌ Este nombre de slug ya está en uso. Elige otro.", "❌ This slug name is already in use. Please choose another."), "error");
      } else {
        try {
          const docRef = doc(db, 'websites', uid);
          await setDoc(docRef, preparedConfig, { merge: true });
          localStorage.setItem(`website_config_${uid}`, JSON.stringify(preparedConfig));
          localStorage.setItem(`website_config_${newSlug}`, JSON.stringify(preparedConfig));
          showToast(t("✓ Configuración guardada (Modo Simple)", "✓ Configuration saved (Simple Mode)"), "success");
        } catch (fallbackError) {
          showToast(t("✓ Configuración guardada localmente", "✓ Configuration saved locally"), "success");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleColorSelect = (hex: string) => {
    const updated = {
      ...config,
      themeColor: hex,
      accentColor: hex
    };
    setConfig(updated);
  };

  const generateWithAi = async () => {
    setGenerating(true);
    try {
      const prompt = language === 'es'
        ? `Genera el contenido para una página web de aterrizaje (landing page) de un negocio. 
      Información del negocio:
      Nombre: ${profile?.name || config.heroTitle}
      Categoría: ${profile?.category || 'Servicios'}
      Ubicación: ${profile?.location || config.serviceArea}

      Responde ÚNICAMENTE con un objeto JSON en este formato:
      {
        "heroTitle": "Un título impactante de max 10 palabras",
        "heroSubtitle": "Un subtítulo persuasivo",
        "description": "Una descripción de 2-3 frases sobre el negocio",
        "features": ["3 beneficios clave del negocio"]
      }
      Idioma: Español`
        : `Generate landing page copy for a business.
      Business Information:
      Name: ${profile?.name || config.heroTitle}
      Category: ${profile?.category || 'Services'}
      Location: ${profile?.location || config.serviceArea}

      Respond ONLY with a JSON object in this format:
      {
        "heroTitle": "An impactful title of max 10 words",
        "heroSubtitle": "A persuasive subtitle",
        "description": "A description of 2-3 sentences about the business",
        "features": ["3 key benefits of the business"]
      }
      Language: English`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const ct = response.headers.get('content-type') || '';
      if (response.ok && ct.includes('application/json')) {
        const data = await response.json().catch(() => ({ text: '' })) as { text?: string };
        if (data.text) {
          const cleanJson = data.text.replace(/```json|```/g, '').trim();
          if (cleanJson.startsWith('{') || cleanJson.startsWith('[')) {
            try {
              const aiConfig = JSON.parse(cleanJson);
              const updatedConfig = { ...config, ...aiConfig };
              setConfig(updatedConfig);
              await saveConfig(updatedConfig);
            } catch (e) {
              console.error("Error parsing AI response JSON:", e);
              showToast(t("Error al procesar la respuesta de la IA.", "Error processing AI response."), "error");
            }
          } else {
            console.error("Invalid AI response format:", cleanJson);
            showToast(t("Formato de respuesta de IA inválido.", "Invalid AI response format."), "error");
          }
        }
      }
    } catch (error) {
      console.error("Error generating with AI:", error);
    } finally {
      setGenerating(false);
    }
  };

  const togglePublish = async () => {
    const newPublished = !config.published;
    const updatedConfig = { ...config, published: newPublished };
    setConfig(updatedConfig);
    await saveConfig(updatedConfig);
  };

  const syncWithProfileNow = () => {
    const siteLang = profile?.language || profile?.locale || language || 'es';
    const isEn = siteLang === 'en';
    const realLoc = profile?.location || profile?.city || config.serviceArea;
    
    const syncedConfig: WebsiteConfig = {
      ...config,
      heroTitle: profile?.name || config.heroTitle,
      heroSubtitle: [profile?.category || profile?.niche || '', realLoc].filter(Boolean).join(isEn ? ' in ' : ' en ') || config.heroSubtitle,
      description: profile?.description || profile?.bio || profile?.about || config.description,
      phone: profile?.phone || profile?.telephone || config.phone,
      email: profile?.email || user?.email || config.email,
      serviceArea: realLoc,
      siteLanguage: isEn ? 'en' : 'es'
    };
    setConfig(syncedConfig);
    showToast(t("✓ Datos sincronizados con el Perfil", "✓ Data synced with Profile"), "info");
  };

  const publicUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}?site=${config.slug || profile?.slug || profile?.id || user?.uid || 'demo-lawn-care'}`
    : '';

  const downloadQR = async () => {
    const targetSlug = config.slug || profile?.slug || 'demo-lawn-care';
    const qrUrl = `https://bvelt.app/web/${targetSlug}`;
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-${targetSlug}.png`;
      a.click();
      showToast(t("✓ Código QR descargado", "✓ QR Code downloaded"), "success");
    } catch (err) {
      console.error("Error generating QR:", err);
      showToast(t("Error al generar QR", "Error generating QR"), "error");
    }
  };

  const activeAccent = config.themeColor || config.accentColor || '#4f46e5';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("Cargando servicios...", "Loading services...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Globe className="text-indigo-600" size={24} />
            {t("Sitio Web del Negocio", "Business Website")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("Administra y publica la presencia online de tu negocio.", "Manage and publish your business presence.")}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            type="button"
            onClick={syncWithProfileNow}
            className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw size={14} />
            {t("Sincronizar Perfil", "Sync Profile")}
          </button>

          <button 
            type="button"
            onClick={() => window.open(publicUrl, '_blank')}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition shadow-sm cursor-pointer"
          >
            <Eye size={16} />
            {t("Visitar Sitio en Vivo", "Visit Live Site")}
          </button>
          
          <button 
            type="button"
            onClick={togglePublish}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black text-white transition shadow-lg cursor-pointer ${config.published ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
          >
            {config.published ? <CheckCircle size={16} /> : <Rocket size={16} />}
            {config.published ? t("Publicada", "Published") : t("Publicar Web", "Publish Web")}
          </button>
        </div>
      </header>

      {/* Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600">
            <Globe size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">{t("Tu web está en vivo", "Your site is live")}</p>
            <p className="text-[10px] text-emerald-600 font-bold truncate max-w-md">{publicUrl}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl || `https://bvelt.app/web/${config.slug || 'demo-lawn-care'}`);
              showToast(t("¡Copiado!", "Copied!"), "success");
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl hover:bg-emerald-700 transition cursor-pointer"
          >
            <Copy size={12} />
            {t("Copiar Enlace", "Copy Link")}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(publicUrl || `https://bvelt.app/web/${config.slug || 'demo-lawn-care'}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black rounded-xl transition cursor-pointer"
          >
            <MessageSquare size={12} />
            {t("Compartir por WhatsApp", "Share on WhatsApp")}
          </a>
          <button 
            type="button"
            onClick={downloadQR}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black rounded-xl transition cursor-pointer"
          >
            <QrCode size={12} />
            {t("Descargar QR", "Download QR")}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Form Content */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                 <Layout size={16} className="text-indigo-500" />
                 {t("Contenido de la Página", "Page Content")}
               </h3>
               <button 
                type="button"
                onClick={generateWithAi}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition disabled:opacity-50"
               >
                 <Wand2 size={14} className={generating ? 'animate-spin' : ''} />
                 {generating ? t("Generando...", "Generating...") : t("Redactar Texto", "Write Text")}
               </button>
            </div>

            <div className="space-y-6">
              {/* Slug */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {t("Enlace Personalizado (Slug)", "Custom Link (Slug)")}
                </label>
                <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 focus-within:ring-2 focus-within:ring-indigo-500/20">
                  <span className="text-xs text-slate-400 font-mono select-none shrink-0">{typeof window !== 'undefined' ? window.location.origin : ''}/web/</span>
                  <input 
                    type="text" 
                    value={config.slug || ''}
                    onChange={(e) => setConfig({...config, slug: normalizeSlug(e.target.value)})}
                    placeholder="mi-negocio"
                    className="w-full bg-transparent text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none ml-1 font-bold"
                  />
                </div>
              </div>

              {/* Hero Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Título Principal (Hero / Negocio)", "Main Title (Hero / Business Name)")}</label>
                <input 
                  type="text" 
                  value={config.heroTitle}
                  onChange={(e) => setConfig({...config, heroTitle: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Ej. S. Mendoza Complete Lawn Care"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Subtítulo Persuasivo", "Persuasive Subtitle")}</label>
                <input 
                  type="text" 
                  value={config.heroSubtitle}
                  onChange={(e) => setConfig({...config, heroSubtitle: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Ej. Mantenimiento integral de jardines en Naples, FL"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Descripción del Negocio", "Business Description")}</label>
                <textarea 
                  value={config.description}
                  onChange={(e) => setConfig({...config, description: e.target.value})}
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Site Language */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Idioma del Sitio", "Site Language")}</label>
                  <select
                    value={config.siteLanguage || 'es'}
                    onChange={(e) => setConfig({...config, siteLanguage: e.target.value as 'es' | 'en'})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="es">Español (ES)</option>
                    <option value="en">English (EN)</option>
                  </select>
                </div>

                {/* CTA Label */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Texto del Botón (CTA)", "CTA Button Label")}</label>
                  <input 
                    type="text" 
                    value={config.ctaLabel || ''}
                    onChange={(e) => setConfig({...config, ctaLabel: e.target.value})}
                    placeholder={config.siteLanguage === 'en' ? "Get a Free Quote" : "Pedir presupuesto gratis"}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Phone, WhatsApp, Email, Service Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Teléfono", "Phone")}</label>
                  <input 
                    type="text" 
                    value={config.phone || ''}
                    onChange={(e) => setConfig({...config, phone: e.target.value})}
                    placeholder="Ej. (239) 555-0198"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("WhatsApp", "WhatsApp")}</label>
                  <input 
                    type="text" 
                    value={(config as any).whatsapp || ''}
                    onChange={(e) => setConfig({...config, whatsapp: e.target.value} as any)}
                    placeholder="Ej. +12395550198"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Correo Electrónico", "Email")}</label>
                  <input 
                    type="email" 
                    value={config.email || ''}
                    onChange={(e) => setConfig({...config, email: e.target.value})}
                    placeholder="contacto@minegocio.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>

                {/* Service Area */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Área de Servicio", "Service Area")}</label>
                  <input 
                    type="text" 
                    value={config.serviceArea || ''}
                    onChange={(e) => setConfig({...config, serviceArea: e.target.value})}
                    placeholder="Ej. Naples, FL"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Services (up to 8) */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <ListChecks size={13} style={{ color: activeAccent }} />
                    {t("Servicios Ofrecidos (Hasta 8)", "Offered Services (Up to 8)")}
                  </label>
                  {(!config.services || config.services.length === 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        const cat = profile?.category || profile?.niche || '';
                        const isEn = config.siteLanguage === 'en';
                        let suggested: string[] = [];
                        const catLower = cat.toLowerCase();
                        if (catLower.includes('landscap') || catLower.includes('lawn') || catLower.includes('jard')) {
                          suggested = isEn 
                            ? ["Lawn Mowing & Edging", "Landscape Design", "Tree Trimming & Pruning", "Irrigation Installation", "Fertilization & Weed Control", "Yard Cleanup"]
                            : ["Corte de Césped", "Diseño Paisajístico", "Poda de Árboles", "Instalación de Riego", "Fertilización y Abono", "Limpieza de Terrenos"];
                        } else if (catLower.includes('plumb') || catLower.includes('plomer') || catLower.includes('fontan')) {
                          suggested = isEn 
                            ? ["Leak Detection & Repair", "Pipe Installation", "Drain Cleaning", "Water Heater Service", "Camera Inspection", "Preventative Maintenance"]
                            : ["Detección de Fugas", "Instalación de Tuberías", "Destape de Drenajes", "Calentadores de Agua", "Inspección con Cámara", "Mantenimiento Preventivo"];
                        } else if (catLower.includes('hvac') || catLower.includes('air') || catLower.includes('aire') || catLower.includes('heat') || catLower.includes('clima')) {
                          suggested = isEn 
                            ? ["AC Installation", "Heating Maintenance", "Duct Repair & Cleaning", "Refrigerant Recharge", "Smart Thermostats", "Emergency Repairs"]
                            : ["Instalación de A/C", "Mantenimiento de Calefacción", "Reparación de Conductos", "Recarga de Refrigerante", "Termostatos Inteligentes", "Reparaciones de Emergencia"];
                        } else if (catLower.includes('roof') || catLower.includes('techo')) {
                          suggested = isEn 
                            ? ["Roof Repairs", "Shingle Installation", "Waterproofing", "Leak Inspection", "Gutter Cleaning", "Roof Maintenance"]
                            : ["Reparación de Techos", "Instalación de Tejas", "Impermeabilización", "Inspección de Goteras", "Limpieza de Canaletas", "Mantenimiento de Cubiertas"];
                        } else {
                          suggested = isEn
                            ? ["General Trade Service", "Emergency Response", "Preventative Maintenance", "Professional Installations", "On-site Inspections", "Custom Estimates"]
                            : ["Servicio Profesional", "Atención Rápida", "Mantenimiento Preventivo", "Instalaciones", "Diagnóstico en Sitio", "Presupuestos a Medida"];
                        }
                        setConfig({ ...config, services: suggested });
                        showToast(t("Servicios sugeridos agregados", "Suggested services added"), "info");
                      }}
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[10px] font-black cursor-pointer hover:bg-indigo-100 transition"
                    >
                      {t("Usar sugeridos", "Use suggested")}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(config.services || []).map((srv, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                      <input
                        type="text"
                        maxLength={80}
                        value={srv}
                        onChange={(e) => {
                          const updated = [...(config.services || [])];
                          updated[idx] = e.target.value;
                          setConfig({ ...config, services: updated });
                        }}
                        placeholder={`Servicio #${idx + 1}`}
                        className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (config.services || []).filter((_, i) => i !== idx);
                          setConfig({ ...config, services: updated });
                        }}
                        className="text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {(config.services || []).length < 8 && (
                  <button
                    type="button"
                    onClick={() => {
                      const current = config.services || [];
                      if (current.length < 8) {
                        setConfig({ ...config, services: [...current, ''] });
                      }
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer text-slate-700 dark:text-slate-300"
                  >
                    <Plus size={13} />
                    {t("Agregar Servicio", "Add Service")}
                  </button>
                )}
              </div>

              {/* Key Features (up to 3 pairs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Star size={13} style={{ color: activeAccent }} />
                    {t("Puntos Clave (Hasta 3)", "Key Features (Up to 3)")}
                  </label>
                  {(config.keyFeatures || []).length < 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        const current = config.keyFeatures || [];
                        if (current.length < 3) {
                          setConfig({ ...config, keyFeatures: [...current, { title: '', description: '' }] });
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      <Plus size={12} />
                      {t("Agregar Punto", "Add Feature")}
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {(config.keyFeatures || []).map((feat, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400">Punto #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (config.keyFeatures || []).filter((_, i) => i !== idx);
                            setConfig({ ...config, keyFeatures: updated });
                          }}
                          className="text-slate-400 hover:text-rose-500 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => {
                          const updated = [...(config.keyFeatures || [])];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setConfig({ ...config, keyFeatures: updated });
                        }}
                        placeholder={t("Título del punto", "Feature title")}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                      <textarea
                        value={feat.description}
                        onChange={(e) => {
                          const updated = [...(config.keyFeatures || [])];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setConfig({ ...config, keyFeatures: updated });
                        }}
                        rows={2}
                        placeholder={t("Descripción del punto", "Feature description")}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Hours / Horario */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <ClockIcon size={13} style={{ color: activeAccent }} />
                  {t("Horario de Atención", "Business Hours")}
                </label>
                <input
                  type="text"
                  value={config.hours || ''}
                  onChange={(e) => setConfig({ ...config, hours: e.target.value })}
                  placeholder="Ej. Lunes a Viernes: 8:00 AM - 6:00 PM / Sábados: 9:00 AM - 2:00 PM"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs font-bold"
                />
              </div>

              {/* FAQ (up to 4 pairs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <FaqIcon size={13} style={{ color: activeAccent }} />
                    {t("Preguntas Frecuentes (Hasta 4)", "FAQ (Up to 4 pairs)")}
                  </label>
                  {(config.faq || []).length < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        const current = config.faq || [];
                        if (current.length < 4) {
                          setConfig({ ...config, faq: [...current, { question: '', answer: '' }] });
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      <Plus size={12} />
                      {t("Agregar Pregunta", "Add FAQ")}
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {(config.faq || []).map((faqItem, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-slate-400">FAQ #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (config.faq || []).filter((_, i) => i !== idx);
                            setConfig({ ...config, faq: updated });
                          }}
                          className="text-slate-400 hover:text-rose-500 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={faqItem.question}
                        onChange={(e) => {
                          const updated = [...(config.faq || [])];
                          updated[idx] = { ...updated[idx], question: e.target.value };
                          setConfig({ ...config, faq: updated });
                        }}
                        placeholder={t("Pregunta", "Question")}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      />
                      <textarea
                        value={faqItem.answer}
                        onChange={(e) => {
                          const updated = [...(config.faq || [])];
                          updated[idx] = { ...updated[idx], answer: e.target.value };
                          setConfig({ ...config, faq: updated });
                        }}
                        rows={2}
                        placeholder={t("Respuesta", "Answer")}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos (up to 6 https URLs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Image size={13} style={{ color: activeAccent }} />
                    {t("Galería de Fotos (Hasta 6 URLs https)", "Photo Gallery (Up to 6 https URLs)")}
                  </label>
                  {(config.photos || []).length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const current = config.photos || [];
                        if (current.length < 6) {
                          setConfig({ ...config, photos: [...current, ''] });
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      <Plus size={12} />
                      {t("Agregar Foto", "Add Photo")}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {(config.photos || []).map((photoUrl, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                      <input
                        type="url"
                        value={photoUrl}
                        onChange={(e) => {
                          const updated = [...(config.photos || [])];
                          updated[idx] = e.target.value;
                          setConfig({ ...config, photos: updated });
                        }}
                        placeholder="https://ejemplo.com/foto.jpg"
                        className="w-full bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (config.photos || []).filter((_, i) => i !== idx);
                          setConfig({ ...config, photos: updated });
                        }}
                        className="text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show Reviews Checkbox */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    {t("Mostrar Reseñas en la Página Pública", "Show Reviews on Public Page")}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("Muestra la sección de opiniones si tienes al menos 3 reseñas sincronizadas de 4 o 5 estrellas.", "Displays review section if at least 3 synced 4-5 star reviews exist.")}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(config.showReviews)}
                    onChange={(e) => setConfig({ ...config, showReviews: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Referral Badge Settings */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {t("Enlace 'Hecho con Bvelt' en el pie", "'Made with Bvelt' badge in footer")}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("Incluye tu enlace de referido (bvelt.app/?ref=TU_ID) para ganar 1 mes gratis por cada nuevo cliente.", "Includes your referral link (bvelt.app/?ref=YOUR_ID) to earn 1 free month per paying customer.")}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!config.hideBveltBadge}
                    onChange={(e) => setConfig({ ...config, hideBveltBadge: !e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Key Features */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("Características Destacadas (Pilares)", "Key Features & Standards")}</label>
                {(config.keyFeatures || []).map((kf, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase" style={{ color: activeAccent }}>Pilar #{idx + 1}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          const updated = config.keyFeatures.filter((_, i) => i !== idx);
                          setConfig({...config, keyFeatures: updated});
                        }}
                        className="text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={kf.title}
                      onChange={(e) => {
                        const updated = [...(config.keyFeatures || [])];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setConfig({...config, keyFeatures: updated});
                      }}
                      placeholder={t("Título del pilar", "Feature title")}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <textarea 
                      value={kf.description}
                      onChange={(e) => {
                        const updated = [...(config.keyFeatures || [])];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setConfig({...config, keyFeatures: updated});
                      }}
                      rows={2}
                      placeholder={t("Descripción detallada del pilar", "Detailed feature description")}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 outline-none resize-none"
                    />
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setConfig({...config, keyFeatures: [...(config.keyFeatures || []), { title: 'Nuevo Pilar', description: 'Descripción detallada de la ventaja competitiva.' }]})}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    style={{ color: activeAccent }}
                  >
                    <Plus size={14} />
                    {t("Agregar Pilar", "Add Feature Card")}
                  </button>

                  {Array.isArray(profile?.services) && profile.services.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => {
                        const synced: FeatureItem[] = [
                          ...profile.services.map((s: string) => ({
                            title: s,
                            description: (config.siteLanguage === 'en' || language === 'en')
                              ? `Professional and reliable ${s.toLowerCase()} services for your home or business.`
                              : `Servicio profesional y garantizado de ${s.toLowerCase()} para tu hogar o empresa.`
                          })),
                          {
                            title: (config.siteLanguage === 'en' || language === 'en') ? "Satisfaction Guarantee" : "Garantía de Satisfacción",
                            description: (config.siteLanguage === 'en' || language === 'en')
                              ? "Rigorous commitment to the highest trade standards and professionalism."
                              : "Compromiso riguroso con los más altos estándares de calidad y profesionalismo."
                          }
                        ];
                        setConfig({ ...config, keyFeatures: synced, features: profile.services });
                        showToast(t("Servicios del perfil sincronizados", "Profile services synced"), "success");
                      }}
                      className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 rounded-xl transition cursor-pointer"
                    >
                      <CheckCircle size={14} />
                      {t("Sincronizar Servicios del Perfil", "Sync Profile Services")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                type="button"
                onClick={() => saveConfig()}
                disabled={saving}
                style={{ backgroundColor: activeAccent }}
                className="flex items-center gap-3 text-white font-black px-10 py-4 rounded-2xl shadow-lg hover:opacity-90 transition cursor-pointer disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? t("Guardando...", "Saving...") : t("Guardar Cambios", "Save Changes")}
              </button>
            </div>
          </section>
        </div>

        {/* Right 1 Col: Appearance, Color Swatches & Live Interactive Preview */}
        <div className="space-y-6">
          {/* Accent Color Swatches */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Palette size={16} style={{ color: activeAccent }} />
              {t("Color de Acento", "Accent Color")}
            </h3>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {t("Paleta de Marca", "Brand Swatches")}
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {SWATCH_COLORS.map(sw => (
                  <button 
                    key={sw.hex}
                    type="button"
                    onClick={() => handleColorSelect(sw.hex)}
                    title={sw.name}
                    className={`h-11 rounded-2xl border-2 transition-all flex items-center justify-center cursor-pointer shadow-sm ${activeAccent === sw.hex ? 'border-slate-900 dark:border-white scale-105 shadow-md' : 'border-transparent opacity-85 hover:opacity-100'}`}
                    style={{ backgroundColor: sw.hex }}
                  >
                    {activeAccent === sw.hex && <CheckCircle size={16} className="text-white drop-shadow-md" />}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-3 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t("Personalizado:", "Custom:")}
                </label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <input 
                    type="color"
                    value={activeAccent}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    {activeAccent}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Live Website Preview Card */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Eye size={14} style={{ color: activeAccent }} />
                {t("Vista Previa en Vivo", "Live Website Preview")}
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                {t("Sincronizado", "Synced")}
              </span>
            </div>

            {/* Simulated Mobile/Desktop Mini Frame */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white overflow-hidden shadow-xl text-left">
              {/* Header Bar */}
              <div className="p-4 flex items-center justify-between border-b border-white/10 bg-slate-900/90">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAccent }} />
                  <span className="font-black text-xs text-white truncate max-w-[160px]">
                    {config.heroTitle || 'Tu Negocio'}
                  </span>
                </div>
                {config.phone && (
                  <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                    <Phone size={10} style={{ color: activeAccent }} />
                    {config.phone}
                  </span>
                )}
              </div>

              {/* Hero Banner Section */}
              <div className="p-5 space-y-3 bg-gradient-to-b from-slate-900 to-slate-950">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-slate-300">
                  <MapPin size={10} style={{ color: activeAccent }} />
                  {config.serviceArea || 'Tu Ciudad'}
                </span>

                <h4 className="text-base font-black text-white leading-tight">
                  {config.heroTitle || 'Tu Negocio Profesional'}
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {config.heroSubtitle || 'Servicios Profesionales de Calidad'}
                </p>

                {/* Primary CTA Button Styled with Accent */}
                <button 
                  type="button"
                  style={{ backgroundColor: activeAccent }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-black text-white shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  <span>{config.ctaLabel || (config.siteLanguage === 'en' ? 'Get a Free Quote' : 'Pedir presupuesto gratis')}</span>
                </button>
              </div>

              {/* Pillars / Features Preview */}
              <div className="p-4 bg-slate-900/60 border-t border-white/5 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {t("Garantías y Pilares", "Pillars & Standards")}
                </span>
                <div className="space-y-1.5">
                  {(config.keyFeatures || []).slice(0, 3).map((kf, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-start gap-2">
                      <ShieldCheck size={13} className="shrink-0 mt-0.5" style={{ color: activeAccent }} />
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{kf.title}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{kf.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-950 text-center border-t border-white/10 text-[9px] text-slate-400 flex justify-between items-center px-4">
                <span className="truncate">{config.email || ''}</span>
                {!config.hideBveltBadge && (
                  <a
                    href={`https://bvelt.app/?ref=${encodeURIComponent(user?.uid || config.slug || 'bvelt')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-slate-500 hover:text-indigo-400 transition underline underline-offset-2"
                  >
                    Hecho con Bvelt
                  </a>
                )}
                <span className="font-bold text-slate-300">{config.serviceArea}</span>
              </div>
            </div>
          </section>

          {/* Help Notice */}
          <div className="p-6 bg-slate-100 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
             <div className="flex items-center gap-3">
                <HelpCircle size={20} style={{ color: activeAccent }} />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{t("¿Es gratuito?", "Is it free?")}</h4>
             </div>
             <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
               {t("¡Sí! Tu página está alojada en nuestros servidores. No necesitas pagar dominio ni hosting aparte. Es ideal para compartir en WhatsApp o Instagram.", "Yes! Your page is hosted on our servers. You don't need to pay for a domain or hosting separately. It's ideal for sharing on WhatsApp or Instagram.")}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
