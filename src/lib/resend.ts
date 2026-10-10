import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Lazy initializer for Resend SDK to prevent app crash if RESEND_API_KEY is not set at load time.
 */
export function getResendClient(): Resend | null {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Helper to safely report errors to Sentry if available in the environment.
 */
export async function captureSentryError(error: any) {
  console.error('[Resend Email Service Error]:', error);
  try {
    const g = globalThis as any;
    if (g && g.Sentry && typeof g.Sentry.captureException === 'function') {
      g.Sentry.captureException(error);
      return;
    }
    if (typeof (global as any).Sentry?.captureException === 'function') {
      (global as any).Sentry.captureException(error);
      return;
    }
  } catch (_) {
    // Silent catch if Sentry is not installed
  }
}

interface FormatEmailOptions {
  subject: string;
  textContent?: string;
  htmlContent?: string;
  agentType?: string;
  businessName?: string;
}

/**
 * Converts raw markdown/text content into modern, formatted HTML suitable for transactional emails.
 */
export function buildAgentEmailHtml(options: FormatEmailOptions): string {
  const { subject, textContent = '', htmlContent = '', agentType = 'commercial', businessName = 'Bvelt' } = options;

  if (htmlContent && htmlContent.trim().length > 0) {
    return htmlContent;
  }

  // Format markdown-like elements into HTML
  const formattedBody = textContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Format bold text **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Format bullet points line by line
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return `<li style="margin-bottom: 6px;">${trimmed.substring(2)}</li>`;
      }
      if (trimmed.length === 0) {
        return '<br/>';
      }
      return `<p style="margin: 0 0 12px 0; line-height: 1.6; font-size: 14px; color: #334155;">${trimmed}</p>`;
    })
    .join('');

  const getAgentLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'b2b_outreach':
      case 'agent_5':
      case 'agente_5':
        return { title: 'Propuesta B2B / Captación Directa', color: '#6366f1' };
      case 'proposal_estimate':
      case 'agent_6':
      case 'agente_6':
        return { title: 'Estimación y Propuesta de Proyecto', color: '#f43f5e' };
      case 'reactivation':
        return { title: 'Mensaje de Reactivación Comercial', color: '#10b981' };
      default:
        return { title: 'Comunicado Comercial', color: '#4f46e5' };
    }
  };

  const agentBadge = getAgentLabel(agentType);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase;">${businessName}</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; background-color: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${agentBadge.title}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px; background-color: #ffffff;">
              <h1 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
                ${subject}
              </h1>

              <div style="background-color: #f8fafc; border-left: 4px solid ${agentBadge.color}; border-radius: 0 12px 12px 0; padding: 20px 24px; margin-bottom: 24px; font-size: 14px; color: #334155;">
                ${formattedBody}
              </div>

              <div style="margin-top: 24px; padding-top: 20px; border-t: 1px solid #f1f5f9; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  Este correo fue generado y enviado automáticamente mediante el sistema de gestión de <strong>${businessName}</strong>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
              <p style="margin: 0 0 6px 0;">&copy; ${new Date().getFullYear()} ${businessName}. Todos los derechos reservados.</p>
              <p style="margin: 0;">Enviado vía Resend API &bull; Correo Transaccional</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  agentType?: string;
  businessName?: string;
  from?: string;
}

/**
 * Main helper to send email via Resend and handle errors.
 */
export async function sendEmailWithResend(payload: SendEmailPayload) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.warn('[Resend Email Service] ⚠️ RESEND_API_KEY environment variable is missing. Skipping email dispatch gracefully.');
      return {
        success: true,
        skipped: true,
        reason: 'RESEND_API_KEY environment variable is not configured.'
      };
    }

    const { to, subject, htmlContent, textContent, agentType = 'commercial', businessName = 'Bvelt', from } = payload;

    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error("El parámetro 'to' (destinatario) es obligatorio.");
    }
    if (!subject || subject.trim() === '') {
      throw new Error("El parámetro 'subject' (asunto) es obligatorio.");
    }
    if (!textContent && !htmlContent) {
      throw new Error("Debes proporcionar 'textContent' o 'htmlContent'.");
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn('[Resend Email Service] ⚠️ Could not initialize Resend client. Skipping email dispatch.');
      return {
        success: true,
        skipped: true,
        reason: 'Resend client initialization failed.'
      };
    }

    const finalHtml = buildAgentEmailHtml({
      subject,
      textContent,
      htmlContent,
      agentType,
      businessName
    });

    const defaultFrom = process.env.RESEND_FROM_EMAIL || `${businessName} <onboarding@resend.dev>`;
    const fromAddress = from || defaultFrom;

    const recipientList = Array.isArray(to) ? to : [to];

    const data = await resend.emails.send({
      from: fromAddress,
      to: recipientList,
      subject: subject,
      html: finalHtml,
      text: textContent || subject
    });

    return {
      success: true,
      skipped: false,
      data
    };
  } catch (error: any) {
    await captureSentryError(error);
    console.error('[Resend Email Error]:', error?.message || error);
    return {
      success: false,
      skipped: false,
      error: `[Resend Service]: ${error?.message || String(error)}`
    };
  }
}
