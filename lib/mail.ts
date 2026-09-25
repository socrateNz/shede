import nodemailer, { type Transporter } from 'nodemailer';

// ─────────────────────────────────────────────────────────
// Envoi d'emails transactionnels (SMTP).
// Réservé au serveur (Server Actions / routes API) : utilise des secrets.
//
// Règle : un échec d'envoi ne fait jamais échouer l'action métier qui l'a
// déclenché (création de compte, commande…). L'erreur est journalisée et
// `sendMail` renvoie { ok: false }.
// ─────────────────────────────────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSW;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = TLS implicite ; 587 = STARTTLS
    auth: { user, pass },
  });
  return transporter;
}

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSW);
}

/** URL publique de l'application, pour les liens dans les emails. */
export function appUrl(path = '/') {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type MailContent = {
  /** Titre affiché en haut de l'email. */
  title: string;
  /** Paragraphes (texte brut, échappé automatiquement). */
  paragraphs: string[];
  /** Lignes clé / valeur mises en évidence (identifiants, montants…). */
  details?: { label: string; value: string }[];
  /** Bouton d'action principal. */
  action?: { label: string; url: string };
  /** Petite note en bas de l'email. */
  footnote?: string;
  /** Langue de l'email (attribut lang). */
  lang?: string;
  /** Mention « email automatique » sous le message. */
  footer?: string;
};

/** Gabarit HTML commun (styles en ligne pour la compatibilité des clients mail). */
export function renderMail(content: MailContent): { html: string; text: string } {
  const details = content.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;background:#f8fafc;border-radius:8px">
        ${content.details
          .map(
            (d) => `<tr>
              <td style="padding:8px 12px;color:#64748b;font-size:14px;white-space:nowrap">${escapeHtml(d.label)}</td>
              <td style="padding:8px 12px;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(d.value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  const action = content.action
    ? `<p style="margin:24px 0">
        <a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px">${escapeHtml(content.action.label)}</a>
      </p>`
    : '';

  const html = `<!doctype html>
<html lang="${escapeHtml(content.lang ?? 'fr')}">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
          <tr><td style="background:#0f172a;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:700">Shede</td></tr>
          <tr><td style="padding:24px">
            <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escapeHtml(content.title)}</h1>
            ${content.paragraphs
              .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155">${escapeHtml(p)}</p>`)
              .join('')}
            ${details}
            ${action}
            ${content.footnote ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(content.footnote)}</p>` : ''}
          </td></tr>
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(content.footer ?? 'Email automatique envoyé par Shede — merci de ne pas y répondre.')}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    content.title,
    '',
    ...content.paragraphs,
    ...(content.details?.length ? ['', ...content.details.map((d) => `${d.label} : ${d.value}`)] : []),
    ...(content.action ? ['', `${content.action.label} : ${content.action.url}`] : []),
    ...(content.footnote ? ['', content.footnote] : []),
  ].join('\n');

  return { html, text };
}

export async function sendMail(input: {
  to: string | string[];
  subject: string;
  content: MailContent;
}): Promise<{ ok: boolean; error?: string }> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: 'Aucun destinataire' };

  const transport = getTransporter();
  if (!transport) {
    console.warn('[mail] SMTP non configuré — email non envoyé :', input.subject);
    return { ok: false, error: 'SMTP non configuré' };
  }

  try {
    const { html, text } = renderMail(input.content);
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject: input.subject,
      html,
      text,
    });
    return { ok: true };
  } catch (error: any) {
    console.error('[mail] échec d’envoi :', input.subject, error?.message ?? error);
    return { ok: false, error: error?.message ?? 'Échec d’envoi' };
  }
}
