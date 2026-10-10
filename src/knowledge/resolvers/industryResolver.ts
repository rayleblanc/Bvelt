import { COMPACT_NAICS_INDEX } from '../data/naics_index';
import { EvidenceStatus } from '../../lib/bveltEvidence';
import { getVerticalConfig, VerticalConfig } from '../verticals';

export interface IndustryResolved {
  originalQuery: string;
  canonicalIndustry: string;
  naicsCandidates: string[];
  aliases: string[];
  relatedServices: string[];
  parentIndustry?: string;
  source: 'REFERENCE' | 'CACHE' | 'FALLBACK';
  confidence: number;
}

export interface DeepNicheResolved {
  niche: string;
  subNiche?: string;
  serviceSpecialty?: string;
  naicsCode?: string;
  alternativeSignals: string[];
  evidenceStatus: EvidenceStatus;
  confidence: number;
}

export interface ProspectCommercialContext {
  businessName: string;
  primaryCategory: string;
  niche: string;
  subNiche?: string;
  serviceSpecialty?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  latitude: number | null;
  longitude: number | null;
  serviceArea?: string;
  marketRadius: number; // in km
  targetCustomer?: string;
  businessModel?: string;
  evidenceStatus: EvidenceStatus;
  missingFields: string[];
  alternativeSignals?: string[];
}

/**
 * Industry Resolver translates user natural language (e.g. "HVAC", "Plumber")
 * into Canonical NAICS categories, deep subniches, and search aliases.
 */
export class IndustryResolver {
  
  static getVerticalConfig(query?: string): VerticalConfig {
    return getVerticalConfig(query);
  }
  
