import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface RouteProperty {
  id: string;
  address: string;
  client: string;
  status: 'pending' | 'completed' | string;
  lat?: number;
  lng?: number;
}

interface RouteLeafletMapProps {
  center: { lat?: number; lng?: number };
  properties: RouteProperty[];
  businessName?: string;
  language?: 'es' | 'en';
}

export const RouteLeafletMap: React.FC<RouteLeafletMapProps> = ({
  center,
  properties,
  businessName,
  language = 'es',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);

  const defaultLat = center?.lat && !isNaN(center.lat) ? center.lat : 25.7617;
  const defaultLng = center?.lng && !isNaN(center.lng) ? center.lng : -80.1918;

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      // Free OpenStreetMap Tiles (100% free open-source, no Google Maps API key required)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      routeGroupRef.current = L.layerGroup().addTo(map);
    }

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
        routeGroupRef.current = null;
      }
    };
  }, []);

  // Update markers, route polyline, and view bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeGroupRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    const startPos: [number, number] = [defaultLat, defaultLng];
    const allCoords: [number, number][] = [startPos];

    // 1. Business Home Base Pin
    const baseDivHtml = `
      <div class="relative flex items-center justify-center w-9 h-9 bg-slate-900 border-2 border-indigo-400 rounded-2xl shadow-xl text-white">
        <span class="text-sm">🏢</span>
        <div class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-slate-900"></div>
      </div>
    `;
    const baseIcon = L.divIcon({
      className: 'custom-div-icon',
      html: baseDivHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const baseMarker = L.marker(startPos, { icon: baseIcon, zIndexOffset: 800 });
    baseMarker.bindTooltip(
      `<div class="font-bold text-xs">${businessName || (language === 'es' ? 'Sede Central' : 'Headquarters')}</div>`,
      { permanent: false, direction: 'top', offset: [0, -18] }
    );
    routeGroup.addLayer(baseMarker);

    // 2. Stop Markers & Route Polyline
    properties.forEach((prop, idx) => {
      // Offset coords slightly if not provided to simulate geographic spacing around city center
      const lat = (typeof prop.lat === 'number' && !isNaN(prop.lat))
        ? prop.lat
        : defaultLat + (idx % 2 === 0 ? 0.012 : -0.012) * ((idx + 1) * 0.7);
      const lng = (typeof prop.lng === 'number' && !isNaN(prop.lng))
        ? prop.lng
        : defaultLng + (idx % 3 === 0 ? 0.015 : -0.015) * ((idx + 1) * 0.6);

      const stopPos: [number, number] = [lat, lng];
      allCoords.push(stopPos);

      const isDone = prop.status === 'completed';
      const stopDivHtml = `
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-black text-white text-xs ${
          isDone ? 'bg-emerald-500' : 'bg-indigo-600 ring-2 ring-indigo-300 ring-offset-1 ring-offset-slate-900'
        } transition-transform hover:scale-125 cursor-pointer">
          ${isDone ? '✓' : idx + 1}
        </div>
      `;

      const stopIcon = L.divIcon({
        className: 'custom-div-icon',
        html: stopDivHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const stopMarker = L.marker(stopPos, { icon: stopIcon, zIndexOffset: 900 + idx });
      stopMarker.bindTooltip(
        `<div class="font-extrabold text-xs">#${idx + 1}: ${prop.address}</div><div class="text-[10px] text-slate-300">${prop.client} • ${isDone ? (language === 'es' ? 'Completado' : 'Completed') : (language === 'es' ? 'Pendiente' : 'Pending')}</div>`,
        { permanent: false, direction: 'top', offset: [0, -16] }
      );
      routeGroup.addLayer(stopMarker);
    });

    // 3. Draw Route Connecting Line
    if (allCoords.length > 1) {
      const routeLine = L.polyline(allCoords, {
        color: '#6366f1',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 8',
      });
      routeGroup.addLayer(routeLine);

      // Fit map to show all stops nicely
      try {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch (err) {
        console.warn('Silent Leaflet bounds error:', err);
      }
    } else {
      map.setView(startPos, 12);
    }
  }, [properties, defaultLat, defaultLng, businessName, language]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full min-h-[320px] rounded-[2.5rem] z-0" />
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-[10px] font-bold text-slate-200">
            {language === 'es' ? 'Ruta Inteligente (OpenStreetMap)' : 'Smart Route (OpenStreetMap)'}
          </p>
        </div>
      </div>
    </div>
  );
};
