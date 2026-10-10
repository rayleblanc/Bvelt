const fs = require('fs');
let code = fs.readFileSync('api/batch-outreach.ts', 'utf-8');

const target = `  // 3. Process leads against Firestore outreach_log & send emails via Resend
  for (const lead of leadsWithEmail) {
    if (sent >= maxBusinesses) {
      console.log(\`[Batch Outreach] Reached max target limit of \${maxBusinesses} emails for this batch.\`);
      break;
    }

    const safeDocId = lead.email.replace(/[^a-z0-9]/g, '_');

    try {
      // Check if lead was already contacted
      const logRef = db.collection('outreach_log').doc(safeDocId);
      const logSnap = await logRef.get();

      if (logSnap.exists) {
        skipped_already_logged++;
        continue;
      }

      const subject = \`Estrategia de Visibilidad Local para \${lead.name} (\${city})\`;
      const textContent = \`Hola equipo de \${lead.name},
Les escribo directamente tras revisar la presencia local de los negocios de \${niche} en \${city}. Actualmente, muchas empresas de la zona están perdiendo hasta un 40% de clientes potenciales en Google Maps por perfiles incompletos o falta de respuestas automatizadas a reseñas.
Hemos preparado un análisis gratuito de posicionamiento local para \${lead.name}. ¿Les interesaría revisar un resumen de 2 minutos sobre cómo mejorar su visibilidad y captar más clientes en \${city}?
Quedo atento a su respuesta.
Atentamente,
Equipo de Consultoría Local - Bvelt
contacto@bvelt.com
      \`.trim();

      // Send email via Resend
      await sendEmailWithResend({
        to: lead.email,
        subject,
        textContent,
        agentType: 'b2b_outreach',
        businessName: 'Bvelt'
      });

      // Log sent status in Firestore
      await logRef.set({
        email: lead.email,
        businessName: lead.name,
        city,
        niche,
        phone: lead.phone || null,
        website: lead.website || null,
        sentAt: new Date().toISOString(),
        status: 'sent'
      }, { merge: true });

      sent++;
      console.log(\`[Batch Outreach] (\${sent}/\${maxBusinesses}) Email sent to \${lead.email} (\${lead.name})\`);

      // 1-second delay between emails to adhere to rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (leadErr: any) {
      console.error(\`[Batch Outreach] Error sending to \${lead.email}:\`, leadErr.message || leadErr);
      errors.push(\`\${lead.email}: \${leadErr.message || leadErr}\`);
    }
  }`;

const replacement = `  // 3. Process leads against Firestore outreach_log & send emails via Resend
  const executing = new Set<Promise<void>>();
  for (const lead of leadsWithEmail) {
    if (sent >= maxBusinesses) {
      console.log(\`[Batch Outreach] Reached max target limit of \${maxBusinesses} emails for this batch.\`);
      break;
    }

    const p = (async () => {
      if (sent >= maxBusinesses) return;
      const safeDocId = lead.email.replace(/[^a-z0-9]/g, '_');

      try {
        // Check if lead was already contacted
        const logRef = db.collection('outreach_log').doc(safeDocId);
        const logSnap = await logRef.get();

        if (logSnap.exists) {
          skipped_already_logged++;
          return;
        }

        const subject = \`Estrategia de Visibilidad Local para \${lead.name} (\${city})\`;
        const textContent = \`Hola equipo de \${lead.name},
Les escribo directamente tras revisar la presencia local de los negocios de \${niche} en \${city}. Actualmente, muchas empresas de la zona están perdiendo hasta un 40% de clientes potenciales en Google Maps por perfiles incompletos o falta de respuestas automatizadas a reseñas.
Hemos preparado un análisis gratuito de posicionamiento local para \${lead.name}. ¿Les interesaría revisar un resumen de 2 minutos sobre cómo mejorar su visibilidad y captar más clientes en \${city}?
Quedo atento a su respuesta.
Atentamente,
Equipo de Consultoría Local - Bvelt
contacto@bvelt.com
      \`.trim();

        // Send email via Resend
        await sendEmailWithResend({
          to: lead.email,
          subject,
          textContent,
          agentType: 'b2b_outreach',
          businessName: 'Bvelt'
        });

        // Log sent status in Firestore
        await logRef.set({
          email: lead.email,
          businessName: lead.name,
          city,
          niche,
          phone: lead.phone || null,
          website: lead.website || null,
          sentAt: new Date().toISOString(),
          status: 'sent'
        }, { merge: true });

        sent++;
        console.log(\`[Batch Outreach] (\${sent}/\${maxBusinesses}) Email sent to \${lead.email} (\${lead.name})\`);

        // 1-second delay between emails to adhere to rate limits
        await new Promise(r => setTimeout(r, 1000));
      } catch (leadErr: any) {
        console.error(\`[Batch Outreach] Error sending to \${lead.email}:\`, leadErr.message || leadErr);
        errors.push(\`\${lead.email}: \${leadErr.message || leadErr}\`);
      }
    })();

    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= 5) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);`;

// Let's do a more robust replace using regex
const regex = /\/\/ 3\. Process leads against Firestore outreach_log & send emails via Resend[\s\S]*?(?=return \{)/;

if (regex.test(code)) {
  code = code.replace(regex, replacement + '\n  ');
  fs.writeFileSync('api/batch-outreach.ts', code, 'utf-8');
  console.log("Replaced successfully!");
} else {
  console.log("Regex did not match.");
}
