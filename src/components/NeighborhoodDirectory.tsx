
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Map, Download, Star, TrendingUp, Search, Info, MapPin } from 'lucide-react';

interface Neighborhood {
  id: string;
  name: string;
  category: 'Premium' | 'Growing' | 'Elite' | 'Established';
  reach: string;
  profitability: number; // 1-5
}

interface NeighborhoodDirectoryProps {
  location: string;
  t: (es: string, en: string) => string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const NeighborhoodDirectory = ({ location, t, showToast }: NeighborhoodDirectoryProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Map className="text-emerald-500" />
              {t("Directorio de Zonificación y Vecindarios", "Zoning & Neighborhood Directory")}
            </h2>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
              INSUFFICIENT_DATA
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
            {t(`Mapeo de vecindarios para ${location || 'Mercado Local'}`, `Neighborhood mapping for ${location || 'Local Market'}`)}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 text-center border border-slate-200/60 dark:border-slate-700/60">
        <MapPin className="mx-auto text-slate-400 mb-3" size={32} />
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1 uppercase tracking-wider">
          {t("Datos Geográficos Específicos No Disponibles", "Specific Geographic Neighborhood Data Unavailable")}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
          {t(`No se han cargado límites o sub-barrios GIS verificados para ${location || 'tu ciudad'}. Los nombres de zonas no se inventan sin evidencia de mapas oficiales.`, `Verified GIS/OSM neighborhood boundaries have not been loaded for ${location || 'your city'}. Neighborhood names are not fabricated without official map evidence.`)}
        </p>
      </div>
    </div>
  );
};
