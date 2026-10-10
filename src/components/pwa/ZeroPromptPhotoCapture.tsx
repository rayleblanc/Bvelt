import React, { useState, useRef } from 'react';
import { Camera, MapPin, Calendar, Smartphone, CheckCircle, Upload, ShieldCheck, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { extractExifFromBlob, ExifData } from '../../lib/pwa/exifExtractor';
import { offlineStore, OfflinePhotoRecord } from '../../lib/pwa/offlineStore';
import { offlineSyncEngine } from '../../lib/pwa/offlineSync';

interface ZeroPromptPhotoCaptureProps {
  businessId?: string;
  entityId?: string;
  category?: 'JOB_PROOF' | 'GBP_UPDATE' | 'VISUAL_ESTIMATE' | 'REPUTATION_ASSET';
  lang?: 'es' | 'en';
  onPhotoCaptured?: (photo: OfflinePhotoRecord) => void;
  className?: string;
}

export const ZeroPromptPhotoCapture: React.FC<ZeroPromptPhotoCaptureProps> = ({
  businessId,
  entityId,
  category = 'JOB_PROOF',
  lang = 'es',
  onPhotoCaptured,
  className = ''
}) => {
  const finalBusinessId = entityId || businessId || 'default';
  const [processing, setProcessing] = useState<boolean>(false);
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState<OfflinePhotoRecord | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<OfflinePhotoRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (es: string, en: string) => (lang === 'es' ? es : en);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setProcessing(true);

    try {
      // 1. Binary EXIF extraction without user prompt hurdle
      const exif: ExifData = await extractExifFromBlob(file);

      // 2. Save directly to local offline store
      const validCategories = ['JOB_PROOF', 'GBP_UPDATE', 'VISUAL_ESTIMATE', 'REPUTATION_ASSET'] as const;
      const photoCategory = (validCategories.includes(category as any) ? category : 'JOB_PROOF') as 'JOB_PROOF' | 'GBP_UPDATE' | 'VISUAL_ESTIMATE' | 'REPUTATION_ASSET';

      const savedRecord = await offlineStore.saveOfflinePhoto({
        businessId: finalBusinessId,
        category: photoCategory,
        caption: `Zero-Prompt Evidence: ${file.name}`,
        blob: file,
        dataUrl: URL.createObjectURL(file),
        exif
      });

      setLastCapturedPhoto(savedRecord);
      setRecentPhotos(prev => [savedRecord, ...prev]);

      if (onPhotoCaptured) {
        onPhotoCaptured(savedRecord);
      }

      // 3. Attempt sync if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        offlineSyncEngine.syncAll().catch(() => {});
      }
    } catch (err) {
      console.error('[ZeroPromptPhoto] Error processing photo:', err);
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div id="zero-prompt-photo-capture" className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">
              {t('Captura de Evidencia Fotográfica (Zero-Prompt)', 'Photo Evidence Capture (Zero-Prompt)')}
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Extracción automática de metadatos EXIF (GPS, fecha exacta y dispositivo). Funciona 100% sin conexión.',
              'Automatic EXIF extraction (GPS, timestamp, and device). Operates 100% offline.'
            )}
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            id="input-zero-prompt-camera"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition"
          >
            {processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('Extrayendo EXIF...', 'Extracting EXIF...')}</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>{t('Tomar Foto / Subir', 'Take Photo / Upload')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Captured Card */}
      {lastCapturedPhoto && (
        <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              {t('Foto Verificada y Guardada en Dispositivo', 'Photo Verified & Saved on Device')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {lastCapturedPhoto.exif.source}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {lastCapturedPhoto.dataUrl && (
              <img
                src={lastCapturedPhoto.dataUrl}
                alt="Captured Proof"
                className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-slate-800 shadow-md shrink-0"
              />
            )}

            <div className="space-y-1.5 text-xs text-slate-300 flex-1">
              {lastCapturedPhoto.exif.hasGps && lastCapturedPhoto.exif.latitude !== undefined && (
                <div className="flex items-center gap-1.5 text-emerald-300 font-mono">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    GPS: {lastCapturedPhoto.exif.latitude.toFixed(5)}, {lastCapturedPhoto.exif.longitude?.toFixed(5)}
                    {lastCapturedPhoto.exif.altitude ? ` (${Math.round(lastCapturedPhoto.exif.altitude)}m)` : ''}
                  </span>
                </div>
              )}

              {lastCapturedPhoto.exif.dateTime && (
                <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{new Date(lastCapturedPhoto.exif.dateTime).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')}</span>
                </div>
              )}

              {(lastCapturedPhoto.exif.model || lastCapturedPhoto.exif.make) && (
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{lastCapturedPhoto.exif.make} {lastCapturedPhoto.exif.model}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 pt-1">
                {t(
                  'El registro criptográfico se integrará en el Ledger de Evidencia de tu negocio.',
                  'Cryptographic record will be indexed in your business Evidence Ledger.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
