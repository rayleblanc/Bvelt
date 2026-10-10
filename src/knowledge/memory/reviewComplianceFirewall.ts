/**
 * BVELT REVIEW COMPLIANCE FIREWALL
 * 
 * Deterministic, zero-LLM policy engine that detects, blocks, or neutralizes
 * non-compliant review solicitation flows (review gating, selective targeting,
 * star conditioning, hiding public review links from dissatisfied clients).
 */

import {
  ComplianceDecision,
  ReviewComplianceRuleId,
  ReviewActionPayload,
  RuleViolation,
  ComplianceEvaluationResult,
  ComplianceAuditLogRecord
} from './reviewComplianceTypes';

// L1 memory audit ring buffer (max 100 recent entries)
const COMPLIANCE_AUDIT_LOG: ComplianceAuditLogRecord[] = [];

// RegEx patterns for non-compliant messaging
const STAR_MANDATE_PATTERNS = [
  /\b5\s*[-–—]?\s*estrellas?\b/i,
  /\b5\s*[-–—]?\s*stars?\b/i,
  /\b5\s*★\b/i,
  /\bcinco\s+estrellas\b/i,
  /\bfive\s+stars?\b/i,
  /\bcalif[ií]canos\s+con\s+5\b/i,
  /\brate\s+us\s+5\b/i,
  /\bdejar(?:nos)?\s+(?:una\s+reseña\s+de\s+)?5\b/i,
  /\bleave\s+(?:us\s+)?(?:a\s+)?5\b/i
];

const REVIEW_GATING_PATTERNS = [
  /\bsi\s+tuviste\s+alg[uú]n\s+problema\b/i,
  /\bll[aá]manos\s+directamente\b/i,
  /\bcontacta(?:nos)?\s+primero\b/i,
  /\bsolo\s+calif[ií]canos\s+si\b/i,
  /\bsolo\s+deja\s+una\s+reseña\s+si\b/i,
  /\bonly\s+review\s+us\s+if\b/i,
  /\bonly\s+rate\s+us\s+if\b/i,
  /\bif\s+you\s+had\s+(?:any\s+)?issues?\s+contact\s+us\b/i,
  /\bif\s+you\s+had\s+(?:any\s+)?problems?\b/i,
  /\bcontact\s+us\s+directly\s+before\s+leaving\b/i
];

const CONDITIONAL_SATISFACTION_PATTERNS = [
  /\bsi\s+(?:quedaste|est[aá]s)\s+satisfecho\b/i,
  /\bsi\s+(?:quedaste|est[aá]s)\s+contento\b/i,
  /\bsi\s+tuviste\s+(?:una\s+)?(?:buena|gran|excelente)\s+experiencia\b/i,
  /\bsi\s+te\s+gust[oó]\s+(?:el|nuestro)\s+servicio\b/i,
  /\bif\s+you\s+(?:were|are)\s+(?:happy|satisfied|pleased)\b/i,
  /\bif\s+you\s+had\s+a\s+(?:great|good|positive|excellent)\s+experience\b/i,
  /\bonly\s+if\s+(?:you\s+are\s+)?satisfied\b/i,
  /\bsolo\s+si\s+est[aá]s\s+satisfecho\b/i
];

const INCENTIVE_PATTERNS = [
  /\ba\s+cambio\s+de\s+(?:un\s+)?(?:descuento|regalo|premio)\b/i,
  /\bte\s+regalamos\b/i,
  /\brecibe\s+(?:un\s+)?\d+%/i,
  /\bdescuento\b/i,
  /\bdescuentos\b/i,
  /\bdiscount\b/i,
  /\bdiscounts\b/i,
  /\bin\s+exchange\s+for\s+(?:a\s+)?(?:review|5\s*stars?)\b/i,
  /\bget\s+(?:a\s+)?(?:\$|\d+%\s+)?(?:discount|coupon|gift)\s+for\s+(?:a\s+)?review\b/i,
  /\bfree\s+gift\b/i,
  /\bregalo\b/i
];