  static resolve(query: string): IndustryResolved {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        originalQuery: query || '',
        canonicalIndustry: 'General Services',
        naicsCandidates: [],
        aliases: [],
        relatedServices: [],
        source: 'FALLBACK',
        confidence: 0
      };
    }
    
    // Search the compact NAICS index
    for (const [code, entry] of Object.entries(COMPACT_NAICS_INDEX)) {
      const isExactMatch = entry.title.toLowerCase() === q;
      const isAliasMatch = entry.aliases.some(alias => alias.toLowerCase() === q);
      const isPartialMatch = entry.title.toLowerCase().includes(q) || 
                             entry.aliases.some(alias => alias.toLowerCase().includes(q)) ||
                             entry.relatedTerms.some(term => term.toLowerCase().includes(q));

      if (isExactMatch || isAliasMatch || isPartialMatch) {
        let confidence = 0.5;
        if (isExactMatch) confidence = 1.0;
        else if (isAliasMatch) confidence = 0.9;
        else if (isPartialMatch) confidence = 0.7;

        return {
          originalQuery: query,
          canonicalIndustry: entry.title,
          naicsCandidates: [code],
          aliases: entry.aliases,
          relatedServices: entry.relatedTerms,
          parentIndustry: entry.parentCode ? COMPACT_NAICS_INDEX[entry.parentCode]?.title : undefined,
          source: 'REFERENCE',
          confidence
        };
      }
    }

    // Fallback if no exact match is found
    return {
      originalQuery: query,
      canonicalIndustry: query, // Use the query as a generic fallback category
      naicsCandidates: [],
      aliases: [query],
      relatedServices: [],
      source: 'FALLBACK',
      confidence: 0
    };
  }

  /**
   * Resolves deep niche hierarchy (niche -> subNiche -> serviceSpecialty)
   * backed by observable evidence (e.g. business name keywords or explicit services found).
   */
  static resolveDeepNiche(
    query: string,
    businessName?: string,
    servicesFound: string[] = []
  ): DeepNicheResolved {
    const base = this.resolve(query);
    const combinedText = `${query} ${businessName || ''} ${servicesFound.join(' ')}`.toLowerCase();

    let niche = base.canonicalIndustry;
    let subNiche: string | undefined;
    let serviceSpecialty: string | undefined;
    const alternativeSignals: string[] = [];

    // Sub-niche detection logic backed by real text evidence
    if (combinedText.includes('hvac') || combinedText.includes('ac ') || combinedText.includes('air conditioning') || combinedText.includes('climatizacion') || combinedText.includes('aire acondicionado')) {
      niche = 'HVAC & Climate Control';
      if (combinedText.includes('repair') || combinedText.includes('reparacion') || combinedText.includes('fix') || combinedText.includes('mantenimiento')) {
        subNiche = 'AC & Heating Repair';
        serviceSpecialty = 'Emergency AC Repair';
      } else if (combinedText.includes('install') || combinedText.includes('instalacion') || combinedText.includes('replacement')) {
        subNiche = 'HVAC System Installation';
        serviceSpecialty = 'Residential System Replacement';
      } else {
        subNiche = 'Residential HVAC Services';
      }
    } else if (combinedText.includes('plumb') || combinedText.includes('plomer') || combinedText.includes('fontan')) {
      niche = 'Plumbing Services';
      if (combinedText.includes('drain') || combinedText.includes('drenaje') || combinedText.includes('clog')) {
        subNiche = 'Drain Cleaning & Unclogging';
      } else if (combinedText.includes('water heater') || combinedText.includes('calentador')) {
        subNiche = 'Water Heater Installation & Repair';
      } else {
        subNiche = 'Residential & Commercial Plumbing';
      }
    } else if (combinedText.includes('roof') || combinedText.includes('techo') || combinedText.includes('techad')) {
      niche = 'Roofing Contracting';
      if (combinedText.includes('repair') || combinedText.includes('reparac')) {
        subNiche = 'Roof Repair & Leak Inspection';
      } else if (combinedText.includes('replacement') || combinedText.includes('sustitucion')) {
        subNiche = 'Full Roof Replacement';
      } else {
        subNiche = 'Residential Roofing';
      }
    } else if (combinedText.includes('restaur') || combinedText.includes('food') || combinedText.includes('comida') || combinedText.includes('cafe')) {
      niche = 'Restaurants & Dining';
      if (combinedText.includes('mexic') || combinedText.includes('taco')) {
        subNiche = 'Mexican Restaurant & Taqueria';
      } else if (combinedText.includes('pizza') || combinedText.includes('ital')) {
        subNiche = 'Pizzeria & Italian Dining';
      } else {
        subNiche = 'Casual Dining & Local Eats';
      }
    } else if (combinedText.includes('law') || combinedText.includes('abogad') || combinedText.includes('legal')) {
      niche = 'Legal Services';
      if (combinedText.includes('injury') || combinedText.includes('lesion')) {
        subNiche = 'Personal Injury Law';
      } else if (combinedText.includes('family') || combinedText.includes('familia') || combinedText.includes('divorc')) {
        subNiche = 'Family & Divorce Law';
      } else {
        subNiche = 'General Practice Legal Services';
      }
    } else if (combinedText.includes('dent') || combinedText.includes('odont')) {
      niche = 'Dental Care';
      if (combinedText.includes('ortho') || combinedText.includes('ortodon')) {
        subNiche = 'Orthodontics & Braces';
      } else if (combinedText.includes('cosmet') || combinedText.includes('estetic')) {
        subNiche = 'Cosmetic Dentistry & Whitening';
      } else {
        subNiche = 'Family Dentistry';
      }
    } else if (combinedText.includes('clean') || combinedText.includes('limpie')) {
      niche = 'Cleaning Services';
      if (combinedText.includes('carpet') || combinedText.includes('alfombra')) {
        subNiche = 'Carpet & Upholstery Cleaning';
      } else if (combinedText.includes('house') || combinedText.includes('hogar')) {
        subNiche = 'Residential House Cleaning';
      } else {
        subNiche = 'Commercial & Janitorial Cleaning';
      }
    }

    // Collect alternative signals from aliases
    if (base.aliases && base.aliases.length > 0) {
      base.aliases.forEach(a => {
        if (a.toLowerCase() !== niche.toLowerCase() && !alternativeSignals.includes(a)) {
          alternativeSignals.push(a);
        }
      });
    }

    let evidenceStatus: EvidenceStatus = 'DERIVED';
    if (servicesFound.length > 0) {
      evidenceStatus = 'VERIFIED';
    } else if (base.source === 'FALLBACK') {
      evidenceStatus = 'ESTIMATED';
    }

    return {
      niche,
      subNiche,
      serviceSpecialty,
      naicsCode: base.naicsCandidates[0],
      alternativeSignals,
      evidenceStatus,
      confidence: base.confidence > 0 ? base.confidence : 0.5
    };
  }

  /**
   * Constructs a complete, normalized ProspectCommercialContext
   */
  static buildCommercialContext(item: any): ProspectCommercialContext {
    const name = item.businessName || item.name || item.title || 'Local Business';
    const category = item.category || item.primaryCategory || item.niche || 'General Services';
    const deepNiche = this.resolveDeepNiche(category, name, item.servicesFound || []);
    
    const city = item.city || item.location?.split(',')[0]?.trim() || 'Local Market';
    const state = item.state || item.location?.split(',')[1]?.trim() || undefined;
    const country = item.country || 'US';
    const missingFields: string[] = [];

    if (!item.phone || item.phone === 'NOT_AVAILABLE') missingFields.push('phone');
    if (!item.website || item.website === 'NOT_AVAILABLE') missingFields.push('website');
    if (item.latitude === null || item.latitude === undefined) missingFields.push('coordinates');
    if (!item.postalCode && !item.zip) missingFields.push('postalCode');

    let evidenceStatus: EvidenceStatus = 'VERIFIED';
    if (missingFields.length > 2) {
      evidenceStatus = 'DERIVED';
    }
    if (!item.city && !item.location) {
      evidenceStatus = 'INSUFFICIENT_DATA';
    }

    return {
      businessName: name,
      primaryCategory: category,
      niche: deepNiche.niche,
      subNiche: deepNiche.subNiche,
      serviceSpecialty: deepNiche.serviceSpecialty,
      city,
      state,
      country,
      postalCode: item.postalCode || item.zip,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      serviceArea: item.serviceArea || `${city} & surrounding area`,
      marketRadius: item.radius || item.marketRadius || 5,
      targetCustomer: item.targetCustomer || `${deepNiche.niche} customers in ${city}`,
      businessModel: item.businessModel || 'B2C / Local Service Provider',
      evidenceStatus,
      missingFields,
      alternativeSignals: deepNiche.alternativeSignals
    };
  }
}

