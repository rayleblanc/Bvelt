export interface OpportunitySource {
  id: string;
  coverage: string[]; // e.g. ['Global', 'US-National', 'Miami-Dade']
  fetch(params: {
    trade: string;
    city?: string;
    lat: number;
    lng: number;
    radiusMi: number;
    sinceDays: number;
    testMode?: boolean;
  }): Promise<Opportunity[]>;
}

export interface Opportunity {
  id: string;
  type: 'competitor_gap' | 'permit' | 'storm' | 'poi_lead' | 'map_signal' | 'bid' | 'violation' | 'new_business';
  title: string;
  address?: string;
  zone?: string;
  distanceMi?: number;
  observedAt: string;
  source: string;
  sourceUrl?: string;
  valueRange?: {
    min: number;
    max: number;
    basis: string;
  };
  why: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
}

/**
  Haversine distance calculation in miles between two coordinates
 */
export function calcDistanceMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
