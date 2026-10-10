/**
 * Cloudflare-native Nominatim Proxy with in-memory caching and upstream throttling.
 * Strictly complies with OpenStreetMap Fair Use Policy.
 */

const nominatimCache = new Map<string, { data: any; expiresAt: number }>();
let lastRequestTime = 0;

export async function handleNominatim(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") || "search";
  url.searchParams.delete("endpoint");
  
  if (!url.searchParams.has("format")) {
    url.searchParams.set("format", "json");
  }

  const queryString = url.searchParams.toString();
  const cacheKey = `${endpoint}?${queryString}`;
  const now = Date.now();

  // In-memory cache hit (24 hours TTL)
  const cached = nominatimCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "HIT"
      }
    });
  }

  // Upstream rate limit lock: at least 1000ms between calls
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const targetUrl = `https://nominatim.openstreetmap.org/${endpoint}?${queryString}`;

  try {
    const nomRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Bvelt-App/1.0 (https://bvelt.app; contact@bvelt.app)",
        "Accept-Language": "es,en;q=0.9",
        "Accept": "application/json"
      }
    });

    if (!nomRes.ok) {
      return new Response(JSON.stringify({ error: `Nominatim responded with status ${nomRes.status}` }), {
        status: nomRes.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const data = await nomRes.json();

    // Cache management (max 500 entries)
    if (nominatimCache.size > 500) {
      const oldestKey = nominatimCache.keys().next().value;
      if (oldestKey) nominatimCache.delete(oldestKey);
    }
    nominatimCache.set(cacheKey, { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "X-Cache": "MISS"
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to query Nominatim" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
