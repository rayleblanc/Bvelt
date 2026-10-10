
import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Star, Download, ImageIcon, Type, Sparkles, X, Plus } from 'lucide-react';
import { BusinessDnaService } from '../knowledge/memory/businessDnaService';
import { auth } from '../lib/firebase';

interface GMBPostCanvasProps {
  profile: any;
  t: (es: string, en: string) => string;
  onPostCreated?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GMBPostCanvas = ({ profile, t, onPostCreated, showToast }: GMBPostCanvasProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState(profile?.name || '');
  const [showStars, setShowStars] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_width = 1200;

          if (width > max_width) {
            height = Math.round((height * max_width) / width);
            width = max_width;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          setImage(dataUrl);
          if (showToast) {
            showToast(t("Imagen comprimida y optimizada exitosamente para carga ultra-rápida.", "Image compressed and optimized successfully for ultra-fast load times."), "success");
          }
        };
        if (typeof event.target?.result === 'string') {
          img.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    // In a real app we'd use html2canvas or a real canvas, but for this demo 
    // we'll simulate the "Creation" and show a success message
    const uid = auth?.currentUser?.uid || profile?.userId || 'current_user';
    BusinessDnaService.recordGbpPublication(uid, {
      postType: 'PHOTO_SEAL',
      publishedAt: new Date().toISOString()
    });

    if (onPostCreated) {
      onPostCreated();
    }

    if (showToast) {
      showToast(t("¡Imagen optimizada para GMB! En entornos reales, aquí descargarías la composición.", "Image optimized for GMB! In a real environment, you would download the composition here."), "success");
    } else {
      alert(t("¡Imagen optimizada para GMB! En entornos reales, aquí descargarías la composición.", "Image optimized for GMB! In a real environment, you would download the composition here."));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <Sparkles className="text-indigo-500" />
            {t("Diseñador de Publicaciones de GMB", "GMB Post Designer")}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
            {t("Optimiza tus fotos con sello de confianza", "Optimize your photos with trust seal")}
          </p>
        </div>
        {!image && (
          <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest cursor-pointer transition flex items-center gap-2">
            <ImageIcon size={16} />
            {t("Subir Foto del Trabajo", "Upload Job Photo")}
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Texto del Sello", "Seal Text")}</p>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-3 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={() => setShowStars(!showStars)}
               className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition flex flex-col items-center gap-2 ${showStars ? 'bg-amber-500/10 border-amber-500 text-amber-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
             >
                <Star size={18} fill={showStars ? "currentColor" : "none"} />
                {t("Estrellas", "Stars")}
             </button>
             <button 
               onClick={() => setShowLogo(!showLogo)}
               className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition flex flex-col items-center gap-2 ${showLogo ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
             >
                <Sparkles size={18} />
                {t("Logo/Icono", "Logo/Icon")}
             </button>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Posición del Sello", "Seal Position")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'top-left', label: 'TL' }, { id: 'top-right', label: 'TR' },
                { id: 'bottom-left', label: 'BL' }, { id: 'bottom-right', label: 'BR' }
              ].map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => setPosition(pos.id as any)}
                  className={`py-2 rounded-lg text-xs font-bold transition ${position === pos.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {image && (
            <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Estrategia de Texto", "Text Strategy")}</p>
                  <button 
                    onClick={() => {
                      const text = t(
                        `📌 Trabajo de ${profile.niche || 'calidad'} terminado con éxito en ${profile.location || 'la zona'}. \n\nAcabamos de finalizar este proyecto de ${profile.niche} asegurando la máxima satisfacción del cliente. Si buscas expertos en ${profile.location}, ¡escríbenos! \n\n#GMB #LocalAuthority #${profile.niche}`,
                        `📌 ${profile.niche || 'Quality'} job successfully completed in ${profile.location || 'the area'}. \n\nJust finished this ${profile.niche} project ensuring maximum customer satisfaction. If you are looking for experts in ${profile.location}, message us! \n\n#GMB #LocalAuthority #${profile.niche}`
                      );
                      navigator.clipboard.writeText(text);
                      if (showToast) {
                        showToast(t("Texto estratégico copiado al portapapeles. ¡Pégalo en tu GMB post!", "Strategic text copied to clipboard. Paste it in your GMB post!"), "success");
                      } else {
                        alert(t("Texto estratégico copiado al portapapeles. ¡Pégalo en tu GMB post!", "Strategic text copied to clipboard. Paste it in your GMB post!"));
                      }
                    }}
                    className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline"
                  >
                    {t("Generar y Copiar", "Generate & Copy")}
                  </button>
               </div>
               <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">
                    {t(
                      `"Menciona ${profile.location} y ${profile.niche} en tu post para que Google te asocie semánticamente con tu zona de servicio."`,
                      `"Mention ${profile.location} and ${profile.niche} in your post so Google semantically associates you with your service area."`
                    )}
                  </p>
               </div>
            </div>
          )}

          {image && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
              <button 
                onClick={() => {
                  downloadImage();
                  if (onPostCreated) onPostCreated();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
              >
                <Download size={18} />
                {t("Generar Post", "Generate Post")}
              </button>
              <button 
                onClick={() => setImage(null)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-4 rounded-2xl hover:bg-red-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Preview Canvas (Ref abstraction) */}
        <div className="lg:col-span-8">
           <div className="relative aspect-square md:aspect-video bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border-4 border-dashed border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center group">
              {image ? (
                <div ref={canvasRef} className="relative w-full h-full">
                  <img src={image} className="w-full h-full object-cover" alt="Job preview" />
                  
                  {/* Overlay Seal */}
                  <motion.div 
                    layout
                    className={`absolute p-4 m-6 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-2xl flex flex-col items-center gap-1 ${
                      position === 'top-left' ? 'top-0 left-0' :
                      position === 'top-right' ? 'top-0 right-0' :
                      position === 'bottom-left' ? 'bottom-0 left-0' :
                      'bottom-0 right-0'
                    }`}
                  >
                    {showLogo && (
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white mb-1 shadow-lg">
                        <Sparkles size={16} />
                      </div>
                    )}
                    <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-tight">{overlayText}</p>
                    {showStars && (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} fill="#f59e0b" className="text-amber-500" />)}
                      </div>
                    )}
                    <div className="mt-1 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[8px] font-bold uppercase tracking-tight">
                      {t("Reseña Verificada", "Verified Review")}
                    </div>
                  </motion.div>
                </div>
              ) : (
                <label className="text-center space-y-4 cursor-pointer w-full h-full flex flex-col items-center justify-center hover:bg-slate-100/50 dark:hover:bg-slate-900/10 transition duration-300">
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto text-slate-400 group-hover:scale-110 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition duration-300">
                    <Plus size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">{t("Arrastra una foto o haz clic para subir", "Drag a photo or click to upload")}</p>
                </label>
              )}
           </div>
           
           <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                 <Star className="text-amber-500" size={16} fill="currentColor" />
                 <span className="text-[10px] font-black uppercase text-slate-500">{t("Sello de Confianza", "Trust Seal")} v2.1</span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 italic">
                {t("Las fotos reales con contexto de trabajo aumentan la confianza y el interés del cliente.", "Real job site photos build customer trust and encourage inbound inquiries.")}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
