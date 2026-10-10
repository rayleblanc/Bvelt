/**
 * Cloudflare Pages & Workers — AI Router & Lead Pitch Generator Handlers
 * 
 * 100% Edge runtime compatible.
 */

import { callCloudflareAiText, ACTIVE_MODELS } from "./cloudflareGemini.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

/**
 * Human communication filter for natural language responses.
 */
function getHumanizedSystemInstruction(baseInstruction: string, language: "es" | "en" = "es"): string {
  const filterEs = `
=========================================
CAPA DE ESTILO Y HUMANIZACIÓN OBLIGATORIA (HUMAN COMMUNICATION FILTER):
=========================================
NUNCA utilices palabras como "IA", "AI", "Agente", "Agent", "Bot", "Robot", "Asistente Virtual", "Virtual Assistant", "Algoritmo", etc. El tono debe ser 100% humano, cercano y directo.
Responde estrictamente en Español.`;

  const filterEn = `
=========================================
MANDATORY HUMAN COMMUNICATION FILTER:
=========================================
NEVER use words like "AI", "Agent", "Bot", "Robot", "Virtual Assistant", "Algorithm", etc. The tone must be 100% human, professional, empathetic, and direct.
Respond strictly in English.`;

  return `${baseInstruction}\n\n${language === "en" ? filterEn : filterEs}`;
}

/**
 * POST /api/ai/router
 */
