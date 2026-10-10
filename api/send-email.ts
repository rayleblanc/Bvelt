import { Request, Response } from "express";
import { sendEmailWithResend, captureSentryError } from "../src/lib/resend.ts";

/**
 * Controller handler for /api/send-email
 * Accepts payload: { to, subject, htmlContent, textContent, agentType, businessName, from }
 */
export async function sendEmailHandler(req: Request, res: Response) {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { to, subject, htmlContent, textContent, agentType, businessName, from } = req.body || {};

    if (!to) {
      return res.status(400).json({
        success: false,
        error: "El campo 'to' (destinatario) es obligatorio."
      });
    }

    if (!subject) {
      return res.status(400).json({
        success: false,
        error: "El campo 'subject' (asunto) es obligatorio."
      });
    }

    if (!textContent && !htmlContent) {
      return res.status(400).json({
        success: false,
        error: "Se requiere 'textContent' o 'htmlContent' para enviar el correo."
      });
    }

    const result = await sendEmailWithResend({
      to,
      subject,
      htmlContent,
      textContent,
      agentType: agentType || "commercial",
      businessName: businessName || "Bvelt",
      from
    });

    if (result.skipped) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: "Envío de correo omitido: RESEND_API_KEY no configurada en el servidor.",
        reason: result.reason
      });
    }

    if (!result.success) {
      return res.status(200).json({
        success: false,
        skipped: false,
        error: result.error || "Error al enviar correo vía Resend API."
      });
    }

    return res.status(200).json({
      success: true,
      skipped: false,
      message: "Correo enviado correctamente vía Resend API.",
      data: result.data
    });
  } catch (error: any) {
    await captureSentryError(error);
    const errorMessage = error?.message || "Error interno al enviar el correo con Resend.";
    console.error("[API send-email error]:", errorMessage);
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}

export default sendEmailHandler;