export class ReviewComplianceFirewall {
  /**
   * Deterministically evaluates a review action payload against compliance rules.
   */
  public static evaluate(payload: ReviewActionPayload): ComplianceEvaluationResult {
    const violations: RuleViolation[] = [];
    const timestamp = new Date().toISOString();

    // Bypass protection: Ignore any untrusted client bypass claims
    const sanitizedPayload = { ...payload };
    if (sanitizedPayload.clientMetadata) {
      delete sanitizedPayload.clientMetadata.forceAllow;
      delete sanitizedPayload.clientMetadata.skipCompliance;
      delete sanitizedPayload.clientMetadata.isCompliant;
      delete sanitizedPayload.clientMetadata.overrideFirewall;
      delete sanitizedPayload.clientMetadata.bypass;
    }

    // ------------------------------------------------------------------------
    // CASE 1: Review Replies & Alerts (Inherently Compliant)
    // ------------------------------------------------------------------------
    if (sanitizedPayload.actionType === 'REVIEW_REPLY') {
      return {
        decision: 'ALLOW',
        isCompliant: true,
        primaryRuleId: 'RULE_LEGITIMATE_REVIEW_REPLY',
        reasonEs: 'Respuesta profesional y legítima a una opinión existente.',
        reasonEn: 'Professional and legitimate response to an existing customer review.',
        violations: [],
        evaluatedAt: timestamp,
        isDeterministic: true
      };
    }

    if (sanitizedPayload.actionType === 'PENDING_REVIEW_ALERT') {
      return {
        decision: 'ALLOW',
        isCompliant: true,
        primaryRuleId: 'RULE_LEGITIMATE_PENDING_ALERT',
        reasonEs: 'Alerta operacional para responder opiniones pendientes a tiempo.',
        reasonEn: 'Operational alert to respond to pending customer reviews promptly.',
        violations: [],
        evaluatedAt: timestamp,
        isDeterministic: true
      };
    }

    // ------------------------------------------------------------------------
    // RULE 1: Direct Review Gating (Hiding public review link or conditional routing)
    // ------------------------------------------------------------------------
    if (sanitizedPayload.publicReviewLinkAccessible === false) {
      violations.push({
        ruleId: 'RULE_NO_REVIEW_GATING',
        severity: 'CRITICAL_BLOCK',
        reasonEs: 'El flujo oculta o restringe el acceso al enlace público de reseña a clientes.',
        reasonEn: 'The flow hides or restricts public review link access from customers.'
      });
    }

    const textToCheck = `${sanitizedPayload.messageText || ''} ${sanitizedPayload.subjectText || ''}`;

    for (const pattern of REVIEW_GATING_PATTERNS) {
      const match = textToCheck.match(pattern);
      if (match) {
        violations.push({
          ruleId: 'RULE_NO_REVIEW_GATING',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Está prohibido realizar review gating (solicitar opiniones solo tras verificar satisfacción o pedir llamadas internas si hay problemas).',
          reasonEn: 'Review gating (directing only satisfied clients to public reviews or unhappy clients to private channels) is strictly prohibited.',
          detectedPattern: match[0]
        });
        break;
      }
    }

    // ------------------------------------------------------------------------
    // RULE 2: Selective Targeting based on Sentiment / Satisfaction Filter
    // ------------------------------------------------------------------------
    const tc = sanitizedPayload.targetingCriteria;
    if (tc) {
      if (
        tc.sentimentFilter === 'POSITIVE_ONLY' ||
        tc.sentimentFilter === 'EXCLUDE_NEGATIVE' ||
        tc.sentimentFilter === 'HIGH_SATISFACTION_ONLY'
      ) {
        violations.push({
          ruleId: 'RULE_NO_SENTIMENT_FILTERING',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Se intentó filtrar destinatarios seleccionando únicamente sentimientos positivos.',
          reasonEn: 'Attempted to selectively filter recipients based exclusively on positive sentiment.',
          detectedPattern: `sentimentFilter: ${tc.sentimentFilter}`
        });
      }

      if (tc.excludeDissatisfied === true) {
        violations.push({
          ruleId: 'RULE_NO_UNSATISFIED_EXCLUSION',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Se excluyeron deliberadamente clientes con experiencias desfavorables.',
          reasonEn: 'Deliberately excluded dissatisfied customers from universal feedback request.'
        });
      }

      if (tc.minRatingThreshold && tc.minRatingThreshold > 1 && tc.triggerEvent === 'HIGH_RATING_FILTER') {
        violations.push({
          ruleId: 'RULE_NO_SENTIMENT_FILTERING',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Se condicionó el envío de solicitud a clientes que previamente marcaron una alta calificación.',
          reasonEn: 'Conditioned review solicitation to customers who previously indicated high rating.'
        });
      }
    }

    // ------------------------------------------------------------------------
    // RULE 3: Review Incentives / Bribes
    // ------------------------------------------------------------------------
    for (const pattern of INCENTIVE_PATTERNS) {
      if (pattern.test(textToCheck)) {
        violations.push({
          ruleId: 'RULE_NO_RATING_INCENTIVE',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Ofrecer compensaciones o regalos a cambio de reseñas o calificaciones específicas está prohibido.',
          reasonEn: 'Offering compensation or incentives in exchange for reviews or ratings is strictly prohibited.',
          detectedPattern: textToCheck.match(pattern)?.[0]
        });
        break;
      }
    }

    // ------------------------------------------------------------------------
    // RULE 4: Star Mandate ("5 stars") in Text
    // ------------------------------------------------------------------------
    let hasStarMandate = false;
    let starMatchText = '';
    for (const pattern of STAR_MANDATE_PATTERNS) {
      const match = textToCheck.match(pattern);
      if (match) {
        hasStarMandate = true;
        starMatchText = match[0];
        violations.push({
          ruleId: 'RULE_NO_STAR_MANDATE',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'El mensaje solicita explícitamente una calificación fija ("5 estrellas").',
          reasonEn: 'The message explicitly solicits a specific star rating ("5 stars").',
          detectedPattern: starMatchText
        });
        break;
      }
    }

    // ------------------------------------------------------------------------
    // RULE 5: Conditional Satisfaction in Text
    // ------------------------------------------------------------------------
    let hasConditionalLanguage = false;
    let condMatchText = '';
    for (const pattern of CONDITIONAL_SATISFACTION_PATTERNS) {
      const match = textToCheck.match(pattern);
      if (match) {
        hasConditionalLanguage = true;
        condMatchText = match[0];
        violations.push({
          ruleId: 'RULE_NO_CONDITIONAL_SATISFACTION',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'El mensaje condiciona la solicitud de reseña a si el cliente quedó satisfecho.',
          reasonEn: 'The message conditions the review request on whether the client was satisfied.',
          detectedPattern: condMatchText
        });
        break;
      }
    }

    // ------------------------------------------------------------------------
    // DECISION SYNTHESIS
    // ------------------------------------------------------------------------
    const hasCriticalBlock = violations.some(v => v.severity === 'CRITICAL_BLOCK');

    if (hasCriticalBlock) {
      const criticalViolation = violations.find(v => v.severity === 'CRITICAL_BLOCK')!;
      const result: ComplianceEvaluationResult = {
        decision: 'BLOCK',
        isCompliant: false,
        primaryRuleId: criticalViolation.ruleId,
        reasonEs: criticalViolation.reasonEs,
        reasonEn: criticalViolation.reasonEn,
        violations,
        evaluatedAt: timestamp,
        isDeterministic: true
      };
      this.recordAuditLog(sanitizedPayload, result);
      return result;
    }

    // Completely compliant neutral review request
    const result: ComplianceEvaluationResult = {
      decision: 'ALLOW',
      isCompliant: true,
      primaryRuleId: 'RULE_LEGITIMATE_NEUTRAL_REQUEST',
      reasonEs: 'Solicitud de reseña neutral y transparente conforme a directrices de Google y FTC.',
      reasonEn: 'Neutral and transparent review request conforming to Google and FTC policies.',
      violations: [],
      evaluatedAt: timestamp,
      isDeterministic: true
    };
    this.recordAuditLog(sanitizedPayload, result);
    return result;
  }

