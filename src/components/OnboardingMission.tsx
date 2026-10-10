import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Wand2, CheckCircle, Zap, ShieldAlert, Trophy, Award, Star, X } from 'lucide-react';

interface OnboardingMissionProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'es' | 'en';
  t: (es: string, en: string) => string;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeSubRow: number;
  setActiveSubRow: (row: number) => void;
  leadRawText: string;
  setLeadRawText: (text: string) => void;
  isAiLoading: boolean;
  currentLeadAnalysis: any;
}

export const OnboardingMission = ({
  isOpen,
  onClose,
  language,
  t,
  activeTab,
  setActiveTab,
  activeSubRow,
  setActiveSubRow,
  leadRawText,
  setLeadRawText,
  isAiLoading,
  currentLeadAnalysis
}: OnboardingMissionProps) => {
  // Steps: 
  // 1: El Gancho (Spotlight on textarea, "Toca aquí para simular...")
  // 2: La Acción (Spotlight on analyze button, "Toca Analizar...")
  // 3: La Victoria (Celebration card, "¡Felicidades!...")
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [spotlightCoords, setSpotlightCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; size: number; delay: number }[]>([]);

  // Auto-switch to leads tab and first subrow when mission starts
  useEffect(() => {
    if (isOpen) {
      if (activeTab !== 'leads') {
        setActiveTab('leads');
      }
      if (activeSubRow !== 0) {
        setActiveSubRow(0);
      }
    }
  }, [isOpen]);

  // Handle particle generation for Victory Step
  useEffect(() => {
    if (currentStep === 3) {
      const colors = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // percentage
        y: Math.random() * 100, // percentage
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        delay: Math.random() * 0.5
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [currentStep]);

  // Update Spotlight position based on step
  useEffect(() => {
    if (!isOpen) return;

    const updateSpotlight = () => {
      let targetId = '';
      if (currentStep === 1) {
        targetId = 'onboarding-textarea';
      } else if (currentStep === 2) {
        targetId = 'onboarding-analyze-btn';
      }

      if (targetId) {
        const element = document.getElementById(targetId);
        if (element) {
          const rect = element.getBoundingClientRect();
          setSpotlightCoords({
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16
          });
          
          // Scroll targeted element gently into view if not visible
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      setSpotlightCoords(null);
    };

    // Delay slightly to ensure tab change / layout settling
    const timer = setTimeout(updateSpotlight, 300);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight);
    };
  }, [currentStep, isOpen, activeTab, activeSubRow]);

  // STEP 1 DETECTOR: If user types or clicks the textarea, populate with dummy text and proceed to Step 2
  useEffect(() => {
    if (!isOpen) return;

    const textarea = document.getElementById('onboarding-textarea');
    if (!textarea) return;

    const handleFocus = () => {
      if (currentStep === 1) {
        triggerSimulatedLead();
      }
    };

    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('click', handleFocus);

    return () => {
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('click', handleFocus);
    };
  }, [currentStep, isOpen]);

  // STEP 2 DETECTOR: If AI loading starts and then completes and currentLeadAnalysis is populated, transition to Step 3
  useEffect(() => {
    if (!isOpen) return;
    if (currentStep === 2 && currentLeadAnalysis) {
      setCurrentStep(3);
    }
  }, [currentLeadAnalysis, currentStep, isOpen]);

  if (!isOpen) return null;

  const triggerSimulatedLead = () => {
    const textEs = "Hola, necesito presupuesto urgente para pintar mi casa de dos pisos en la zona centro. ¿Tienen disponibilidad esta semana?";
    const textEn = "Hi, I need an urgent budget estimate to paint my two-story house in the downtown area. Do you have availability this week?";
    setLeadRawText(language === 'es' ? textEs : textEn);
    setCurrentStep(2);
  };

  const handleFinishMission = () => {
    localStorage.setItem('bvelt_mission_completed', 'true');
    localStorage.setItem('lf_has_seen_tour', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none font-sans overflow-hidden">
      {/* Immersive game-like dark backdrop with custom polygonal spotlight clipping */}
      <div 
        className="absolute inset-0 bg-slate-950/80 dark:bg-slate-950/90 backdrop-blur-[1.5px] transition-all duration-300 pointer-events-auto"
        style={{
          clipPath: spotlightCoords 
            ? `polygon(
                0% 0%, 
                0% 100%, 
                ${spotlightCoords.left}px 100%, 
                ${spotlightCoords.left}px ${spotlightCoords.top}px, 
                ${spotlightCoords.left + spotlightCoords.width}px ${spotlightCoords.top}px, 
                ${spotlightCoords.left + spotlightCoords.width}px ${spotlightCoords.top + spotlightCoords.height}px, 
                ${spotlightCoords.left}px ${spotlightCoords.top + spotlightCoords.height}px, 
                ${spotlightCoords.left}px 100%, 
                100% 100%, 
                100% 0%
              )`
            : 'none'
        }}
      />

      {/* Pulsing Game Spotlight Frame */}
      {spotlightCoords && (
        <div 
          className="absolute border-2 border-amber-500 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.6)] transition-all duration-300 animate-pulse pointer-events-none"
          style={{
            top: spotlightCoords.top,
            left: spotlightCoords.left,
            width: spotlightCoords.width,
            height: spotlightCoords.height,
          }}
        />
      )}

      {/* CONFETTI PARTICLES CELEBRATION (Only on Step 3) */}
      {currentStep === 3 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
              animate={{ 
                y: '105vh', 
                rotate: 360,
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: Math.random() * 2 + 2,
                delay: p.delay,
                ease: 'easeOut',
                repeat: Infinity
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </div>
      )}

      {/* COPILOTO HUD CARD & VICTORY POPUP */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 md:p-6 pointer-events-none">
        <AnimatePresence mode="wait">
          {currentStep !== 3 ? (
            /* Mini HUD Copiloto */
            <motion.div
              key="copilot-hud"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-slate-900 border-2 border-indigo-500 text-white w-full max-w-lg rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] p-4 pointer-events-auto flex items-center gap-4 relative overflow-hidden"
            >
              {/* Decorative side accent */}
              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 to-amber-500" />

              <div className="flex-1 pl-1">
                {/* Header Mission Tracker */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-widest font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    🚀 {t("MISIÓN DE INICIO", "STARTER MISSION")}
                  </span>
                  <div className="flex gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentStep === 1 ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
                    <span className={`w-1.5 h-1.5 rounded-full ${currentStep === 2 ? 'bg-indigo-500 animate-ping' : 'bg-slate-700'}`} />
                  </div>
                </div>

                {/* Subtitle / Instruct */}
                <h4 className="text-xs font-bold text-slate-300 leading-tight">
                  {currentStep === 1 
                    ? t("Misión 1: Simular tu primer Prospecto", "Mission 1: Simulate your first Lead")
                    : t("Misión 2: Analizar con Inteligencia Artificial", "Mission 2: Analyze with Artificial Intelligence")
                  }
                </h4>

                {/* Main Guidance Text */}
                <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1.5 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-400 shrink-0" />
                  {currentStep === 1
                    ? t("Bvelt es tu agente de crecimiento local: detecta oportunidades, decide la mejor acción y la ejecuta por ti. Toca 'Simular' para rellenar automáticamente un mensaje ficticio.", "Bvelt is your local growth agent: detects opportunities, decides the best action, and executes it for you. Tap 'Simulate' to automatically fill in a mock message.")
                    : t("¡Perfecto! Ahora toca el botón 'Analizar e Importar' para ver la magia de categorización y ejecución.", "Perfect! Now tap the 'Analyze & Import' button to see the magic of categorization and execution.")
                  }
                </p>
              </div>

              {/* Action buttons inside Copiloto HUD */}
              <div className="shrink-0 flex flex-col gap-1.5">
                {currentStep === 1 ? (
                  <button
                    onClick={triggerSimulatedLead}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition text-white font-black text-[10px] px-3.5 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer shadow-lg shadow-indigo-600/30"
                  >
                    <Wand2 size={12} />
                    {t("Simular", "Simulate")}
                  </button>
                ) : isAiLoading ? (
                  <div className="bg-slate-800 text-slate-400 text-[10px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 animate-pulse">
                    <Zap size={11} className="animate-spin text-amber-400" />
                    {t("Pensando...", "Analyzing...")}
                  </div>
                ) : null}

                <button 
                  onClick={handleFinishMission}
                  className="text-slate-500 hover:text-slate-300 text-[9px] font-bold text-center underline cursor-pointer"
                >
                  {t("Omitir misión", "Skip mission")}
                </button>
              </div>
            </motion.div>
          ) : (
            /* Paso 3: Tarjeta de Logro / Victoria */
            <motion.div
              key="victory-card"
              initial={{ scale: 0.9, y: 150, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 150, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className="bg-slate-900 border-2 border-emerald-500 text-white w-full max-w-md rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-6 md:p-8 pointer-events-auto flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* Radial gradient background flair */}
              <div className="absolute -top-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Animated Big Medal */}
              <motion.div 
                initial={{ rotate: -15, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-slate-950 mb-4 shadow-xl shadow-emerald-500/20"
              >
                <Trophy size={32} className="text-white animate-bounce" />
              </motion.div>

              {/* Title & Badge */}
              <span className="text-[10px] uppercase tracking-widest font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 mb-2">
                🏆 {t("¡LOGRO DESBLOQUEADO!", "ACHIEVEMENT UNLOCKED!")}
              </span>
              
              <h3 className="text-lg font-black tracking-tight leading-tight mb-2 text-white">
                {t("¡Misión 1 Cumplida con Éxito!", "Mission 1 Completed Successfully!")}
              </h3>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed font-medium mb-6">
                {t(
                  "¡Felicidades! Acabas de categorizar la urgencia, estimar el presupuesto (LTV) y generar una estrategia de ventas automatizada. Ahorraste aproximadamente 10 minutos de trabajo manual.",
                  "Congratulations! You've successfully parsed urgency, estimated service value (LTV), and generated an AI-powered local sales advice. You just saved about 10 minutes of manual labor."
                )}
              </p>

              {/* Big CTA to Start Using Bvelt */}
              <button
                onClick={handleFinishMission}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-3.5 px-6 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} />
                {t("¡Entendido, empezar a usar Bvelt!", "Got it, start using Bvelt!")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
