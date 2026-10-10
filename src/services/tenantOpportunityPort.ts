/*
 * RadarTenantOpportunityPort: Retrieves tenant-specific opportunities from Radar.
 * Usage: Set ENABLE_RADAR_TENANT=1 and VITE_RADAR_TENANT_URL=https://bvelt-radar....workers.dev/...
 * Enabled only when flag is set.
 */
import type { Opportunity } from './jobFinderModule.ts';

export type TenantOpportunity = Opportunity;

export interface TenantOpportunityPort {
  listOpportunities(input: { tenantId: string; city?: string; trade?: string }): Promise<TenantOpportunity[]>;
}

export class EmptyTenantOpportunityPort implements TenantOpportunityPort {
  async listOpportunities(_input: { tenantId: string; city?: string; trade?: string }): Promise<TenantOpportunity[]> {
    return [];
  }
}

export class RadarTenantOpportunityPort implements TenantOpportunityPort {
  async listOpportunities(input: { tenantId: string; city?: string; trade?: string }): Promise<TenantOpportunity[]> {
    const v1 = String(import.meta.env.VITE_ENABLE_RADAR_TENANT || '').trim().toLowerCase();
    const v2 = String(process.env.ENABLE_RADAR_TENANT || '').trim().toLowerCase();
    const isEnabled = v1 === '1' || v1 === 'true' || v2 === '1' || v2 === 'true';

    if (!isEnabled || !input.tenantId || input.tenantId === 'default-tenant') return [];

    try {
      // Use internal proxy to avoid CORS
      const response = await fetch(`/api/radar-tenant?tenantId=${encodeURIComponent(input.tenantId)}&city=${encodeURIComponent(input.city || '')}&trade=${encodeURIComponent(input.trade || '')}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return [];
      
      const data = await response.json();
      return (Array.isArray(data) ? data : []).map(item => ({
        id: item.id || `radar-${Math.random()}`,
        type: item.type || 'poi_lead',
        title: item.title,
        address: item.address,
        zone: item.zone,
        distanceMi: item.distanceMi,
        observedAt: item.observedAt || new Date().toISOString(),
        source: 'Radar Tenant Service',
        valueRange: item.valueRange,
        why: item.why,
        lat: item.lat,
        lng: item.lng,
      }));
    } catch (e) {
      // CORS or network failure - return [] to not break UI
      return [];
    }
  }
}

export function getTenantOpportunityPort(): TenantOpportunityPort {
  const v1 = String(import.meta.env.VITE_ENABLE_RADAR_TENANT || '').trim().toLowerCase();
  const v2 = String(process.env.ENABLE_RADAR_TENANT || '').trim().toLowerCase();
  const enabled = v1 === '1' || v1 === 'true' || v2 === '1' || v2 === 'true';
  return enabled ? new RadarTenantOpportunityPort() : new EmptyTenantOpportunityPort();
}