  /**
   * Evaluates an ActionEngine action item, sanitizing or blocking review gating.
   */
  public static evaluateAction(action: any, lang: 'es' | 'en' = 'es'): {
    action: any;
    decision: ComplianceDecision;
    complianceReason: string;
  } {
    if (!action) {
      return { action, decision: 'ALLOW', complianceReason: 'No action' };
    }

    const isEn = lang === 'en';
    const isReviewAction =
      action.destinationCode === 'REQUEST_REVIEW' ||
      action.id?.includes('review') ||
      action.id?.includes('reputation') ||
      action.action?.toLowerCase().includes('reseña') ||
      action.action?.toLowerCase().includes('review');

    if (!isReviewAction) {
      return { action, decision: 'ALLOW', complianceReason: 'Non-review action' };
    }

    // Check targeting criteria in contextData
    const targeting = action.contextData?.targetingCriteria || {};
    const textToCheck = `${action.action || ''} ${action.title || ''} ${action.reason || ''} ${action.whyNow || ''} ${action.bveltMoment?.recommendedActionNow || ''}`;

    const evalResult = this.evaluate({
      actionId: action.id,
      actionType: 'REQUEST_REVIEW',
      recipientName: action.contextData?.leadName || 'Cliente',
      messageText: textToCheck,
      targetingCriteria: {
        sentimentFilter: targeting.sentimentFilter || 'ALL',
        excludeDissatisfied: targeting.excludeDissatisfied || false
      },
      publicReviewLinkAccessible: true
    });

    const isGatingOrIncentive = evalResult.violations.some(
      v => v.ruleId === 'RULE_NO_REVIEW_GATING' ||
           v.ruleId === 'RULE_NO_SENTIMENT_FILTERING' ||
           v.ruleId === 'RULE_NO_UNSATISFIED_EXCLUSION' ||
           v.ruleId === 'RULE_NO_RATING_INCENTIVE'
    );

    if (isGatingOrIncentive) {
      return {
        action: null,
        decision: 'BLOCK',
        complianceReason: isEn ? evalResult.reasonEn : evalResult.reasonEs
      };
    }

    const hasStarOrCondition = evalResult.violations.some(
      v => v.ruleId === 'RULE_NO_STAR_MANDATE' || v.ruleId === 'RULE_NO_CONDITIONAL_SATISFACTION'
    ) || textToCheck.includes('5-Star') || textToCheck.includes('5 estrellas') || textToCheck.includes('5 stars');

    if (hasStarOrCondition) {
      // Sanitize action labels and reasons
      const sanitizedAction = { ...action };
      const recipient = action.contextData?.leadName || (isEn ? 'Client' : 'Cliente');

      sanitizedAction.action = isEn
        ? `Request Neutral Review from ${recipient}`
        : `Solicitar Reseña Neutral a ${recipient}`;
      sanitizedAction.title = sanitizedAction.action;
      sanitizedAction.reason = isEn
        ? 'Completed job verified. Requesting honest feedback immediately after service completion builds local trust.'
        : 'Trabajo completado. Solicitar feedback honesto inmediatamente al finalizar el servicio construye confianza local.';
      sanitizedAction.whyNow = isEn
        ? 'Service completed. Gathering genuine customer feedback helps improve visibility and reputation.'
        : 'Servicio completado. Recopilar opiniones genuinas ayuda a mejorar la visibilidad y reputación.';
      
      if (sanitizedAction.bveltMoment) {
        sanitizedAction.bveltMoment.recommendedActionNow = isEn
          ? `Send neutral review request link to ${recipient}.`
          : `Enviar enlace de reseña neutral a ${recipient}.`;
      }

      return {
        action: sanitizedAction,
        decision: 'MODIFY',
        complianceReason: isEn ? evalResult.reasonEn : evalResult.reasonEs
      };
    }

    return {
      action,
      decision: 'ALLOW',
      complianceReason: isEn ? evalResult.reasonEn : evalResult.reasonEs
    };
  }