export async function handleAiRouter(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { prompt, language = "es", location = "local area" } = body || {};

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Falta parámetro 'prompt'." }), {
        status: 400,
        headers: CORS_HEADERS
      });
    }

    const routerSystemInstruction = `You are the "Bvelt Pro Suite Director de Ruta" (Routing & Intent Director Agent).
Your absolute goal is to classify the user's voice command/transcript or text query into one of the specialized application routes, tabs, or answer as a context-aware consultant.

Available application routes and tabs inside Bvelt Pro Suite:
- 'dashboard': panel principal, resumen general del negocio, inicio (e.g. "panel principal", "cómo va mi negocio", "inicio", "resumen").
- 'action_center': tareas pendientes de hoy, próximos pasos recomendados, qué hacer ahora (e.g. "qué tengo pendiente hoy", "qué es lo más urgente", "próximos pasos").
- 'business_scan': escanear o analizar un negocio específico (propio o de un cliente potencial) para generar un diagnóstico (e.g. "escanea este negocio", "analiza a este cliente potencial", "quiero un diagnóstico").
- 'reviews': reseñas, reputación, responder comentarios, pedir reseñas a clientes (e.g. "ver reseñas", "responder una reseña mala", "pedir opiniones", "reputación").
- 'social': crear publicaciones para redes sociales o Google, posts de antes/después de un trabajo (e.g. "crear una publicación", "post de este trabajo", "publicar en redes").
- 'leads': clientes, contactos, seguimiento, mensajes, CRM (e.g. "ver mis clientes", "clientes inactivos", "mensajes de seguimiento", "leads").
- 'estimator': generar un presupuesto o cotización visual de un trabajo, usando fotos (e.g. "hacer un presupuesto", "cotizar este trabajo", "estimado con fotos").
- 'pricing': calculadora de tarifas, cuánto cobrar por hora o por servicio (e.g. "cuánto cobro por esto", "calculadora de precios", "tarifa por hora").
- 'growth': SEO local, cómo aparecer más en Google, simulador de crecimiento (e.g. "cómo aparecer más en Google", "crecimiento", "posicionamiento local").
- 'eod': cierre del día, resumen de ingresos y trabajos de hoy (e.g. "cierre del día", "cuánto facturé hoy", "resumen de hoy").
- 'tools': investigación de competencia, simulador de batalla, rankings de la zona (e.g. "analizar competencia", "simulador de batalla", "rankings").
- 'accounting': finanzas, gastos, ingresos, contabilidad (e.g. "cuánto gané esta semana", "mis gastos", "finanzas", "contabilidad").
- 'profile': datos del negocio, editar perfil de la empresa (e.g. "mi perfil", "editar mi negocio", "datos de mi empresa").
- 'website': el sitio web generado del negocio (e.g. "mi sitio web", "mi página").
- 'plans': plan de suscripción, actualizar cuenta, precios de Bvelt (e.g. "mi plan", "actualizar a pro", "suscripción", "precios").
- 'settings': ajustes, configuración, claves de API (e.g. "ajustes", "configuración", "cambiar mi clave").
- 'consultation': cualquier pregunta de negocio, consejo, duda general, saludo, o cualquier cosa que no encaje claramente en una de las rutas anteriores — responde siempre algo útil y específico, nunca digas que no puedes ayudar (e.g. "cómo consigo más clientes", "qué le digo a un cliente enojado", "hola", "dame un consejo").

You must return a raw JSON object with the following keys strictly:
{
  "intent": "dashboard" | "action_center" | "business_scan" | "reviews" | "social" | "leads" | "estimator" | "pricing" | "growth" | "eod" | "tools" | "accounting" | "profile" | "website" | "plans" | "settings" | "consultation",
  "reasoning": "Un razonamiento corto y amigable (máximo 1 oración)...",
  "response": "Si es 'consultation', una respuesta directa, humana y útil (2-4 frases) resolviendo su duda con consejo práctico y específico. Si es una acción de navegación, una frase corta en segunda persona confirmando la transición."
}

=========================================
CAPA DE ESTILO Y HUMANIZACIÓN OBLIGATORIA (HUMAN COMMUNICATION FILTER):
=========================================
NUNCA utilices palabras como "IA", "AI", "Agente", "Agent", "Bot", "Robot", "Asistente Virtual", "Virtual Assistant", "Algoritmo", etc. El tono debe ser 100% humano, cercano y directo.
Responde estrictamente en el idioma solicitado: ${language === 'en' ? 'English' : 'Spanish'}.
`;

    const aiResult = await callCloudflareAiText({
      env,
      prompt,
      systemInstruction: routerSystemInstruction,
      taskType: "generic"
    });
    const text = aiResult.text;

    let parsedResult: any;
    try {
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    } catch {
      parsedResult = {
        intent: "leads",
        reasoning: "Clasificación automática por defecto.",
        response: text || (language === "en" ? "Hello! How can I help your business today?" : "¡Hola! ¿En qué puedo ayudarte hoy con tu negocio?")
      };
    }

    // Normalize to canonical contract: { intent, radiusKm?, reply }
    const rawIntent = String(parsedResult.intent || '').toLowerCase().trim();
    let canonicalIntent = rawIntent;
    if (rawIntent === 'business_scan' || rawIntent === 'tools' || rawIntent === 'market' || rawIntent === 'radar') {
      canonicalIntent = 'scan';
    } else if (rawIntent === 'crm' || rawIntent === 'action_center') {
      canonicalIntent = 'leads';
    } else if (rawIntent === 'pricing' || rawIntent === 'estimator') {
      canonicalIntent = 'quote';
    } else if (rawIntent === 'settings') {
      canonicalIntent = 'profile';
    }

    const reply = parsedResult.reply || parsedResult.response || (
      language === "en" ? "Processing your voice request..." : "Procesando tu solicitud..."
    );

    const normalizedOutput = {
      intent: canonicalIntent,
      radiusKm: typeof parsedResult.radiusKm === 'number' ? parsedResult.radiusKm : null,
      reply,
      response: reply,
      reasoning: parsedResult.reasoning || ""
    };

    return new Response(JSON.stringify(normalizedOutput), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare AI Router] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

/**
 * POST /api/generate-lead-pitch
 */
