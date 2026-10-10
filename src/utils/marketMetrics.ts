export interface MarketData {
  niche: string;
  location: string;
  avgTicket: number;
  monthlyDemand: number;
  estimatedLostRevenue: number;
  projectedROI: number;
  conversionRate: number;
  competition: string;
  difficulty: string;
  top3Views: number;
  tierName: string;
  tierMinLostRevenue: number;
  tierMaxLostRevenue: number;
  tierMinAvgTicket: number;
  tierMaxAvgTicket: number;
}

export interface MarketMetricsOptions {
  isGmbConnected?: boolean;
  realImpressions?: number;
  userAvgTicket?: number;
}

export interface TierConfig {
  id: string;
  tierName: string;
  avgTicketRange: [number, number];
  lostRevenueRange: [number, number];
  defaultAvgTicket: number;
  defaultLostRevenue: number;
  defaultMonthlyDemand: number;
  conversionRate: number;
  competition: string;
  difficulty: string;
  keywords: string[];
}

export const NICHE_TIERS: Record<string, TierConfig> = {
  high_value: {
    id: "high_value",
    tierName: "Alto Valor / Grandes Contratistas",
    avgTicketRange: [5000, 15000],
    lostRevenueRange: [18000, 45000],
    defaultAvgTicket: 8500,
    defaultLostRevenue: 28500,
    defaultMonthlyDemand: 380,
    conversionRate: 0.04,
    competition: "MUY ALTA",
    difficulty: "ALTA",
    keywords: [
      "roofing", "roof", "techos", "techo", "solar", "commercial contracting", "commercial contractor",
      "water damage", "restoration", "daños por agua", "construction", "construccion",
      "remodeling", "remodelacion", "general contractor", "contratista general", "foundation repair",
      "heavy equipment", "industrial", "flooring installation", "piso industrial"
    ]
  },
  residential_services: {
    id: "residential_services",
    tierName: "Servicios Residenciales",
    avgTicketRange: [400, 1200],
    lostRevenueRange: [4500, 12000],
    defaultAvgTicket: 750,
    defaultLostRevenue: 7800,
    defaultMonthlyDemand: 580,
    conversionRate: 0.07,
    competition: "ALTA",
    difficulty: "ALTA",
    keywords: [
      "hvac", "cooling", "climatizacion", "air conditioning", "aire acondicionado", "clima", "heating", "plumbing", "plomeria",
      "electrical", "electricista", "electrician", "tree service", "arboles", "landscaping",
      "jardineria", "locksmith", "cerrajeria", "pest control", "control de plagas", "painting",
      "pintura", "painter", "garage door", "puertas de garaje", "appliance repair",
      "reparacion de electrodomesticos", "pool service", "piscina", "handyman"
    ]
  },
  professional_health: {
    id: "professional_health",
    tierName: "Servicios Profesionales y Salud",
    avgTicketRange: [200, 800],
    lostRevenueRange: [3000, 8500],
    defaultAvgTicket: 450,
    defaultLostRevenue: 5400,
    defaultMonthlyDemand: 680,
    conversionRate: 0.06,
    competition: "ALTA",
    difficulty: "MEDIO",
    keywords: [
      "dentist", "dentista", "dental", "lawyer", "abogado", "attorney", "law", "legal", "medspa",
      "spa medico", "auto repair", "taller mecanico", "mecanico", "mechanic", "chiropractor",
      "quiropractico", "real estate", "inmobiliaria", "realtor", "accounting", "contabilidad",
      "accountant", "vet", "veterinaria", "veterinarian", "optometrist", "optometrista",
      "physical therapy", "fisioterapia", "dermatologist", "dermatologo", "clinic", "clinica"
    ]
  },
  lifestyle_mass: {
    id: "lifestyle_mass",
    tierName: "Estilo de Vida y Consumo Masivo",
    avgTicketRange: [25, 75],
    lostRevenueRange: [800, 2500],
    defaultAvgTicket: 45,
    defaultLostRevenue: 1650,
    defaultMonthlyDemand: 1100,
    conversionRate: 0.08,
    competition: "MEDIA",
    difficulty: "BAJA",
    keywords: [
      "restaurant", "restaurante", "barber", "barberia", "barbershop", "beauty salon", "salon de belleza",
      "estetica", "hair salon", "pizzeria", "cafe", "cafeteria", "bakery", "panaderia",
      "cleaning", "limpieza", "house cleaning", "maid", "pet grooming", "peluqueria canina",
      "spa", "gym", "gimnasio", "car wash", "lavado de autos", "laundry", "lavanderia", "nail salon", "uñas",
      "coffee", "food truck", "taqueria"
    ]
  }
};

