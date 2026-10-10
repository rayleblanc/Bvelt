export interface DatasetManifest {
  id: string;
  name: string;
  source: string;
  officialUrl?: string;
  referenceYear: number;
  geographyLevel?: string;
  version?: string;
  updatedAt?: string;
  recordCount?: number;
  size?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'PENDING' | 'LOCAL_INDEX';
  license?: string;
  freshnessClass: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'annual' | 'long-term';
}

export const KNOWLEDGE_MANIFEST: Record<string, DatasetManifest> = {
  geo_places: {
    id: "geo_places_2025",
    name: "Census Places Gazetteer",
    source: "US Census Bureau",
    referenceYear: 2025,
    status: 'LOCAL_INDEX',
    freshnessClass: 'long-term',
  },
  naics_2022: {
    id: "naics_2022_structure",
    name: "NAICS Structure and Cross References",
    source: "US Census Bureau",
    referenceYear: 2022,
    status: 'LOCAL_INDEX',
    freshnessClass: 'long-term',
  },
  cbp_2023: {
    id: "cbp_2023_us",
    name: "County Business Patterns (CBP)",
    source: "US Census Bureau",
    referenceYear: 2023,
    status: 'LOCAL_INDEX',
    freshnessClass: 'annual',
  },
  qcew_2025: {
    id: "qcew_2025_annual",
    name: "Quarterly Census of Employment and Wages",
    source: "BLS",
    referenceYear: 2025,
    status: 'LOCAL_INDEX',
    freshnessClass: 'annual',
  },
  oews_2025: {
    id: "oews_2025_national",
    name: "Occupational Employment and Wage Statistics",
    source: "BLS",
    referenceYear: 2025,
    status: 'LOCAL_INDEX',
    freshnessClass: 'annual',
  },
  acs_2023: {
    id: "acs_2023_5yr",
    name: "American Community Survey (ACS) 5-Year",
    source: "US Census Bureau",
    referenceYear: 2023,
    status: 'LOCAL_INDEX',
    freshnessClass: 'annual',
  },
  bea_gdp: {
    id: "bea_gdp_2025",
    name: "BEA GDP and Economic Summary",
    source: "BEA",
    referenceYear: 2025,
    status: 'LOCAL_INDEX',
    freshnessClass: 'annual',
  }
};

export function getDatasetManifest(id: string): DatasetManifest | undefined {
  return Object.values(KNOWLEDGE_MANIFEST).find(m => m.id === id);
}
