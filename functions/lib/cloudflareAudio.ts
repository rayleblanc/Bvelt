/**
 * Cloudflare Pages & Workers — Audio Generation with Gemini Modality.AUDIO
 * 
 * 100% Edge runtime compatible.
 */

import { ACTIVE_MODELS } from "./cloudflareGemini.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export async function handleGenerarAudio(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { text, language = "es" } = body || {};

    if (!text || typeof text !== "string" || text.trim() === "") {
      return new Response(JSON.stringify({
        success: false,
        error: "El parámetro 'text' es obligatorio para generar el audio."
      }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "GEMINI_API_KEY no configurada en el servidor."
      }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }

    const modelName = ACTIVE_MODELS.GEMINI_PRIMARY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore" // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            }
          }
        }
      }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[Cloudflare Audio API] Error calling Gemini audio synthesis:", errText);
      return new Response(JSON.stringify({
        success: false,
        error: "No se pudo sintetizar el audio desde el motor de IA."
      }), {
        status: resp.status,
        headers: CORS_HEADERS
      });
    }

    const data = (await resp.json()) as any;
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return new Response(JSON.stringify({
        success: false,
        error: "No se encontró contenido de audio en la respuesta del motor de IA."
      }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }

    return new Response(JSON.stringify({
      success: true,
      audio: base64Audio
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare Audio API] Handler error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Error al sintetizar el audio profesional."
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
