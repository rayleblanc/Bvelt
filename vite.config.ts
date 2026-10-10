import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DETERMINISTIC_NICHE_MODELS: Record<string, {
  display_name: string;
  business_model: "HIGH_TICKET" | "RECURRING" | "HIGH_VOLUME";
  avg_ticket_usd: number;
  conversion_rate: number;
  top3_monthly_views_avg: number;
}> = {
  plumber: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  fontaneria: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  fontanero: { display_name: "Fontanería / Plumbing", business_model: "RECURRING", avg_ticket_usd: 220, conversion_rate: 0.06, top3_monthly_views_avg: 1200 },
  electrician: { display_name: "Electricidad / Electrical", business_model: "RECURRING", avg_ticket_usd: 280, conversion_rate: 0.05, top3_monthly_views_avg: 1100 },
  electricista: { display_name: "Electricidad / Electrical", business_model: "RECURRING", avg_ticket_usd: 280, conversion_rate: 0.05, top3_monthly_views_avg: 1100 },
  roofing: { display_name: "Tejados y Cubiertas / Roofing", business_model: "HIGH_TICKET", avg_ticket_usd: 3500, conversion_rate: 0.03, top3_monthly_views_avg: 800 },
  tejados: { display_name: "Tejados y Cubiertas / Roofing", business_model: "HIGH_TICKET", avg_ticket_usd: 3500, conversion_rate: 0.03, top3_monthly_views_avg: 800 },
  hvac: { display_name: "Climatización y HVAC", business_model: "HIGH_TICKET", avg_ticket_usd: 1200, conversion_rate: 0.04, top3_monthly_views_avg: 1500 },
  aire_acondicionado: { display_name: "Aire Acondicionado y Climatización", business_model: "HIGH_TICKET", avg_ticket_usd: 1100, conversion_rate: 0.04, top3_monthly_views_avg: 1500 },
  landscaping: { display_name: "Jardinería y Paisajismo", business_model: "RECURRING", avg_ticket_usd: 180, conversion_rate: 0.06, top3_monthly_views_avg: 900 },
  jardineria: { display_name: "Jardinería y Paisajismo", business_model: "RECURRING", avg_ticket_usd: 180, conversion_rate: 0.06, top3_monthly_views_avg: 900 },
  cleaning: { display_name: "Servicios de Limpieza", business_model: "RECURRING", avg_ticket_usd: 160, conversion_rate: 0.07, top3_monthly_views_avg: 1400 },
  limpieza: { display_name: "Servicios de Limpieza", business_model: "RECURRING", avg_ticket_usd: 160, conversion_rate: 0.07, top3_monthly_views_avg: 1400 },
  painting: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  pintor: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  pintura: { display_name: "Pintura y Acabados", business_model: "HIGH_TICKET", avg_ticket_usd: 1400, conversion_rate: 0.04, top3_monthly_views_avg: 950 },
  locksmith: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  cerrajero: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  cerrajeria: { display_name: "Cerrajería Urgente", business_model: "HIGH_VOLUME", avg_ticket_usd: 160, conversion_rate: 0.09, top3_monthly_views_avg: 1800 },
  auto_repair: { display_name: "Taller Mecánico y Chapa", business_model: "RECURRING", avg_ticket_usd: 350, conversion_rate: 0.05, top3_monthly_views_avg: 1600 },
  mecanico: { display_name: "Taller Mecánico y Chapa", business_model: "RECURRING", avg_ticket_usd: 350, conversion_rate: 0.05, top3_monthly_views_avg: 1600 },
  pest_control: { display_name: "Control de Plagas", business_model: "RECURRING", avg_ticket_usd: 210, conversion_rate: 0.06, top3_monthly_views_avg: 850 },
  reformas: { display_name: "Reformas y Construcción", business_model: "HIGH_TICKET", avg_ticket_usd: 4500, conversion_rate: 0.025, top3_monthly_views_avg: 750 },
  remodelacion: { display_name: "Reformas y Remodelaciones", business_model: "HIGH_TICKET", avg_ticket_usd: 4500, conversion_rate: 0.025, top3_monthly_views_avg: 750 },
};

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/api')) {
          return next();
        }

        const urlObj = new URL(rawUrl, 'http://localhost:3000');
        const pathname = urlObj.pathname;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // 1. Overpass proxy (resilient OpenStreetMap proxy)
        if (pathname === '/api/overpass-proxy') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            let query = '';
            try {
              const parsed = JSON.parse(bodyStr);
              query = parsed.query;
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              return;
            }

            if (!query || typeof query !== 'string' || !query.trim()) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Query empty' }));
              return;
            }

            const mirrors = [
              'https://overpass-api.de/api/interpreter',
              'https://lz4.overpass-api.de/api/interpreter',
              'https://overpass.kumi.systems/api/interpreter',
              'https://overpass.private.coffee/api/interpreter',
              'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
            ];

            for (const mirror of mirrors) {
              try {
                const resp = await fetch(mirror, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'BveltRadarBot/2.0 (https://bvelt.com; info@bvelt.com)'
                  },
                  body: `data=${encodeURIComponent(query.trim())}`,
                  signal: AbortSignal.timeout(8000)
                });

                if (resp.ok) {
                  const ct = resp.headers.get('content-type') || '';
                  if (ct.includes('application/json')) {
                    const data = await resp.json();
                    if (data && Array.isArray(data.elements)) {
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json; charset=utf-8');
                      res.end(JSON.stringify(data));
                      return;
                    }
                  }
                }
              } catch {
                // try next mirror
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Overpass API unavailable', degradedReason: 'provider', elements: [] }));
          });
          return;
        }

        // 2. Google OAuth status (/api/auth/google/config-status, /api/oauth-config-status)
        if (pathname === '/api/auth/google/config-status' || pathname === '/api/oauth-config-status' || pathname === '/api/auth/google') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            configured: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID),
            clientIdPresent: Boolean(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID),
            hasSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET)
          }));
          return;
        }

        // 3. Niche benchmark (/api/niche-benchmark)
        if (pathname === '/api/niche-benchmark') {
          const nicheParam = urlObj.searchParams.get('niche') || '';
          const locationParam = urlObj.searchParams.get('location') || '';

          if (!nicheParam.trim()) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ status: 'PENDING_NICHO', data: null }));
            return;
          }

          const niche_slug = nicheParam.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          const location_slug = locationParam.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          
          let matched = DETERMINISTIC_NICHE_MODELS[niche_slug];
          if (!matched) {
            for (const [key, val] of Object.entries(DETERMINISTIC_NICHE_MODELS)) {
              if (niche_slug.includes(key) || key.includes(niche_slug)) {
                matched = val;
                break;
              }
            }
          }

          const benchmarkData = {
            id: `${niche_slug}_${location_slug}`,
            niche_slug,
            location_slug,
            display_name: matched?.display_name || nicheParam,
            business_model: matched?.business_model || 'RECURRING',
            avg_ticket_usd: matched?.avg_ticket_usd || 200,
            conversion_rate: matched?.conversion_rate || 0.05,
            top3_monthly_views_avg: matched?.top3_monthly_views_avg || 1000,
            classification: 'BENCHMARK / MODELED',
            created_at: new Date().toISOString()
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            status: 'SUCCESS',
            data: benchmarkData
          }));
          return;
        }

        // 4. Opportunities (/api/opportunities)
        if (pathname === '/api/opportunities') {
          const trade = urlObj.searchParams.get('trade') || 'Plumbing';
          const zip = urlObj.searchParams.get('zip') || '33101';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            trade,
            zip,
            opportunities: [
              {
                id: `opp_${trade}_${zip}_1`,
                title: `Optimización de Ficha Local (${trade})`,
                estimatedLossUsd: 850,
                trade,
                zipCode: zip,
                priority: 'HIGH',
                summary: `Se detectaron competidores locales en la zona ${zip} capturando llamadas directas.`
              },
              {
                id: `opp_${trade}_${zip}_2`,
                title: 'Embudo de Respuesta Rápida de Reseñas',
                estimatedLossUsd: 450,
                trade,
                zipCode: zip,
                priority: 'MEDIUM',
                summary: 'Respuesta automatizada a reseñas requerida para mantener posicionamiento.'
              }
            ],
            isDegraded: false
          }));
          return;
        }

        // 5. Health checks (/api/health, /api/health/providers)
        if (pathname === '/api/health' || pathname === '/api/health/providers') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            status: 'ok',
            gemini: Boolean(process.env.GEMINI_API_KEY),
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // 6. Plan usage (/api/plan/usage, /api/plan-usage)
        if (pathname.startsWith('/api/plan')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            allowed: true,
            plan: 'pro',
            status: 'active'
          }));
          return;
        }

        // 7. Nominatim geocoding proxy (/api/nominatim, /api/geolocalizar)
        if (pathname === '/api/nominatim' || pathname === '/api/geolocalizar') {
          try {
            const query = urlObj.searchParams.get('q') || '';
            const lat = urlObj.searchParams.get('lat') || '';
            const lon = urlObj.searchParams.get('lon') || '';
            let targetUrl = 'https://nominatim.openstreetmap.org/search?format=json&q=';
            if (lat && lon) {
              targetUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            } else if (query) {
              targetUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
            }
            const nomResp = await fetch(targetUrl, {
              headers: { 'User-Agent': 'BveltRadarBot/2.0 (info@bvelt.com)' },
              signal: AbortSignal.timeout(5000)
            });
            if (nomResp.ok) {
              const data = await nomResp.json();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(data));
              return;
            }
          } catch {
            // fallback
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify([]));
          return;
        }

        // 8. Default JSON response for any other /api routes
        // CRITICAL: NEVER let Vite fall through to static files or SPA index.html for /api routes
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          status: 'ok',
          path: pathname,
          data: null
        }));
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-react';
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) {
              return 'react';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