interface SpecificNicheOverride {
  tierId: string;
  avgTicket: number;
  lostRevenue: number;
  monthlyDemand: number;
}

const SPECIFIC_NICHE_CATALOG: Record<string, SpecificNicheOverride> = {
  // Tier 1: High Value ($5k-$15k ticket, $18k-$45k loss)
  "roofing": { tierId: "high_value", avgTicket: 8500, lostRevenue: 32000, monthlyDemand: 420 },
  "techos": { tierId: "high_value", avgTicket: 8500, lostRevenue: 32000, monthlyDemand: 420 },
  "solar": { tierId: "high_value", avgTicket: 12500, lostRevenue: 38000, monthlyDemand: 380 },
  "water damage": { tierId: "high_value", avgTicket: 6500, lostRevenue: 24000, monthlyDemand: 320 },
  "daños por agua": { tierId: "high_value", avgTicket: 6500, lostRevenue: 24000, monthlyDemand: 320 },
  "commercial contracting": { tierId: "high_value", avgTicket: 14000, lostRevenue: 42000, monthlyDemand: 280 },
  "construction": { tierId: "high_value", avgTicket: 11000, lostRevenue: 39000, monthlyDemand: 350 },
  "construccion": { tierId: "high_value", avgTicket: 11000, lostRevenue: 39000, monthlyDemand: 350 },
  "remodeling": { tierId: "high_value", avgTicket: 9500, lostRevenue: 29000, monthlyDemand: 360 },

  // Tier 2: Residential ($400-$1,200 ticket, $4.5k-$12k loss)
  "hvac / air conditioning": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "hvac & cooling": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "hvac and cooling": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "cooling": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "climatizacion": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "hvac": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "aire_acondicionado": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "aire acondicionado": { tierId: "residential_services", avgTicket: 850, lostRevenue: 8190, monthlyDemand: 650 },
  "plumbing": { tierId: "residential_services", avgTicket: 550, lostRevenue: 6800, monthlyDemand: 720 },
  "plomeria": { tierId: "residential_services", avgTicket: 550, lostRevenue: 6800, monthlyDemand: 720 },
  "electrical": { tierId: "residential_services", avgTicket: 650, lostRevenue: 7200, monthlyDemand: 580 },
  "electricista": { tierId: "residential_services", avgTicket: 650, lostRevenue: 7200, monthlyDemand: 580 },
  "tree service": { tierId: "residential_services", avgTicket: 950, lostRevenue: 9200, monthlyDemand: 480 },
  "landscaping": { tierId: "residential_services", avgTicket: 480, lostRevenue: 5200, monthlyDemand: 620 },
  "jardineria": { tierId: "residential_services", avgTicket: 480, lostRevenue: 5200, monthlyDemand: 620 },
  "locksmith": { tierId: "residential_services", avgTicket: 420, lostRevenue: 4800, monthlyDemand: 850 },
  "cerrajeria": { tierId: "residential_services", avgTicket: 420, lostRevenue: 4800, monthlyDemand: 850 },
  "pest control": { tierId: "residential_services", avgTicket: 450, lostRevenue: 5100, monthlyDemand: 540 },

  // Tier 3: Professional & Health ($200-$800 ticket, $3k-$8.5k loss)
  "dentist": { tierId: "professional_health", avgTicket: 650, lostRevenue: 6800, monthlyDemand: 750 },
  "dentista": { tierId: "professional_health", avgTicket: 650, lostRevenue: 6800, monthlyDemand: 750 },
  "lawyer": { tierId: "professional_health", avgTicket: 750, lostRevenue: 7800, monthlyDemand: 520 },
  "abogado": { tierId: "professional_health", avgTicket: 750, lostRevenue: 7800, monthlyDemand: 520 },
  "auto repair": { tierId: "professional_health", avgTicket: 380, lostRevenue: 4800, monthlyDemand: 820 },
  "taller mecanico": { tierId: "professional_health", avgTicket: 380, lostRevenue: 4800, monthlyDemand: 820 },
  "medspa": { tierId: "professional_health", avgTicket: 480, lostRevenue: 5600, monthlyDemand: 610 },
  "chiropractor": { tierId: "professional_health", avgTicket: 250, lostRevenue: 3400, monthlyDemand: 590 },
  "real estate": { tierId: "professional_health", avgTicket: 780, lostRevenue: 8200, monthlyDemand: 640 },

  // Tier 4: Lifestyle & Mass ($25-$75 ticket, $800-$2.5k loss)
  "restaurant": { tierId: "lifestyle_mass", avgTicket: 45, lostRevenue: 2200, monthlyDemand: 1450 },
  "restaurante": { tierId: "lifestyle_mass", avgTicket: 45, lostRevenue: 2200, monthlyDemand: 1450 },
  "barber shop": { tierId: "lifestyle_mass", avgTicket: 35, lostRevenue: 1400, monthlyDemand: 1100 },
  "barberia": { tierId: "lifestyle_mass", avgTicket: 35, lostRevenue: 1400, monthlyDemand: 1100 },
  "beauty salon": { tierId: "lifestyle_mass", avgTicket: 65, lostRevenue: 1800, monthlyDemand: 980 },
  "salon de belleza": { tierId: "lifestyle_mass", avgTicket: 65, lostRevenue: 1800, monthlyDemand: 980 },
  "cleaning": { tierId: "lifestyle_mass", avgTicket: 70, lostRevenue: 2100, monthlyDemand: 890 },
  "limpieza": { tierId: "lifestyle_mass", avgTicket: 70, lostRevenue: 2100, monthlyDemand: 890 },
  "cafe": { tierId: "lifestyle_mass", avgTicket: 25, lostRevenue: 950, monthlyDemand: 1600 },
  "cafeteria": { tierId: "lifestyle_mass", avgTicket: 25, lostRevenue: 950, monthlyDemand: 1600 }
};

