/**
 * Utility to parse location strings (e.g. "Houston, Texas, United States", "Madrid, Madrid", "Austin, TX")
 * into separated City and State/Province components.
 */

const KNOWN_COUNTRIES = new Set([
  'united states', 'usa', 'us', 'u.s.a.', 'u.s.',
  'españa', 'spain', 'es',
  'mexico', 'méxico', 'mx',
  'canada', 'ca',
  'united kingdom', 'uk', 'reino unido',
  'colombia', 'co',
  'argentina', 'ar',
  'chile', 'cl',
  'peru', 'perú', 'pe'
]);

export interface ParsedLocation {
  city: string;
  state: string;
  country: string;
}

export interface ParsedCityState {
  city: string;
  state: string;
}

export interface ParsedCityState {
  city: string;
  state: string;
}

export function parseLocationString(
  rawLocation?: string | null,
  fallbackState?: string | null,
  fallbackCountry?: string | null
): ParsedLocation {
  const cleanLoc = (rawLocation || '').trim();
  const cleanState = (fallbackState || '').trim();
  const cleanCountry = (fallbackCountry || 'US').trim();

  if (!cleanLoc) {
    return {
      city: '',
      state: cleanState,
      country: cleanCountry,
    };
  }

  // Handle multi-part comma separated addresses
  if (cleanLoc.includes(',')) {
    const rawParts = cleanLoc.split(',').map((p) => p.trim()).filter(Boolean);
    
    // Check if the last part is a recognized country
    let detectedCountry = cleanCountry;
    const partsWithoutCountry = rawParts.filter((part, idx) => {
      if (idx === rawParts.length - 1 && KNOWN_COUNTRIES.has(part.toLowerCase())) {
        detectedCountry = part;
        return false;
      }
      return true;
    });

    if (partsWithoutCountry.length >= 2) {
      // E.g. "Houston, Texas" or "Downtown, Houston, Texas"
      const city = partsWithoutCountry[0];
      const state = partsWithoutCountry[partsWithoutCountry.length - 1];
      return {
        city,
        state: state || cleanState,
        country: detectedCountry,
      };
    } else if (partsWithoutCountry.length === 1) {
      return {
        city: partsWithoutCountry[0],
        state: cleanState,
        country: detectedCountry,
      };
    }
  }

  return {
    city: cleanLoc,
    state: cleanState,
    country: cleanCountry,
  };
}

export function parseCityState(
  cityOrLocationStr?: string | null,
  stateStr?: string | null,
  fallbackProfile?: { city?: string; state?: string; location?: string } | null
): ParsedCityState {
  // If state is already provided explicitly as a distinct non-empty string, use it
  const cleanExplicitState = (stateStr || '').trim();
  const rawCity = (cityOrLocationStr || '').trim();

  if (cleanExplicitState && rawCity && !rawCity.includes(',')) {
    return {
      city: rawCity,
      state: cleanExplicitState,
    };
  }

  // If rawCity contains commas, parse it (e.g., "Houston, Texas, United States")
  if (rawCity.includes(',')) {
    const rawParts = rawCity.split(',').map((p) => p.trim()).filter(Boolean);
    
    // Filter out trailing country names
    const partsWithoutCountry = rawParts.filter((part) => {
      return !KNOWN_COUNTRIES.has(part.toLowerCase());
    });

    if (partsWithoutCountry.length >= 2) {
      return {
        city: partsWithoutCountry[0],
        state: partsWithoutCountry[1],
      };
    } else if (partsWithoutCountry.length === 1) {
      return {
        city: partsWithoutCountry[0],
        state: cleanExplicitState || fallbackProfile?.state || '',
      };
    }
  }

  // If rawCity is simple (no commas)
  if (rawCity) {
    return {
      city: rawCity,
      state: cleanExplicitState || fallbackProfile?.state || '',
    };
  }

  // Fallback to profile
  const profileCity = fallbackProfile?.city || '';
  const profileState = fallbackProfile?.state || '';

  if (profileCity.includes(',')) {
    return parseCityState(profileCity, profileState, null);
  }

  return {
    city: profileCity,
    state: profileState,
  };
}
