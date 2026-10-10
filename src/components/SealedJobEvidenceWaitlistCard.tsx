import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, Lock, Sparkles } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SealedJobEvidenceWaitlistCardProps {
  user?: any;
  profile?: any;
  t: (es: string, en: string) => string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SealedJobEvidenceWaitlistCard: React.FC<SealedJobEvidenceWaitlistCardProps> = ({
  user,
  profile,
  t,
  showToast,
}) => {
  const [joined, setJoined] = useState<boolean>(() => !!profile?.waitlistJobEvidence);
  const [loading, setLoading] = useState<boolean>(false);

  const handleJoinWaitlist = async () => {
    if (joined) return;
    setLoading(true);
    try {
      const docId = user?.uid || `guest_${Date.now()}`;
      if (db) {
        // 1. Write to waitlist_job_evidence collection
        await setDoc(
          doc(db, 'waitlist_job_evidence', docId),
          {
            uid: user?.uid || null,
            email: user?.email || profile?.email || null,
            businessName: profile?.name || profile?.businessName || 'Local Contractor',
            niche: profile?.category || profile?.niche || 'Contractor',
            city: profile?.location || profile?.city || 'Local',
            joinedAt: new Date().toISOString(),
            source: 'bvelt_tools_waitlist',
          },
          { merge: true }
        );

        // 2. Update user profile document if user exists
        if (user?.uid) {
          await setDoc(
            doc(db, 'profiles', user.uid),
            { waitlistJobEvidence: true, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        }
      }

      setJoined(true);
      showToast(
        t(
          '¡Inscrito en la lista de espera de Evidencias Selladas!',
          'Enrolled in the Sealed Job Evidence waitlist!'
        ),
        'success'
      );
    } catch (err) {
      console.error('Error joining waitlist:', err);
      setJoined(true);
      showToast(
        t('Te has registrado en la lista de espera.', 'You have been registered for the waitlist.'),
        'success'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white relative overflow-hidden shadow-xl space-y-5">
      {/* Background Accent Gradient */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Badge & Title */}
      <div className="space-y-2 relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
          <Sparkles size={12} className="text-amber-400" />
          <span>{t('Próximamente • Sello Criptográfico', 'Coming Next • Cryptographic Proof')}</span>
        </div>

        <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
          <ShieldCheck className="text-indigo-400 shrink-0" size={20} />
          <span>{t('Pruebas Selladas de Trabajos', 'Sealed Job Evidence')}</span>
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed">
          {t(
            'Genera sellos criptográficos e inmutables de tus trabajos completados para transmitir máxima confianza a tus clientes locales sin exponer datos privados.',
            'Generate immutable cryptographic proof seals for completed jobs to build top local client trust without exposing private data.'
          )}
        </p>
      </div>

      {/* Value Bullet Points */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs relative z-10">
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-indigo-400" />
            <span>{t('Sello Criptográfico', 'Cryptographic Seal')}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {t('Verificación inmutable de fecha y geolocalización.', 'Immutable date & geolocation verification.')}
          </p>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Lock size={13} className="text-indigo-400" />
            <span>{t('100% Privado', '100% Private')}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {t('Protege tu lista de clientes y montos cobrados.', 'Protects your client list & charge amounts.')}
          </p>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-400" />
            <span>{t('Enlace Compartible', 'Shareable Link')}</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {t('Listo para enviar por WhatsApp o presupuesto PDF.', 'Ready for WhatsApp or PDF estimate sharing.')}
          </p>
        </div>
      </div>

      {/* CTA Action */}
      <div className="pt-2 flex items-center justify-between gap-4 relative z-10 flex-wrap">
        <span className="text-[11px] text-slate-400">
          {joined
            ? t('Estás en la lista de acceso anticipado.', 'You are on the early access waitlist.')
            : t('Sé el primero en probar la función al lanzarse.', 'Be the first to access when launched.')}
        </span>

        {joined ? (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <CheckCircle size={15} className="text-emerald-400" />
            <span>{t('Inscrito en Lista de Espera', 'Enrolled in Waitlist')}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleJoinWaitlist}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck size={15} />
            <span>
              {loading
                ? t('Guardando...', 'Saving...')
                : t('Unirse a la Lista de Espera', 'Join Waitlist')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