export const classifyNiche = (niche: string) => {
  const safeNiche = (niche && niche.trim() && niche !== 'undefined' && niche !== 'null') 
    ? niche.trim() 
    : 'General Services';

  const cleanKey = safeNiche.toLowerCase();

  // 1. Check exact match in SPECIFIC_NICHE_CATALOG
  if (SPECIFIC_NICHE_CATALOG[cleanKey]) {
    const spec = SPECIFIC_NICHE_CATALOG[cleanKey];
    const tier = NICHE_TIERS[spec.tierId] || NICHE_TIERS.residential_services;
    return {
      tier,
      baseAvgTicket: spec.avgTicket,
      baseLostRevenue: spec.lostRevenue,
      baseMonthlyDemand: spec.monthlyDemand,
      conversionRate: tier.conversionRate,
      competition: tier.competition,
      difficulty: tier.difficulty,
      tierName: tier.tierName
    };
  }

  // 2. Keyword match in any tier keyword list
  for (const tierKey of ["high_value", "residential_services", "professional_health", "lifestyle_mass"]) {
    const tier = NICHE_TIERS[tierKey];
    if (tier.keywords.some(kw => cleanKey.includes(kw))) {
      return {
        tier,
        baseAvgTicket: tier.defaultAvgTicket,
        baseLostRevenue: tier.defaultLostRevenue,
        baseMonthlyDemand: tier.defaultMonthlyDemand,
        conversionRate: tier.conversionRate,
        competition: tier.competition,
        difficulty: tier.difficulty,
        tierName: tier.tierName
      };
    }
  }

  // 3. Fallback: Deterministic string hash to map smoothly into 1 of 4 tiers
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < cleanKey.length; i++) {
    hash ^= cleanKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  const tierKeys = ["residential_services", "professional_health", "lifestyle_mass", "high_value"];
  const selectedTierKey = tierKeys[hash % tierKeys.length];
  const tier = NICHE_TIERS[selectedTierKey];

  const ticketSpan = tier.avgTicketRange[1] - tier.avgTicketRange[0];
  const lostRevSpan = tier.lostRevenueRange[1] - tier.lostRevenueRange[0];

  const derivedTicket = tier.avgTicketRange[0] + Math.round(((hash % 100) / 100) * ticketSpan);
  const derivedLostRev = tier.lostRevenueRange[0] + Math.round((((hash / 100) % 100) / 100) * lostRevSpan);

  return {
    tier,
    baseAvgTicket: derivedTicket,
    baseLostRevenue: derivedLostRev,
    baseMonthlyDemand: tier.defaultMonthlyDemand,
    conversionRate: tier.conversionRate,
    competition: tier.competition,
    difficulty: tier.difficulty,
    tierName: tier.tierName
  };
};