  /**
   * Neutralizes a template or draft message into standard compliant copy.
   */
  public static neutralizeMessage(
    contact: string,
    biz: string,
    cat: string,
    loc: string,
    lang: 'es' | 'en' = 'es'
  ): {
    whatsapp: string;
    sms: string;
    emailSubject: string;
    emailBody: string;
    callScript: string;
    followUpNote: string;
  } {
    if (lang === 'en') {
      return {
        whatsapp: `Hi ${contact}, thank you for choosing ${biz} for your ${cat}! Could you take 30 seconds to share your honest experience with our team on Google? [Review Link]`,
        sms: `Thanks for choosing ${biz}! Please share your honest feedback on Google: [Review Link]. Thank you!`,
        emailSubject: `How was your experience with ${biz}?`,
        emailBody: `Hi ${contact},\n\nThank you for trusting ${biz} with your recent ${cat} service in ${loc}.\n\nWe would deeply appreciate a few moments of your time to share your honest review on Google.\n\nThank you for supporting local business!\n\nBest regards,\n${biz}`,
        callScript: `“Hi ${contact}, this is [Name] from ${biz}. Just checking in after completing your ${cat} service to ensure everything went smoothly, and to ask if you would mind sharing your feedback on Google.”`,
        followUpNote: 'Compliance Note: Sent as a neutral post-service feedback request to all completed jobs.'
      };
    }

    return {
      whatsapp: `Hola ${contact}, ¡muchas gracias por confiar en ${biz} para tu servicio de ${cat}! ¿Nos apoyarías compartiendo tu opinión sincera sobre nuestro trabajo en Google? [Enlace de Reseña]. Toma 30 segundos y nos ayuda mucho.`,
      sms: `¡Gracias por confiar en ${biz}! Comparte tu opinión sincera en Google: [Enlace de Reseña]. ¡Muchas gracias!`,
      emailSubject: `¿Cómo fue tu experiencia con ${biz}?`,
      emailBody: `Hola ${contact},\n\nMuchísimas gracias por confiar en ${biz} para tu servicio de ${cat} en ${loc}.\n\nTu opinión es muy valiosa para nosotros y para otros vecinos de la zona. Te agradeceríamos si puedes compartir tu experiencia sincera en Google.\n\n¡Gracias por apoyar a los profesionales locales!\n\nUn saludo cordial,\n${biz}`,
      callScript: `“Hola ${contact}, te habla [Nombre] de ${biz}. Te llamo tras finalizar el trabajo de ${cat} para confirmar que todo esté en orden y saber si nos apoyarías compartiendo tu opinión en Google.”`,
      followUpNote: 'Nota de Compliance: Solicitud neutral enviada tras finalizar el servicio sin condicionar la valoración.'
    };
  }

