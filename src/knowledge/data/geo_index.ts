export interface GeoPlace {
  city: string;
  state: string;
  stateCode: string;
  county: string;
  cbsa?: string;
  lat: number;
  lon: number;
}

export const COMPACT_GEO_INDEX: Record<string, GeoPlace> = {
  "houston_tx": {
    city: "Houston",
    state: "Texas",
    stateCode: "TX",
    county: "Harris County",
    cbsa: "Houston-The Woodlands-Sugar Land, TX",
    lat: 29.7604,
    lon: -95.3698
  },
  "austin_tx": {
    city: "Austin",
    state: "Texas",
    stateCode: "TX",
    county: "Travis County",
    cbsa: "Austin-Round Rock-Georgetown, TX",
    lat: 30.2672,
    lon: -97.7431
  },
  "miami_fl": {
    city: "Miami",
    state: "Florida",
    stateCode: "FL",
    county: "Miami-Dade County",
    cbsa: "Miami-Fort Lauderdale-Pompano Beach, FL",
    lat: 25.7617,
    lon: -80.1918
  },
  "orlando_fl": {
    city: "Orlando",
    state: "Florida",
    stateCode: "FL",
    county: "Orange County",
    cbsa: "Orlando-Kissimmee-Sanford, FL",
    lat: 28.5383,
    lon: -81.3792
  }
};