export const getLocationMultiplier = (location: string): number => {
  if (!location) return 1.0;
  const q = location.toLowerCase();
  
  if (q.includes('new york') || q.includes('san francisco') || q.includes('chicago') || q.includes('miami') || q.includes('london') || q.includes('los angeles')) {
    return 1.15;
  }
  if (q.includes('orlando') || q.includes('houston') || q.includes('dallas') || q.includes('austin') || q.includes('madrid') || q.includes('barcelona')) {
    return 1.05;
  }
  if (q.includes('mexico') || q.includes('bogota') || q.includes('lima') || q.includes('buenos aires')) {
    return 0.85;
  }
  return 1.0;
};

import { MarketReferenceEngine, IndustryResolver } from "../knowledge";

export const getMarketData = (
  niche: string,
  location: string,
  options: MarketMetricsOptions = {}
): MarketData => {
  const safeNiche = (niche && niche.trim() && niche !== 'undefined' && niche !== 'null') 
    ? niche.trim() 
    : 'General Services';
  const safeLocation = (location && location.trim() && location !== 'undefined' && location !== 'null') 
    ? location.trim() 
    : 'Local Market';

  const classified = classifyNiche(safeNiche);
  const locMult = getLocationMultiplier(safeLocation);

  const rawTicket = options.userAvgTicket && options.userAvgTicket > 0
    ? options.userAvgTicket
    : Math.round(classified.baseAvgTicket * locMult);
  const avgTicket = options.userAvgTicket && options.userAvgTicket > 0
    ? options.userAvgTicket
    : Math.max(classified.tier.avgTicketRange[0], Math.min(classified.tier.avgTicketRange[1], rawTicket));

  const rawLostRevenue = options.userAvgTicket && options.userAvgTicket > 0
    ? Math.round(classified.baseMonthlyDemand * classified.conversionRate * options.userAvgTicket * locMult)
    : Math.round(classified.baseLostRevenue * locMult);
  const estimatedLostRevenue = options.userAvgTicket && options.userAvgTicket > 0
    ? rawLostRevenue
    : Math.max(classified.tier.lostRevenueRange[0], Math.min(classified.tier.lostRevenueRange[1], rawLostRevenue));

  const monthlyDemand = Math.round(classified.baseMonthlyDemand * locMult);
  const top3Views = Math.round(monthlyDemand * 1.5);

  let projectedROI = 0;
  if (options.isGmbConnected && options.realImpressions !== undefined && options.realImpressions > 0) {
    projectedROI = Math.round(options.realImpressions * classified.conversionRate * (avgTicket * 0.15));
  } else {
    projectedROI = Math.round(estimatedLostRevenue * 1.25);
  }

  return {
    niche: safeNiche,
    location: safeLocation,
    avgTicket,
    monthlyDemand,
    estimatedLostRevenue,
    projectedROI,
    conversionRate: classified.conversionRate,
    competition: classified.competition,
    difficulty: classified.difficulty,
    top3Views,
    tierName: classified.tierName,
    tierMinLostRevenue: classified.tier.lostRevenueRange[0],
    tierMaxLostRevenue: classified.tier.lostRevenueRange[1],
    tierMinAvgTicket: classified.tier.avgTicketRange[0],
    tierMaxAvgTicket: classified.tier.avgTicketRange[1]
  };
};