  /**
   * Evaluates raw message text directly against compliance rules.
   */
  public static evaluateMessage(
    message: string,
    lang: 'es' | 'en' = 'es'
  ): {
    decision: ComplianceDecision;
    isCompliant: boolean;
    ruleId?: ReviewComplianceRuleId;
    reason: string;
  } {
    if (!message || !message.trim()) {
      return {
        decision: 'ALLOW',
        isCompliant: true,
        reason: lang === 'en' ? 'Empty message is compliant' : 'Mensaje vacío cumple la normativa'
      };
    }

    const evalResult = this.evaluate({
      actionType: 'REQUEST_REVIEW',
      messageText: message,
      publicReviewLinkAccessible: true
    });

    return {
      decision: evalResult.decision,
      isCompliant: evalResult.isCompliant,
      ruleId: evalResult.primaryRuleId,
      reason: lang === 'en' ? evalResult.reasonEn : evalResult.reasonEs
    };
  }

  /**
   * Evaluates audience and targeting parameters for selective sentiment filtering.
   */
  public static evaluateAudienceFilter(payload: {
    targetAudience?: string;
    channel?: string;
    message?: string;
    filterByRating?: string;
  }): {
    decision: ComplianceDecision;
    isCompliant: boolean;
    ruleId?: ReviewComplianceRuleId;
    reason: string;
  } {
    const isSelectiveAudience = 
      payload.targetAudience === 'ONLY_SATISFIED_CUSTOMERS' ||
      payload.targetAudience === 'POSITIVE_ONLY' ||
      (payload.filterByRating !== undefined && payload.filterByRating !== 'ALL');

    if (isSelectiveAudience) {
      const result: ComplianceEvaluationResult = {
        decision: 'BLOCK',
        isCompliant: false,
        primaryRuleId: 'RULE_NO_SENTIMENT_FILTERING',
        reasonEs: 'Filtrar destinatarios por nivel de satisfacción o calificación positiva previa está prohibido.',
        reasonEn: 'Filtering recipients by prior positive satisfaction or rating threshold is strictly prohibited.',
        violations: [{
          ruleId: 'RULE_NO_SENTIMENT_FILTERING',
          severity: 'CRITICAL_BLOCK',
          reasonEs: 'Filtrar destinatarios por satisfacción previa.',
          reasonEn: 'Filtering recipients by prior satisfaction.'
        }],
        evaluatedAt: new Date().toISOString(),
        isDeterministic: true
      };

      this.recordAuditLog({
        actionType: 'REQUEST_REVIEW',
        targetingCriteria: { sentimentFilter: 'POSITIVE_ONLY' }
      }, result);

      return {
        decision: 'BLOCK',
        isCompliant: false,
        ruleId: 'RULE_NO_SENTIMENT_FILTERING',
        reason: result.reasonEs
      };
    }

    return {
      decision: 'ALLOW',
      isCompliant: true,
      ruleId: 'RULE_LEGITIMATE_NEUTRAL_REQUEST',
      reason: 'Universal audience request is compliant'
    };
  }

