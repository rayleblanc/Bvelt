import React, { useState } from 'react';
import { ArrowLeft, Send, CheckCircle2, Star, Camera, Globe, ExternalLink, Copy } from 'lucide-react';

interface SubScreenProps {
  onBack: () => void;
  trade: string;
  zone: string;
}

export const EstimateFollowupScreen: React.FC<SubScreenProps> = ({ onBack, trade, zone }) => {
  const [sent, setSent] = useState(false);
  const msg = `Hola, te escribo de ${trade} en ${zone}. Tengo tu presupuesto registrado. Si aún deseas realizar el servicio esta semana, podemos coordinar la visita hoy mismo. ¿Te va bien?`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-2">
        <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
      </button>
      <h2 className="text-xl font-bold text-white">Seguimiento de Presupuestos Pendientes</h2>
      <p className="text-xs text-slate-400">
        Reactivar clientes que pidieron presupuesto y no han respondido. Destino del CTA de presupuestos.
      </p>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>Plantilla Optimizada de Conversión</span>
          <button 
            onClick={() => navigator.clipboard.writeText(msg)} 
            className="text-emerald-400 hover:underline flex items-center space-x-1"
          >
            <Copy className="w-3.5 h-3.5" /> <span>Copiar</span>
          </button>
        </div>
        <p className="text-xs text-slate-200 italic p-3 bg-slate-900 rounded-lg border border-slate-800">
          "{msg}"
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            setSent(true);
          }}
          className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4" />
          <span>Enviar Seguimiento vía WhatsApp</span>
        </button>
      </div>

      {sent && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Seguimiento despachado correctamente.</span>
        </div>
      )}
    </div>
  );
};

export const GbpAuditScreen: React.FC<SubScreenProps> = ({ onBack, trade, zone }) => {
  const [items, setItems] = useState([
    { id: 1, text: 'Horario comercial actualizado (incluyendo fines de semana)', done: false },
    { id: 2, text: `Nombre exacto del oficio (${trade}) en categoría primaria`, done: true },
    { id: 3, text: `Área de servicio configurada para cubrir ${zone}`, done: false },
    { id: 4, text: 'Al menos 5 fotos recientes con etiqueta de servicio', done: false }
  ]);

  const toggle = (id: number) => {
    setItems(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-2">
        <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
      </button>
      <h2 className="text-xl font-bold text-white">Optimizador de Google Business Profile</h2>
      <p className="text-xs text-slate-400">
        Resuelve discrepancias de ficha para evitar perder llamadas directas en {zone}.
      </p>

      <div className="space-y-2.5 pt-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => toggle(it.id)}
            className={`w-full p-3.5 rounded-xl border text-left text-xs flex items-center justify-between transition-colors ${
              it.done ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <span>{it.text}</span>
            <CheckCircle2 className={`w-4 h-4 ${it.done ? 'text-emerald-400' : 'text-slate-600'}`} />
          </button>
        ))}
      </div>

      <div className="pt-3">
        <a
          href="https://business.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700"
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>Abrir Panel Oficial de Google Business Profile</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

export const InboxLeadsScreen: React.FC<SubScreenProps> = ({ onBack, trade, zone }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-2">
        <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
      </button>
      <h2 className="text-xl font-bold text-white">Bandeja de Leads Entrantes</h2>
      <p className="text-xs text-slate-400">Gestión de contactos esperando respuesta en {zone}.</p>

      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
        <p className="font-semibold text-white mb-1">Estado de la Bandeja:</p>
        <p>No hay leads desatendidos pendientes en este momento. Las solicitudes web y de formulario se sincronizarán aquí inmediatamente al recibirse.</p>
      </div>
    </div>
  );
};

export const ReputationShieldScreen: React.FC<SubScreenProps> = ({ onBack, trade, zone }) => {
  const [copied, setCopied] = useState(false);
  const linkText = `¡Gracias por confiar en nuestros servicios de ${trade}! Si estás conforme con el trabajo, una breve reseña de 5 estrellas nos ayuda enormemente: https://g.page/r/tu-negocio/review`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-2">
        <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
      </button>
      <h2 className="text-xl font-bold text-white">Escudo de Reputación y Reseñas</h2>
      <p className="text-xs text-slate-400">
        Solicitar opiniones verificadas a clientes satisfechos en {zone}.
      </p>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
        <span className="font-semibold text-slate-300">Enlace directo para solicitar reseña por WhatsApp:</span>
        <p className="italic text-slate-400 p-3 bg-slate-900 rounded-lg">{linkText}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(linkText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5"
        >
          <Star className="w-3.5 h-3.5 fill-slate-950" />
          <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Enlace de Reseña'}</span>
        </button>
      </div>
    </div>
  );
};

export const JobEvidenceScreen: React.FC<SubScreenProps> = ({ onBack, trade, zone }) => {
  const [uploaded, setUploaded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-2">
        <ArrowLeft className="w-4 h-4" /> <span>Volver al Dashboard</span>
      </button>
      <h2 className="text-xl font-bold text-white">Evidencia Visual de Trabajos</h2>
      <p className="text-xs text-slate-400">
        Sube fotos de trabajos completados de {trade} en {zone} para respaldar cotizaciones futuras.
      </p>

      <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-8 text-center space-y-3 bg-slate-950">
        <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-400 flex items-center justify-center mx-auto">
          <Camera className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <label className="cursor-pointer py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs inline-block">
            Seleccionar Foto o Tomar con Cámara
            <input type="file" accept="image/*" className="hidden" onChange={() => setUploaded(true)} />
          </label>
          <p className="text-[11px] text-slate-500 mt-2">Formatos JPG, PNG con metadatos de ubicación local.</p>
        </div>
      </div>

      {uploaded && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Foto cargada y registrada como evidencia respaldada de {trade}.</span>
        </div>
      )}
    </div>
  );
};
