import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface RealCompetitor {
  id?: string | number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rank: number;
  trend?: 'up' | 'down' | 'stable';
  blindspotEs: string;
  blindspotEn: string;
  actionEs: string;
  actionEn: string;
  hasMovement?: boolean;
  movementLabel?: string;
  rating?: number;
  reviewsCount?: number;
  category?: string;
  phone?: string;
  website?: string;
  address?: string;
}

interface AuditLeafletMapProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  userBusinessName: string;
  competitors: RealCompetitor[];
  selectedCompetitorIndex: number | null;
  onSelectCompetitor: (index: number | null) => void;
  isScanning?: boolean;
  language?: 'es' | 'en';
  emptyMessage?: string;
  onRetryRadius?: (radius: number) => void;
}

export const AuditLeafletMap: React.FC<AuditLeafletMapProps> = ({
  center,
  radiusKm,
  userBusinessName,
  competitors,
  selectedCompetitorIndex,
  onSelectCompetitor,
  isScanning = false,
  language = 'es',
  emptyMessage,
  onRetryRadius,
}) => {
  const [mapStyle, setMapStyle] = React.useState<'voyager' | 'light' | 'dark'>('voyager');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const TILE_URLS = {
    voyager: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  // Helper to safely obtain lat/lng numbers with fallback
  const getSafeLatLng = (
    c?: { lat?: number; lng?: number; lon?: number },
    defaultLat = 25.7617,
    defaultLng = -80.1918
  ): [number, number] => {
    if (!c) return [defaultLat, defaultLng];
    const lat = typeof c.lat === 'number' && !isNaN(c.lat) ? c.lat : defaultLat;
    const rawLng = c.lng ?? c.lon;
    const lng = typeof rawLng === 'number' && !isNaN(rawLng) ? rawLng : defaultLng;
    return [lat, lng];
  };

  const centerPos = getSafeLatLng(center);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: centerPos,
        zoom: radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : 11,
        zoomControl: false,
        attributionControl: true,
      });

      // OpenStreetMap Tiles (100% free, reliable, no API key required)
      const tileLayer = L.tileLayer(TILE_URLS[mapStyle] || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Add custom small zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    // Resize observer to handle container size changes smoothly
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    observer.observe(mapContainerRef.current);

    return () => {
      observer.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch (err) {
          console.warn('Silent Leaflet cleanup error:', err);
        }
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Handle map tile style updates
  useEffect(() => {
    if (tileLayerRef.current && TILE_URLS[mapStyle]) {
      tileLayerRef.current.setUrl(TILE_URLS[mapStyle]);
    }
  }, [mapStyle]);

  // Update center, zoom, circle, and markers when props change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    if (!map || !markersGroup) return;

    // Clear previous markers & circles
    markersGroup.clearLayers();

    // Set map center
    const targetZoom = radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : 11;
    const currentCenter = getSafeLatLng(center);
    map.setView(currentCenter, targetZoom, { animate: false });

    // 1. Draw radius coverage circle
    const circle = L.circle(currentCenter, {
      radius: radiusKm * 1000,
      color: '#6366f1',
      fillColor: '#6366f1',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 8',
    });
    markersGroup.addLayer(circle);

    // 2. User Business Pin (Blue/Indigo with Star)
    const userDivHtml = `
      <div class="relative flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.8)] border-2 border-white text-white transform hover:scale-110 transition-transform">
        <svg class="w-5 h-5 fill-current text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'custom-div-icon',
      html: userDivHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const userMarker = L.marker(currentCenter, { icon: userIcon, zIndexOffset: 1000 });
    userMarker.bindTooltip(
      `<div class="font-extrabold text-xs text-indigo-300 flex items-center gap-1"><span>⭐ ${userBusinessName || (language === 'es' ? 'Tu Negocio' : 'Your Business')}</span></div>`,
      { permanent: false, direction: 'top', offset: [0, -20] }
    );
    markersGroup.addLayer(userMarker);

    // 3. Competitor Pins (only render pins for businesses with valid real coordinates)
    competitors.forEach((comp, idx) => {
      if (
        typeof comp.lat !== 'number' || isNaN(comp.lat) ||
        typeof comp.lng !== 'number' || isNaN(comp.lng)
      ) {
        return; // Skip drawing geographical pin if real coordinates are missing
      }

      const compPos: [number, number] = [comp.lat, comp.lng];
      const isSelected = selectedCompetitorIndex === idx;
      const ringClass = isSelected ? 'ring-4 ring-white scale-125 z-50' : 'hover:scale-110 opacity-90 hover:opacity-100';

      const compDivHtml = `
        <div class="relative flex flex-col items-center group cursor-pointer">
          <div class="w-7 h-7 rounded-full ${comp.hasMovement ? 'bg-amber-600 shadow-[0_0_14px_rgba(217,119,6,0.9)] ring-2 ring-amber-300' : 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.7)]'} ${ringClass} transition-all flex items-center justify-center text-white font-black text-xs border border-white/80">
            ${comp.hasMovement ? '⚡' : '📍'}
          </div>
          <div class="mt-1 px-1.5 py-0.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 rounded text-[9px] font-bold text-slate-200 whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none max-w-[110px] truncate">
            ${comp.name}
          </div>
          ${comp.movementLabel ? `<div class="px-1 py-0.2 bg-amber-500 text-slate-950 font-black text-[8px] rounded uppercase shadow-sm pointer-events-none -mt-0.5">${comp.movementLabel}</div>` : ''}
        </div>
      `;

      const compIcon = L.divIcon({
        className: 'custom-div-icon',
        html: compDivHtml,
        iconSize: [36, 52],
        iconAnchor: [18, 18],
      });

      const compMarker = L.marker(compPos, { icon: compIcon, zIndexOffset: isSelected ? 900 : 500 });

      compMarker.on('click', () => {
        onSelectCompetitor(idx);
      });

      const tooltipContent = comp.hasMovement
        ? `<div class="font-bold text-xs text-white flex items-center gap-1.5"><span class="text-amber-400 font-black">⚡ ${comp.movementLabel || (language === 'es' ? 'Movimiento Detectado' : 'Movement Detected')}</span><span>• ${comp.name}</span></div>`
        : `<div class="font-bold text-xs text-white">${comp.name}</div>`;

      compMarker.bindTooltip(
        tooltipContent,
        { permanent: false, direction: 'top', offset: [0, -16] }
      );

      markersGroup.addLayer(compMarker);
    });

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
        } catch (err) {
          // ignore
        }
      }
    };
  }, [center, radiusKm, competitors, selectedCompetitorIndex, userBusinessName, language]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />

      {/* Floating Map Style Selector */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-2xl text-xs font-semibold">
        <button
          onClick={() => setMapStyle('voyager')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            mapStyle === 'voyager'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={language === 'es' ? 'Mapa Claro con Calles' : 'Clear Map with Streets'}
        >
          <span>🗺️</span>
          <span>{language === 'es' ? 'Claro' : 'Clear'}</span>
        </button>
        <button
          onClick={() => setMapStyle('light')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            mapStyle === 'light'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={language === 'es' ? 'Mapa Blanco Minimalista' : 'Minimal Light Map'}
        >
          <span>☀️</span>
          <span>{language === 'es' ? 'Blanco' : 'Light'}</span>
        </button>
        <button
          onClick={() => setMapStyle('dark')}
          className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
            mapStyle === 'dark'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={language === 'es' ? 'Mapa Oscuro' : 'Dark Map'}
        >
          <span>🌙</span>
          <span>{language === 'es' ? 'Oscuro' : 'Dark'}</span>
        </button>
      </div>

      {/* Scanning Overlay Animation */}
      {isScanning && (
        <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-[1px] pointer-events-none flex items-center justify-center z-[1000]">
          <div className="w-48 h-48 rounded-full border-2 border-indigo-500/40 animate-ping absolute"></div>
          <div className="px-4 py-2 bg-slate-900/90 border border-indigo-500/40 rounded-full text-indigo-300 font-extrabold text-xs flex items-center gap-2 shadow-2xl animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
            {language === 'es' ? 'Escaneando nodos reales OSM...' : 'Scanning real OSM nodes...'}
          </div>
        </div>
      )}

      {/* Sparse / Zero Competitors Message Overlay */}
      {competitors.length === 0 && !isScanning && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 max-w-sm bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl z-[1000] text-white">
          <div className="flex items-start gap-2.5">
            <span className="text-base mt-0.5 shrink-0">📍</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-snug text-slate-100">
                {emptyMessage || (language === 'es'
                  ? `No se encontraron competidores directos en ${radiusKm} km — amplía el radio en los controles del mapa.`
                  : `No direct competitors found in ${radiusKm} km — expand radius using map controls.`)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
