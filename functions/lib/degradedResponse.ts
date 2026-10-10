/**
 * Typed degradation response helper for Cloudflare Worker Edge runtime.
 * Ensures unhandled or Edge-degraded routes return structured JSON
 * with explicit `isDegraded: true` and `status: "degraded"` flags
 * instead of silent empty arrays or generic 404s.
 */

export interface DegradedRouteResponse {
  error: string;
  path: string;
  status: "degraded";
  isDegraded: boolean;
  degradationReason: string;
  timestamp: string;
}

export function createDegradedRouteResponse(
  path: string, 
  reason?: string, 
  statusCode = 501
): Response {
  const payload: DegradedRouteResponse = {
    error: "Ruta no soportada o degradada en Cloudflare Worker Edge runtime",
    path,
    status: "degraded",
    isDegraded: true,
    degradationReason: reason || "El endpoint solicitado no está disponible directamente en el runtime de Edge. Utilice los servicios canónicos de escaneo de Bvelt.",
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
