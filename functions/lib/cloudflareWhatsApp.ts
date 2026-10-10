/**
 * Cloudflare Pages & Workers — Meta WhatsApp Business Cloud API Integration
 * 
 * 100% Edge runtime compatible.
 */

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function handleSendWhatsApp(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { phoneNumber, message } = body || {};

    if (!phoneNumber || !message) {
      return new Response(JSON.stringify({
        error: "Faltan parámetros obligatorios: 'phoneNumber' y 'message'."
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const token = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumId = env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumId) {
      return new Response(JSON.stringify({
        success: false,
        error: "WhatsApp Business Cloud API no configurado en variables de entorno (falta WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID)."
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, "");
    if (!cleanPhone) {
      return new Response(JSON.stringify({
        success: false,
        error: "Número de teléfono no válido."
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      })
    });

    const data = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: data?.error?.message || "Error desde Meta WhatsApp Cloud API",
        data
      }), {
        status: response.status,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (err: any) {
    console.error("[Cloudflare WhatsApp API] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Error al procesar el envío por WhatsApp."
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
