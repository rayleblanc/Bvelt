import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertTriangle, Sparkles, Tag, Loader2, RefreshCw, X, CheckCircle2, ArrowRight } from 'lucide-react';

interface AnalysisResult {
  repair_steps?: string[];
  urgency_level: 'Alto' | 'Medio' | 'Bajo' | 'High' | 'Medium' | 'Low';
  diagnostic_message: string;
  seo_keywords: string[];
}

interface VisualEstimatorProps {
  t: (es: string, en: string) => string;
  language: 'es' | 'en';
  profile?: any;
  customGeminiKey?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const Skeleton = ({ className, ...props }: any) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded ${className}`} {...props} />
);

export function VisualEstimator({ t, language, profile, customGeminiKey, showToast }: VisualEstimatorProps) {
  const [image, setImage] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const cityLabel = (() => {
    let raw = profile?.city || '';
    if (!raw) {
      const loc = profile?.location || '';
      if (loc) {
        raw = loc.split(',')[0];
      }
    }
    const trimmed = raw ? String(raw).trim() : '';
    if (trimmed && trimmed !== 'Local Business' && trimmed !== 'Negocio') {
      return trimmed;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const rawStorage = localStorage.getItem('lf_profile') || localStorage.getItem('user_profile');
        if (rawStorage) {
          const parsed = JSON.parse(rawStorage);
          const c = (parsed.city || parsed.location?.split(',')[0] || '').trim();
          if (c && c !== 'Local Business' && c !== 'Negocio') return c;
        }
      }
    } catch {}
    return '';
  })();

  const cleanCityPlaceholder = (text: string): string => {
    if (!text) return '';
    let cleaned = text;

    const replacer = cityLabel || (language === 'es' ? 'tu zona' : 'your area');

    cleaned = cleaned
      .replace(/\[(Ciudad|City|Zona|Area|Location|Localidad)\]/gi, replacer)
      .replace(/\{(ciudad|city|location|zona)\}/gi, replacer)
      .replace(/<city>/gi, replacer);

    return cleaned.replace(/\[\s*\]|\{\s*\}/g, '').replace(/\s{2,}/g, ' ').trim();
  };

  // Reliable demo images stored locally in /demo/
  const presetPhotos = [
    {
      id: 'roof',
      name: t('Techo Dañado', 'Damaged Roof'),
      url: '/demo/damage-roof.jpg',
      alt: t('Techo residencial con tejas dañadas por tormenta', 'Residential roof with damaged asphalt shingles')
    },
    {
      id: 'garden',
      name: t('Jardín Descuidado', 'Neglected Lawn'),
      url: '/demo/damage-yard.jpg',
      alt: t('Césped y jardín descuidado con maleza alta', 'Overgrown neglected front lawn and yard')
    },
    {
      id: 'paint',
      name: t('Pared Agrietada', 'Cracked Wall'),
      url: '/demo/damage-wall.jpg',
      alt: t('Pared exterior con grietas estructurales y pintura descascarada', 'Exterior stucco wall with cracks and peeling paint')
    }
  ];

  // Convert File to Base64 and compress using Canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast(t('La imagen supera los 10MB', 'Image exceeds 10MB limit'), 'error');
      return;
    }

    setSelectedPresetId(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_width = 1000;

        if (width > max_width) {
          height = Math.round((height * max_width) / width);
          width = max_width;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImage(dataUrl);
        setResult(null);
        setError(null);
        showToast(t('Foto cargada en preview lista para analizar.', 'Photo loaded in preview ready to analyze.'), 'success');
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const selectPreset = async (preset: typeof presetPhotos[0]) => {
    setSelectedPresetId(preset.id);
    setResult(null);
    setError(null);
    setLoadingPreset(true);

    try {
      // Fetch local demo image and convert to Base64 data URL for instant preview & vision processing
      const response = await fetch(preset.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setLoadingPreset(false);
        showToast(t(`Foto de "${preset.name}" seleccionada. Pulsa Analizar.`, `"${preset.name}" sample loaded. Click Analyze.`), 'info');
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error(e);
      setImage(preset.url);
      setLoadingPreset(false);
    }
  };

  const handleClearImage = () => {
    setImage(null);
    setSelectedPresetId(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const analyzeImage = async () => {
    if (!image) {
      showToast(t('Por favor selecciona o sube una foto antes de analizar.', 'Please select or upload a photo before analyzing.'), 'info');
      return;
    }

    setAnalyzing(true);
    setError(null);

    const locationContext = cityLabel ? (language === 'es' ? `en ${cityLabel}` : `in ${cityLabel}`) : '';
    const promptText = `Analiza detalladamente esta imagen de un daño en una propiedad o servicio de hogar (techado, jardinería, grietas, plomería, pintura, etc.). 
    Proporciona un diagnóstico técnico profesional, los pasos específicos de reparación y 5 palabras clave de SEO Local para posicionar en Google Maps${locationContext ? ' ' + locationContext : ''}.
    Responde estrictamente con un objeto JSON con las siguientes llaves (en el idioma ${language === 'es' ? 'español' : 'inglés'}):
    - "urgency_level": "Alto", "Medio", o "Bajo"
    - "diagnosis": Un diagnóstico técnico claro y detallado del daño visible.
    - "repair_steps": Un array de 3 a 4 strings con los pasos técnicos para solucionar el daño.
    - "seo_keywords": Un array de 5 palabras clave de SEO local para Google Maps (específicas y sin placeholders genéricos como [Ciudad]).
    