  /**
   * Validates if a workflow conforms to the zero-gating requirement.
   */
  public static isZeroGatingCompliant(config: {
    allowsPublicReviewOnNegative: boolean;
    hasNoIntermediaryFilter: boolean;
  }): boolean {
    return config.allowsPublicReviewOnNegative === true;
  }

  /**
   * Clears audit logs (used for test isolation).
   */
  public static clearAuditLog(): void {
    COMPLIANCE_AUDIT_LOG.length = 0;
  }

  /**
   * Retrieves recent compliance audit logs.
   */
  public static getAuditLog(): ComplianceAuditLogRecord[] {
    return this.getAuditLogs();
  }

  /**
   * Retrieves recent compliance audit logs.
   */
  public static getAuditLogs(): ComplianceAuditLogRecord[] {
    return [...COMPLIANCE_AUDIT_LOG];
  }

  /**
   * Internal recorder of compliance decisions for auditability.
   */
  private static recordAuditLog(payload: ReviewActionPayload, result: ComplianceEvaluationResult): void {
    const record: ComplianceAuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tenantId: payload.businessName || 'default_tenant',
      actionType: payload.actionType,
      decision: result.decision,
      primaryRuleId: result.primaryRuleId,
      reason: result.reasonEn,
      timestamp: result.evaluatedAt,
      sourceContext: payload.channel || 'INTERNAL'
    };

    COMPLIANCE_AUDIT_LOG.unshift(record);
    if (COMPLIANCE_AUDIT_LOG.length > 100) {
      COMPLIANCE_AUDIT_LOG.pop();
    }
  }
}