export async function handleGenerateLeadPitch(request: Request, env: any): Promise<Response> {
  try {
    const body = (await request.json()) as any;
    const { name, rating, reviews, website, address, language = "es" } = body || {};

    const systemInstruction = language === "es"
      ? "Eres un experto en Marketing B2B y prospección en frío. Redactas mensajes de venta ultra-persuasivos (aptos para WhatsApp o correo) dirigidos a dueños de negocios locales. Tu objetivo es convencerlos de que optimicen su perfil de Google Maps o reclamen su sitio web usando nuestra plataforma LocalFlow Pro. Sé directo, empático, profesional, y enfócate en sus puntos débiles de manera constructiva y sin sonar agresivo."
      : "You are an expert in B2B Marketing and cold outreach. You write highly persuasive sales pitches (suitable for WhatsApp or email) tailored for local business owners. Your goal is to convince them to optimize their Google Maps profile or claim their website using our LocalFlow Pro platform. Be direct, empathetic, professional, and focus on their weak spots in a constructive, non-aggressive way.";

    const prompt = language === "es"
      ? `Redacta un mensaje de prospección en frío altamente persuasivo y personalizado para el siguiente negocio:
Nombre del negocio: ${name || 'Negocio Local'}
Calificación: ${rating !== undefined ? rating : 'N/A'} estrellas
Número de reseñas: ${reviews !== undefined ? reviews : 'N/A'}
Sitio Web: ${website ? website : 'No tiene sitio web / No registrado'}
Dirección: ${address || 'Local'}

Puntos débiles a analizar y atacar con elegancia:
${!website ? '- No tiene un sitio web profesional para captar clientes en línea, lo que le hace perder visibilidad y ventas frente a competidores.' : ''}
${rating && rating < 4.2 ? `- Tiene una calificación baja (${rating}), lo que daña su reputación digital y ahuyenta a clientes que buscan la mejor opción en Maps.` : ''}
${reviews && reviews < 10 ? `- Tiene muy pocas reseñas (${reviews}), por lo que pasa desapercibido y carece de prueba social.` : ''}
${website && rating && rating >= 4.2 && reviews && reviews >= 10 ? '- Aunque tiene sitio web y buenas reseñas, siempre puede automatizar las respuestas y captar más clientes físicos con embudos de reseñas automatizados.' : ''}

Genera una plantilla optimizada lista para usar, con un asunto si fuera correo (o primer gancho para WhatsApp) y un cuerpo amigable que invite a una llamada breve o demostración gratuita. No incluyas explicaciones extras ni metadatos del sistema, solo la plantilla lista.`
      : `Write a highly persuasive and personalized cold outreach pitch for the following business:
Business Name: ${name || 'Local Business'}
Rating: ${rating !== undefined ? rating : 'N/A'} stars
Number of reviews: ${reviews !== undefined ? reviews : 'N/A'}
Website: ${website ? website : 'No website / Not registered'}
Address: ${address || 'Local'}

Weak spots to analyze and address elegantly:
${!website ? '- They do not have a professional website to capture leads online, losing visibility and sales to competitors.' : ''}
${rating && rating < 4.2 ? `- They have a lower rating (${rating} stars), which damages online reputation and turns away potential customers on Maps.` : ''}
${reviews && reviews < 10 ? `- They have very few reviews (${reviews}), making them invisible and lacking social proof.` : ''}
${website && rating && rating >= 4.2 && reviews && reviews >= 10 ? '- While they have a website and good reviews, they can still benefit from automating replies and driving more walk-in traffic with automated review funnels.' : ''}

Generate an optimized template ready to use, with a subject line if it's for an email (or an opening hook for WhatsApp) and a friendly body inviting them to a brief call or free demo. Do not include extra explanations or system metadata, just the ready-to-use template.`;

    const humanizedInstruction = getHumanizedSystemInstruction(systemInstruction, language as "es" | "en");
    const aiResult = await callCloudflareAiText({
      env,
      prompt,
      systemInstruction: humanizedInstruction,
      taskType: "pitch"
    });
    let text = aiResult.text;

    if (!text) {
      text = language === "en"
        ? "Hello, I noticed your local business profile could get significantly more customers with a few quick optimizations. Let's schedule a brief 5-minute call."
        : "Hola, he revisado la presencia digital de tu negocio local y detecté oportunidades clave para aumentar tus clientes y reseñas. ¿Cuándo tendrías 5 minutos para comentarlo?";
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: CORS_HEADERS
    });
  } catch (error: any) {
    console.error("[Cloudflare Lead Pitch] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
