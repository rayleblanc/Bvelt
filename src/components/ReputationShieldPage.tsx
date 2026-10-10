import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Star, ShieldAlert, CheckCircle, ArrowRight, MessageSquare, Phone, AlertTriangle, Loader2 } from 'lucide-react';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';

interface Profile {
  name: string;
  category: string;
  location: string;
  phone: string;
  gmbLink: string;
}

interface ReputationShieldProps {
  businessId: string;
  db: any;
  isFirebaseReady: boolean;
  language: 'es' | 'en';
  t: (es: string, en: string) => string;
  customGeminiKey?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function ReputationShieldPage({ businessId, db, isFirebaseReady, language, t, customGeminiKey, showToast }: ReputationShieldProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState<number | null>(null);
  const [hoveredStars, setHoveredStars] = useState<number | null>(null);
  
  // Negative feedback form states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientFeedback, setClientFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [crisisResolutionMsg, setCrisisResolutionMsg] = useState('');

  useEffect(() => {
    if (isFirebaseReady && businessId && db) {
      loadProfile();
    } else {
      // Offline fallback
      setProfile({
        name: 'Bvelt Partner',
        category: 'Contractor Services',
        location: 'United States',
        phone: '+1 555 0192',
        gmbLink: 'https://maps.google.com'
      });
      setLoading(false);
    }
  }, [isFirebaseReady, businessId, db]);

  const loadProfile = async () => {
    try {
      const docRef = doc(db, 'profiles', businessId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProfile(snap.data() as Profile);
      } else {
        setProfile({
          name: 'Bvelt Partner',
          category: 'Contractor Services',
          location: 'United States',
          phone: '+1 555 0192',
          gmbLink: 'https://maps.google.com'
        });
      }
    } catch (e) {
      console.error("Error loading profile for reputation shield:", e);
      setProfile({
        name: 'Bvelt Partner',
        category: 'Contractor Services',
        location: 'United States',
        phone: '+1 555 0192',
        gmbLink: 'https://maps.google.com'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNegativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    try {
      // 1. Save critical complaint to CRM (leads) in Firestore
      if (db && isFirebaseReady) {
        console.log("🔥 ESCRITURA EN FIRESTORE:", 'leads');
        await addDoc(collection(db, 'leads'), {
          userId: businessId,
          text: `[CRISIS FILTRADA - ${stars} Estrellas] Cliente: ${clientName} (${clientPhone}) - Queja: ${clientFeedback}`,
          date: new Date().toISOString(),
          urgency: 'Alto',
          size: 'N/A',
          action: 'Reconciliación',
          strategy: 'Filtro de Reputación',
          source: 'reputation_shield_negative'
        });
      }

      // 2. Call Gemini to craft an immediate, highly persuasive and empathetic reconciliation message
      const promptText = language === 'es'
        ? `Eres el gestor de crisis de reputación de la empresa local "${profile.name}". El cliente "${clientName}" dejó una calificación baja de ${stars}/5 estrellas con este comentario de queja: "${clientFeedback}".
Redacta una respuesta de disculpa y conciliación sumamente empática, persuasiva y elegante, en español. Promete una llamada personal del dueño en menos de 10 minutos y ofréceles una compensación o descuento especial para arreglarlo. Limítate a un máximo de 3 líneas breves de texto.`
        : `You are the reputation crisis manager for the local business "${profile.name}". The client "${clientName}" left a low rating of ${stars}/5 stars with this complaint/review: "${clientFeedback}".
Draft a highly empathetic, persuasive, and professional apology and reconciliation response in English. Promise a personal call from the owner in less than 10 minutes and offer them compensation or a special discount to make it right. Limit your response to a maximum of 3 brief lines of text.`;

      const response = await fetch('/api/ai/groq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptText,
          systemInstruction: language === 'es' ? "Eres un gestor de crisis de reputación profesional." : "You are a professional reputation crisis manager."
        })
      });

      const ct = response.headers.get('content-type') || '';
      if (response.ok && ct.includes('application/json')) {
        const data = await response.json().catch(() => ({ text: '' })) as { text?: string };
        if (data.text) {
          setCrisisResolutionMsg(data.text);
          return;
        }
      }
      setCrisisResolutionMsg(
        language === 'es'
          ? 'Lamentamos profundamente el inconveniente. El dueño del negocio se comunicará contigo personalmente en los próximos minutos para solucionar esto de inmediato.'
          : 'We sincerely apologize for the inconvenience. The business owner will contact you personally in the next few minutes to resolve this immediately.'
      );

      setSubmitted(true);
      showToast(t('Queja enviada al propietario', 'Complaint sent privately to owner'), 'success');
    } catch (err) {
      console.error(err);
      setSubmitted(true);
      setCrisisResolutionMsg('Lamentamos profundamente el inconveniente. Nos comunicaremos contigo de inmediato.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white space-y-8">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-slate-800 animate-pulse space-y-6">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto" />
          <div className="h-8 bg-slate-800 rounded-xl w-3/4 mx-auto" />
          <div className="h-4 bg-slate-800 rounded-lg w-1/2 mx-auto" />
          <div className="flex justify-center gap-3 py-4">
            {[1,2,3,4,5].map(i => <div key={i} className="w-10 h-10 bg-slate-800 rounded-full" />)}
          </div>
          <div className="h-10 bg-slate-800 rounded-2xl w-full" />
        </div>
        <p className="text-[10px] font-black tracking-widest uppercase text-indigo-500 animate-pulse">{t('Iniciando Escudo de Reputación...', 'Initializing Reputation Shield...')}</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl text-center space-y-6 relative"
      >
        {/* Brand/Business Header */}
        <div className="space-y-2">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Star size={32} className="fill-current animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">{profile.name}</h1>
          <p className="text-xs text-slate-400 font-medium">
            {t('Tu opinión es sumamente valiosa para nosotros.', 'Your experience is highly valuable to us.')}
          </p>
        </div>

        {/* Step 1: Star Rating Selector */}
        {stars === null && (
          <div className="space-y-8 py-4">
            <p className="text-sm font-extrabold text-slate-300">
              {t('¿Cómo calificarías nuestro servicio hoy?', 'How would you rate our service today?')}
            </p>
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setStars(s)}
                  onMouseEnter={() => setHoveredStars(s)}
                  onMouseLeave={() => setHoveredStars(null)}
                  className="p-1 hover:scale-125 active:scale-95 transition-transform cursor-pointer"
                >
                  <Star
                    size={36}
                    className={`transition-colors duration-200 ${
                      s <= (hoveredStars || 0) || s <= (stars || 0)
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                        : 'text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider px-2">
              <span>{t('Deficiente', 'Poor')}</span>
              <span>{t('Excelente', 'Excellent')}</span>
            </div>
          </div>
        )}

        {/* Step 2A: Positive Rating (4 or 5 stars) -> Direct to Google Maps */}
        {stars !== null && stars >= 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 py-4"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-emerald-400">
                {t('¡Agradecemos tu valoración!', 'Thank you for your feedback!')}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {t(
                  'Nos ayuda mucho saber cómo fue tu experiencia. ¿Podrías compartir tu opinión en nuestro perfil público de Google Maps?',
                  'It helps us immensely to learn about your experience. Would you mind sharing your honest review on Google Maps?'
                )}
              </p>
            </div>
            <a
              href={profile.gmbLink || 'https://maps.google.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              Google Maps <ArrowRight size={14} className="stroke-[3]" />
            </a>
            <button
              onClick={() => setStars(null)}
              className="text-[10px] font-black text-slate-500 hover:text-slate-400 tracking-widest uppercase transition py-1"
            >
              {t('Volver a calificar', 'Rate again')}
            </button>
          </motion.div>
        )}

        {/* Step 2B: Lower Rating (1 to 3 stars) -> Direct Resolution + Open Public Link (No Gating) */}
        {stars !== null && stars <= 3 && !submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-left"
          >
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-amber-400">
              <ShieldAlert size={24} className="shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">{t('Canal Directo de Solución', 'Direct Resolution Channel')}</h4>
                <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                  {t(
                    'Lamentamos que tu experiencia no haya sido óptima. Envíanos tu mensaje directamente para resolverlo de inmediato.',
                    'We are sorry your experience fell short. Send us a message directly so we can resolve it immediately.'
                  )}
                </p>
              </div>
            </div>

            <form onSubmit={handleNegativeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Tu Nombre', 'Your Name')}</label>
                <input
                  required
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Tu Teléfono (Para contactarte)', 'Your Phone (To reach you)')}</label>
                <input
                  required
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+1 (555) 0192"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('¿Qué falló y cómo podemos solucionarlo?', 'What failed & how can we fix it?')}</label>
                <textarea
                  required
                  value={clientFeedback}
                  onChange={(e) => setClientFeedback(e.target.value)}
                  rows={3}
                  placeholder={t('Dinos sinceramente en qué fallamos...', 'Tell us honestly where we went wrong...')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    {t('Transmitiendo mensaje...', 'Transmitting message...')}
                  </>
                ) : (
                  <>
                    {t('Enviar Mensaje Directo 📥', 'Send Direct Message 📥')}
                  </>
                )}
              </button>
            </form>

            {/* Zero Review Gating Guarantee: Public link is always open and accessible */}
            <div className="pt-2 text-center border-t border-slate-800/60">
              <a
                href={profile.gmbLink || 'https://maps.google.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-400 hover:text-indigo-400 font-medium inline-flex items-center gap-1.5 transition underline"
              >
                {t('O compartir tu opinión directamente en Google Maps', 'Or share your review directly on Google Maps')} <ArrowRight size={11} />
              </a>
            </div>
          </motion.div>
        )}

        {/* Crisis Resolution Message Response Panel */}
        {submitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 py-4"
          >
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-extrabold text-amber-400">
                {t('Disculpa Sincera Recibida', 'Sincere Apology Accepted')}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto bg-slate-950 p-4 rounded-2xl border border-slate-800/60 italic font-medium">
                "{crisisResolutionMsg}"
              </p>
              <p className="text-[10px] text-slate-500 font-bold leading-normal">
                {t(
                  '*Esta resolución ha sido procesada por nuestro agente de reconciliación IA y enviada al propietario celular.',
                  '*This resolution has been processed by our AI reconciliation agent and sent directly to the owner.'
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href={`tel:${profile.phone}`}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-3.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone size={12} /> {t('Llamar Propietario', 'Call Owner')}
              </a>
              <button
                onClick={() => {
                  setStars(null);
                  setSubmitted(false);
                  setClientName('');
                  setClientPhone('');
                  setClientFeedback('');
                  setCrisisResolutionMsg('');
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3.5 rounded-xl transition cursor-pointer"
              >
                {t('Volver', 'Go Back')}
              </button>
            </div>
          </motion.div>
        )}

        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-[9px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5 opacity-60">
            <CheckCircle size={10} className="text-indigo-500" />
            <span className="uppercase tracking-widest">Bvelt Brand Shield Protection Active</span>
          </div>
          <a
            href={`https://bvelt.app/?ref=${encodeURIComponent(businessId || 'bvelt')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-indigo-400 transition underline underline-offset-2"
          >
            Hecho con Bvelt
          </a>
        </div>
      </motion.div>
    </div>
  );
}