    Formato requerido:
    {
      "urgency_level": "Alto",
      "diagnosis": "...",
      "repair_steps": ["...", "..."],
      "seo_keywords": ["...", "..."]
    }`;

    const systemInstruction = `Eres un Estimador Senior de Proyectos y Perito de Seguros con 20 años de experiencia. 
    Tu lenguaje es técnico, riguroso y persuasivo para contratistas y peritos de seguros. ${cityLabel ? `El área de servicio local es ${cityLabel}.` : ''} 
    Responde ÚNICAMENTE con el objeto JSON válido.`;

    try {
      // Ensure image is formatted as data URL if starting with path
      let payloadImage = image;
      if (image.startsWith('/')) {
        try {
          const res = await fetch(image);
          const blob = await res.blob();
          payloadImage = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
        } catch {}
      }

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customGeminiKey ? { 'x-gemini-api-key': customGeminiKey } : {})
        },
        body: JSON.stringify({
          prompt: promptText,
          systemInstruction,
          image: payloadImage,
          taskType: 'diagnosis_rewrite'
        })
      });

      const ct = response.headers.get('content-type') || '';
      let data: any = null;
      if (ct.includes('application/json')) {
        data = await response.json().catch(() => null);
      }

      if (!response.ok || !data) {
        const friendlyMsg = data?.error || t(
          'No pudimos procesar la imagen ahora mismo. Intenta de nuevo en unos momentos.',
          'Could not process image right now. Please try again in a few moments.'
        );
        setError(friendlyMsg);
        showToast(friendlyMsg, 'error');
        return;
      }

      if (!data.text) {
        const friendlyMsg = t(
          'El análisis visual no devolvió un diagnóstico. Intenta con otra imagen.',
          'Visual analysis returned no response. Try with another photo.'
        );
        setError(friendlyMsg);
        showToast(friendlyMsg, 'error');
        return;
      }

      // Sanitize JSON text
      let text = String(data.text).trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
      }

      try {
        const parsed = JSON.parse(text);
        const rawKeywords = Array.isArray(parsed.seo_keywords) ? parsed.seo_keywords : ['reparación local', 'estimación de daños'];
        const sanitizedKeywords = rawKeywords.map((k: string) => cleanCityPlaceholder(String(k)));
        const rawSteps = Array.isArray(parsed.repair_steps) ? parsed.repair_steps : [];
        const sanitizedSteps = rawSteps.map((s: string) => cleanCityPlaceholder(String(s)));

        setResult({
          urgency_level: parsed.urgency_level || 'Medio',
          diagnostic_message: cleanCityPlaceholder(parsed.diagnosis || parsed.diagnostic_message || ''),
          seo_keywords: sanitizedKeywords,
          repair_steps: sanitizedSteps
        });
        showToast(t('¡Diagnóstico Espacial Completado!', 'Spatial Diagnosis Completed!'), 'success');
      } catch (parseErr) {
        setResult({
          urgency_level: 'Medio',
          diagnostic_message: cleanCityPlaceholder(text),
          seo_keywords: [
            cityLabel ? `estimación espacial ${cityLabel}` : 'estimación espacial',
            cityLabel ? `reparación local ${cityLabel}` : 'reparación local',
            'peritaje de daños'
          ],
          repair_steps: []
        });
        showToast(t('¡Diagnóstico Espacial Completado!', 'Spatial Diagnosis Completed!'), 'success');
      }
    } catch (err: any) {
      console.error('[VisualEstimator] Analysis error:', err);
      const friendlyMsg = t(
        'Error de conexión con el servicio de visión. Revisa tu conexión e intenta de nuevo.',
        'Connection error with vision service. Check your connection and retry.'
      );
      setError(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedPresetId(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        showToast(t('Foto cargada en preview.', 'Photo loaded in preview.'), 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const urgencyColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l === 'alto' || l === 'high') return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (l === 'medio' || l === 'medium') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="relative border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-600 rounded-r-full hidden md:block shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
        <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">
          {t('📸 Inspector Espacial de Daños', '📸 Spatial Damage Inspector')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-2xl">
          {t(
            'Sube o captura una foto de daño en la propiedad para obtener un diagnóstico técnico inmediato, pasos de reparación y keywords SEO para Google Maps.',
            'Upload or capture property damage to get an instant technical diagnosis, repair roadmap, and local SEO keywords for Google Maps.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Upload & Presets */}
        <div className="space-y-4">
          {/* Main Dropzone / Preview */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all flex flex-col items-center justify-center relative min-h-[300px] ${
              image 
                ? 'border-indigo-500/60 bg-indigo-50/10 dark:bg-indigo-950/20' 
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-indigo-500/50'
            }`}
          >
            {image ? (
              <div className="relative w-full rounded-2xl overflow-hidden group">
                <img 
                  src={image} 
                  alt="Preview del daño" 
                  className="w-full max-h-[320px] object-cover rounded-2xl shadow-md" 
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearImage}
                    aria-label={t('Eliminar foto', 'Remove photo')}
                    className="p-2 bg-slate-950/80 hover:bg-rose-600 text-white rounded-xl backdrop-blur-md transition shadow-md cursor-pointer"
                    title={t('Quitar foto', 'Remove photo')}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-4 flex items-center justify-between text-white">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    {t('Foto cargada en preview', 'Photo loaded in preview')}
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition backdrop-blur-md cursor-pointer flex items-center gap-1"
                  >
                    <Upload size={12} /> {t('Cambiar', 'Change')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center py-6">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-full text-indigo-500 shadow-inner">
                  <Camera size={36} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {t('Arrastra una foto aquí o selecciona un archivo', 'Drag a photo here or choose a file')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('Formatos JPEG, PNG, WEBP (Máx. 10MB)', 'JPEG, PNG, WEBP formats (Max 10MB)')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center px-4 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t('Subir archivo de foto', 'Upload photo file')}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-3 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                  >
                    <Upload size={14} />
                    {t('Subir Foto', 'Upload Photo')}
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    aria-label={t('Abrir cámara', 'Open camera')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-black px-5 py-3 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <Camera size={14} className="text-indigo-500" />
                    {t('Cámara', 'Camera')}
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Preset sample photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {t('O toca una foto de ejemplo:', 'Or tap a sample photo:')}
              </p>
              {selectedPresetId && (
                <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {t('Ejemplo activo', 'Active sample')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {presetPhotos.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={`Seleccionar ejemplo: ${p.name}`}
                    onClick={() => selectPreset(p)}
                    disabled={loadingPreset}
                    className={`p-2 rounded-2xl border text-left transition text-xs font-bold flex flex-col gap-2 cursor-pointer group shadow-sm ${
                      isSelected
                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/60 dark:hover:border-indigo-500/60'
                    }`}
                  >
                    <div className="h-20 w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                      <img
                        src={p.url}
                        alt={p.alt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white rounded-full p-0.5 shadow">
                          <CheckCircle2 size={12} />
                        </div>
                      )}
                    </div>
                    <span className={`truncate text-[11px] font-extrabold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={analyzeImage}
            disabled={analyzing}
            className={`w-full font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg ${
              !image
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white cursor-pointer shadow-indigo-600/20'
            }`}
          >
            {analyzing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {t('Analizando Estructura Espacial...', 'Analyzing Spatial Structure...')}
              </>
            ) : (
              <>
                <Sparkles size={18} className={image ? 'text-amber-300' : ''} />
                {t('Analizar Daños Espaciales ✨', 'Analyze Spatial Damages ✨')}
              </>
            )}
          </button>

          {!image && (
            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 font-medium">
              {t('💡 Selecciona una foto de ejemplo o sube una propia para habilitar el análisis.', '💡 Select a sample photo or upload your own to enable analysis.')}
            </p>
          )}
        </div>

        {/* Right column: Results & Guidance */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[420px] flex flex-col justify-between shadow-sm">
            {analyzing && (
              <div className="space-y-6 animate-pulse my-auto">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <Skeleton className="w-1/3 h-5" />
                  <Skeleton className="w-20 h-6" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <Skeleton className="w-1/3 h-4" />
                  </div>
                  <Skeleton className="w-full h-16" />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl space-y-3">
                  <Skeleton className="w-1/4 h-4" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="w-24 h-7" />
                    <Skeleton className="w-28 h-7" />
                    <Skeleton className="w-20 h-7" />
                  </div>
                </div>

                <div className="text-center pt-4">
                  <p className="text-xs font-black text-indigo-500 uppercase tracking-widest animate-pulse flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {t('Procesando Imagen con Visión Espacial...', 'Processing Image with Spatial Vision...')}
                  </p>
                </div>
              </div>
            )}

            {!analyzing && !result && !error && (
              <div className="flex flex-col items-center justify-center py-12 text-center my-auto">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                  {image ? t('Foto Lista para Diagnóstico', 'Photo Ready for Diagnosis') : t('Esperando Análisis Espacial', 'Awaiting Spatial Analysis')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6">
                  {image
                    ? t('Pulsa el botón "Analizar Daños Espaciales ✨" para obtener el peritaje técnico y palabras clave.', 'Click "Analyze Spatial Damages ✨" to generate the technical appraisal and keywords.')
                    : t('Toca una de las fotos de ejemplo (Techo, Jardín, Pared) o sube una imagen propia desde tu dispositivo.', 'Tap one of the sample photos (Roof, Lawn, Wall) or upload your own image from your device.')}
                </p>

                {/* Quick Step Indicator */}
                <div className="w-full max-w-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-left space-y-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${image ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                      {image ? '✓' : '1'}
                    </span>
                    <span>{t('Seleccionar o subir foto', 'Select or upload photo')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${image ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                      2
                    </span>
                    <span>{t('Pulsar "Analizar Daños Espaciales"', 'Click "Analyze Spatial Damages"')}</span>
                  </div>
                </div>
              </div>
            )}

            {error && !analyzing && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-5 rounded-2xl text-amber-600 dark:text-amber-400 text-xs flex flex-col items-start gap-4 my-auto">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <span className="font-extrabold block text-sm mb-1 text-slate-900 dark:text-slate-100">
                      {t('No pudimos completar el diagnóstico', 'Could not complete diagnosis')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed block">
                      {error}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={analyzeImage}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
                >
                  <RefreshCw size={14} />
                  {t('Reintentar Análisis', 'Retry Analysis')}
                </button>
              </div>
            )}

            {!analyzing && result && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    {t('Diagnóstico Espacial', 'Spatial Diagnosis')}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${urgencyColor(
                      result.urgency_level
                    )}`}
                  >
                    {t('Urgencia: ', 'Urgency: ')} {result.urgency_level}
                  </span>
                </div>

                <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                    <Sparkles size={14} /> {t('Diagnóstico de Daño', 'Damage Diagnosis')}
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed italic">
                    "{result.diagnostic_message}"
                  </p>
                </div>

                {result.repair_steps && result.repair_steps.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block">
                      {t('Pasos Sugeridos de Reparación', 'Suggested Repair Steps')}
                    </span>
                    <ul className="space-y-1.5">
                      {result.repair_steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <div className="mt-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] block">
                    {t('Keywords SEO Sugeridas (Google Maps)', 'Suggested SEO Keywords (Google Maps)')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {result.seo_keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <Tag size={12} /> {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-900 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const cityHeader = cityLabel ? ` [${cityLabel}]` : '';
                      const langEs = language === 'es';
                      const header = langEs 
                        ? `DIAGNÓSTICO TÉCNICO ESPACIAL${cityHeader}` 
                        : `SPATIAL TECHNICAL DIAGNOSIS${cityHeader}`;
                      const urgency = langEs ? `Nivel de Urgencia: ${result.urgency_level}` : `Urgency Level: ${result.urgency_level}`;
                      const steps = result.repair_steps && result.repair_steps.length > 0
                        ? `\n\n${langEs ? 'Pasos Sugeridos de Reparación:' : 'Suggested Repair Steps:'}\n${result.repair_steps.map((s, i) => `${i + 1}. ${cleanCityPlaceholder(s)}`).join('\n')}`
                        : '';
                      const sanitizedKws = (result.seo_keywords || []).map(k => cleanCityPlaceholder(k));
                      const keywords = sanitizedKws.length > 0
                        ? `\n\n${langEs ? 'Keywords SEO Local:' : 'Local SEO Keywords:'}\n${sanitizedKws.join(', ')}`
                        : '';
                      const copyContent = `${header}\n${urgency}\n\n${cleanCityPlaceholder(result.diagnostic_message)}${steps}${keywords}`;

                      navigator.clipboard.writeText(copyContent);
                      showToast(t('Diagnóstico copiado al portapapeles', 'Diagnosis copied to clipboard'), 'success');
                    }}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold py-3.5 rounded-xl transition cursor-pointer text-center"
                  >
                    📋 {t('Copiar Todo', 'Copy All')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cityHeader = cityLabel ? ` (${cityLabel})` : '';
                      const langEs = language === 'es';
                      const title = langEs 
                        ? `*Diagnóstico Técnico de Propiedad${cityHeader}*` 
                        : `*Property Technical Assessment${cityHeader}*`;
                      const urgencyStr = `*${langEs ? 'Urgencia' : 'Urgency'}:* ${result.urgency_level}`;

                      let diagMsg = cleanCityPlaceholder(result.diagnostic_message || '');
                      if (diagMsg.length > 250) {
                        diagMsg = diagMsg.substring(0, 247) + '...';
                      }
                      const diagStr = `"${diagMsg}"`;

                      let stepsStr = '';
                      if (result.repair_steps && result.repair_steps.length > 0) {
                        const topSteps = result.repair_steps.slice(0, 3).map((st, i) => `${i + 1}. ${cleanCityPlaceholder(st)}`);
                        stepsStr = `\n\n*${langEs ? 'Pasos clave de reparación:' : 'Recommended repair steps:'}*\n${topSteps.join('\n')}`;
                      }

                      const sanitizedKws = (result.seo_keywords || []).map(k => cleanCityPlaceholder(k)).slice(0, 4);
                      const kwStr = sanitizedKws.length > 0 ? `\n\n*SEO Keywords:* ${sanitizedKws.join(', ')}` : '';

                      let shareText = `${title}\n${urgencyStr}\n\n${diagStr}${stepsStr}${kwStr}`;
                      if (shareText.length > 700) {
                        shareText = shareText.substring(0, 697) + '...';
                      }

                      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-3.5 rounded-xl transition cursor-pointer text-center shadow-md shadow-emerald-600/20"
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
