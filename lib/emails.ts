import { after } from 'next/server';
import { appUrl, sendMail, type MailContent } from '@/lib/mail';
import { getAdminSupabase } from '@/lib/supabase';
import { createPasswordToken } from '@/lib/password-tokens';
import { moduleLabel } from '@/lib/modules';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config';
import { getTranslations } from '@/lib/i18n/server';
import type { TranslationKey } from '@/lib/i18n/translate';

// ─────────────────────────────────────────────────────────
// Emails métier de Shede : destinataires + contenus, dans la langue du
// destinataire (users.locale, docs/phase11-locale.sql).
// Tous les envois passent par `queueMail`, qui les exécute après la réponse
// (next/server `after`) : l'action utilisateur n'attend pas le serveur SMTP
// et n'échoue jamais à cause de lui.
// ─────────────────────────────────────────────────────────

export type OutgoingMail = { to: string | string[]; subject: string; content: MailContent };
export type Recipient = { email: string; locale: Locale };

/** Planifie un ou plusieurs emails après la réponse. `build` peut renvoyer null. */
export function queueMail(build: () => Promise<OutgoingMail | OutgoingMail[] | null>) {
  after(async () => {
    try {
      const result = await build();
      const mails = Array.isArray(result) ? result : result ? [result] : [];
      for (const mail of mails) await sendMail(mail);
    } catch (error) {
      console.error('[mail] préparation impossible :', error);
    }
  });
}

// ── Destinataires ───────────────────────────────────────

function toRecipient(row: { email: string; locale?: string | null }): Recipient {
  return { email: row.email, locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE };
}

/** Langue enregistrée d'un utilisateur (français par défaut). */
export async function getUserLocale(userId: string): Promise<Locale> {
  const { data } = await getAdminSupabase().from('users').select('*').eq('id', userId).maybeSingle();
  return isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE;
}

/** Administrateurs actifs d'une organisation ; à défaut, les admins de ses points. */
export async function getOrganizationAdminRecipients(organizationId: string): Promise<Recipient[]> {
  const admin = getAdminSupabase();
  const { data: orgAdmins } = await admin
    .from('users')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('role', 'ORG_ADMIN')
    .eq('is_active', true);

  if (orgAdmins?.length) return orgAdmins.map(toRecipient);

  const { data: pointAdmins } = await admin
    .from('users')
    .select('*, structures!inner(organization_id)')
    .eq('structures.organization_id', organizationId)
    .eq('role', 'ADMIN')
    .eq('is_active', true);

  return (pointAdmins || []).map(toRecipient);
}

export async function getPointAdminRecipients(pointId: string): Promise<Recipient[]> {
  const { data } = await getAdminSupabase()
    .from('users')
    .select('*')
    .eq('structure_id', pointId)
    .eq('role', 'ADMIN')
    .eq('is_active', true);
  return (data || []).map(toRecipient);
}

/** Un email par langue pour une liste de destinataires. */
function perLocale(recipients: Recipient[], build: (locale: Locale, to: string[]) => OutgoingMail): OutgoingMail[] {
  const groups = new Map<Locale, string[]>();
  for (const r of recipients) groups.set(r.locale, [...(groups.get(r.locale) ?? []), r.email]);
  return [...groups.entries()].map(([locale, to]) => build(locale, to));
}

// ── Aides de contenu ────────────────────────────────────

function mailKit(locale: Locale) {
  const { t, format } = getTranslations(locale);
  return {
    t,
    format,
    greeting: (firstName?: string | null) =>
      firstName ? t('emails.helloName', { name: firstName }) : t('emails.hello'),
    role: (role: string) => t(`roles.${role}` as TranslationKey),
    date: (iso: string | null | undefined) => (iso ? format.date(iso, { dateStyle: 'long' }) : t('emails.unlimited')),
    base: { lang: locale, footer: t('emails.footer') },
  };
}

// ── Contenus ────────────────────────────────────────────

/**
 * Compte créé par un tiers (super admin, ORG_ADMIN, admin de point) : on
 * n'envoie jamais le mot de passe, mais un lien pour en choisir un (7 jours).
 */
export async function buildAccountCreatedMail(input: {
  userId: string;
  email: string;
  firstName?: string | null;
  role: string;
  scopeName?: string | null;
  locale: Locale;
}): Promise<OutgoingMail> {
  const { t, greeting, role, base } = mailKit(input.locale);
  const token = await createPasswordToken(input.userId, 'INVITE');
  const scope = input.scopeName || t('emails.fallbackStructure');

  return {
    to: input.email,
    subject: t('emails.accountCreated.subject', { scope }),
    content: {
      ...base,
      title: t('emails.accountCreated.title'),
      paragraphs: [
        greeting(input.firstName),
        t('emails.accountCreated.intro', { role: role(input.role), scope }),
        token ? t('emails.accountCreated.withLink') : t('emails.accountCreated.withoutLink'),
      ],
      details: [
        { label: t('emails.labels.login'), value: input.email },
        { label: t('emails.labels.role'), value: role(input.role) },
        { label: t('emails.labels.scope'), value: scope },
      ],
      action: token
        ? { label: t('emails.accountCreated.action'), url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`) }
        : { label: t('emails.signIn'), url: appUrl('/login') },
      footnote: token ? t('emails.accountCreated.footnote', { url: appUrl('/login') }) : undefined,
    },
  };
}

export function buildBusinessWelcomeMail(input: {
  email: string;
  firstName: string;
  organizationName: string;
  trialEndsAt?: string | null;
  locale: Locale;
}): OutgoingMail {
  const { t, greeting, date, base } = mailKit(input.locale);
  const organization = input.organizationName;
  return {
    to: input.email,
    subject: t('emails.businessWelcome.subject', { organization }),
    content: {
      ...base,
      title: t('emails.businessWelcome.title'),
      paragraphs: [greeting(input.firstName), t('emails.businessWelcome.body', { organization })],
      details: [
        { label: t('emails.labels.login'), value: input.email },
        ...(input.trialEndsAt ? [{ label: t('emails.labels.trialEnd'), value: date(input.trialEndsAt) }] : []),
      ],
      action: { label: t('emails.openSpace'), url: appUrl('/login') },
    },
  };
}

export function buildClientWelcomeMail(input: { email: string; firstName: string; locale: Locale }): OutgoingMail {
  const { t, greeting, base } = mailKit(input.locale);
  return {
    to: input.email,
    subject: t('emails.clientWelcome.subject'),
    content: {
      ...base,
      title: t('emails.clientWelcome.title'),
      paragraphs: [greeting(input.firstName), t('emails.clientWelcome.body')],
      details: [{ label: t('emails.labels.login'), value: input.email }],
      action: { label: t('emails.clientWelcome.action'), url: appUrl('/client') },
    },
  };
}

export function buildPasswordResetMail(input: {
  email: string;
  firstName?: string | null;
  token: string;
  locale: Locale;
}): OutgoingMail {
  const { t, greeting, base } = mailKit(input.locale);
  return {
    to: input.email,
    subject: t('emails.passwordReset.subject'),
    content: {
      ...base,
      title: t('emails.passwordReset.title'),
      paragraphs: [greeting(input.firstName), t('emails.passwordReset.body')],
      action: {
        label: t('emails.passwordReset.action'),
        url: appUrl(`/reset-password?token=${encodeURIComponent(input.token)}`),
      },
      footnote: t('emails.passwordReset.footnote'),
    },
  };
}

export function buildPasswordChangedMail(input: { email: string; firstName?: string | null; locale: Locale }): OutgoingMail {
  const { t, greeting, base } = mailKit(input.locale);
  return {
    to: input.email,
    subject: t('emails.passwordChanged.subject'),
    content: {
      ...base,
      title: t('emails.passwordChanged.title'),
      paragraphs: [greeting(input.firstName), t('emails.passwordChanged.body'), t('emails.passwordChanged.warning')],
      action: { label: t('emails.signIn'), url: appUrl('/login') },
    },
  };
}

export function buildLicenseChangedMails(input: {
  recipients: Recipient[];
  organizationName?: string | null;
  isActive: boolean;
  expiresAt: string | null;
  maxPoints: number;
}): OutgoingMail[] {
  return perLocale(input.recipients, (locale, to) => {
    const { t, date, base } = mailKit(locale);
    const organization = input.organizationName || t('emails.fallbackOrganization');
    return {
      to,
      subject: input.isActive
        ? t('emails.license.subjectUpdated', { organization })
        : t('emails.license.subjectDisabled', { organization }),
      content: {
        ...base,
        title: input.isActive ? t('emails.license.titleUpdated') : t('emails.license.titleDisabled'),
        paragraphs: [
          t('emails.hello'),
          input.isActive
            ? t('emails.license.bodyUpdated', { organization })
            : t('emails.license.bodyDisabled', { organization }),
        ],
        details: [
          { label: t('emails.labels.status'), value: input.isActive ? t('emails.license.active') : t('emails.license.disabled') },
          { label: t('emails.labels.expiry'), value: date(input.expiresAt) },
          { label: t('emails.labels.maxPoints'), value: String(input.maxPoints) },
        ],
        action: input.isActive ? { label: t('emails.openSpace'), url: appUrl('/login') } : undefined,
      },
    };
  });
}

export function buildModulesChangedMails(input: {
  recipients: Recipient[];
  organizationName: string;
  added: string[];
  removed: string[];
}): OutgoingMail[] {
  return perLocale(input.recipients, (locale, to) => {
    const { t, base } = mailKit(locale);
    const organization = input.organizationName;
    const list = (codes: string[]) => codes.map((code) => moduleLabel(t, code)).join(', ');
    return {
      to,
      subject: t('emails.modules.subject', { organization }),
      content: {
        ...base,
        title: t('emails.modules.title'),
        paragraphs: [t('emails.hello'), t('emails.modules.body', { organization })],
        details: [
          ...(input.added.length ? [{ label: t('emails.labels.added'), value: list(input.added) }] : []),
          ...(input.removed.length ? [{ label: t('emails.labels.removed'), value: list(input.removed) }] : []),
        ],
        action: { label: t('emails.openSpace'), url: appUrl('/login') },
      },
    };
  });
}

export function buildPointStatusMails(input: { recipients: Recipient[]; pointName: string; isActive: boolean }): OutgoingMail[] {
  return perLocale(input.recipients, (locale, to) => {
    const { t, base } = mailKit(locale);
    const point = input.pointName;
    return {
      to,
      subject: input.isActive ? t('emails.pointStatus.subjectEnabled', { point }) : t('emails.pointStatus.subjectDisabled', { point }),
      content: {
        ...base,
        title: input.isActive ? t('emails.pointStatus.titleEnabled') : t('emails.pointStatus.titleDisabled'),
        paragraphs: [
          t('emails.hello'),
          input.isActive ? t('emails.pointStatus.bodyEnabled', { point }) : t('emails.pointStatus.bodyDisabled', { point }),
        ],
        action: input.isActive ? { label: t('emails.signIn'), url: appUrl('/login') } : undefined,
      },
    };
  });
}

export function buildAccountStatusMail(input: {
  email: string;
  firstName?: string | null;
  isActive: boolean;
  scopeName?: string | null;
  locale: Locale;
}): OutgoingMail {
  const { t, greeting, base } = mailKit(input.locale);
  const scope = input.scopeName || t('emails.fallbackStructure');
  return {
    to: input.email,
    subject: input.isActive ? t('emails.accountStatus.subjectEnabled') : t('emails.accountStatus.subjectDisabled'),
    content: {
      ...base,
      title: input.isActive ? t('emails.accountStatus.titleEnabled') : t('emails.accountStatus.titleDisabled'),
      paragraphs: [
        greeting(input.firstName),
        input.isActive ? t('emails.accountStatus.bodyEnabled', { scope }) : t('emails.accountStatus.bodyDisabled', { scope }),
      ],
      action: input.isActive ? { label: t('emails.signIn'), url: appUrl('/login') } : undefined,
    },
  };
}

export function buildRoleChangedMail(input: {
  email: string;
  firstName?: string | null;
  previousRole: string;
  role: string;
  scopeName?: string | null;
  locale: Locale;
}): OutgoingMail {
  const { t, greeting, role, base } = mailKit(input.locale);
  const scope = input.scopeName || t('emails.fallbackStructure');
  return {
    to: input.email,
    subject: t('emails.roleChanged.subject'),
    content: {
      ...base,
      title: t('emails.roleChanged.title'),
      paragraphs: [greeting(input.firstName), t('emails.roleChanged.body', { scope })],
      details: [
        { label: t('emails.labels.previousRole'), value: role(input.previousRole) },
        { label: t('emails.labels.newRole'), value: role(input.role) },
      ],
      action: { label: t('emails.signIn'), url: appUrl('/login') },
    },
  };
}

export function buildLicenseExpiringMails(input: {
  recipients: Recipient[];
  organizationName?: string | null;
  expiresAt: string;
  daysLeft: number;
  isTrial: boolean;
}): OutgoingMail[] {
  return perLocale(input.recipients, (locale, to) => {
    const { t, date, base } = mailKit(locale);
    const organization = input.organizationName || t('emails.fallbackOrganization');
    const what = input.isTrial ? t('emails.licenseExpiring.trial') : t('emails.licenseExpiring.license');
    const when = input.daysLeft <= 1 ? t('emails.licenseExpiring.tomorrow') : t('emails.licenseExpiring.inDays', { days: input.daysLeft });
    return {
      to,
      subject: t('emails.licenseExpiring.subject', { what, when, organization }),
      content: {
        ...base,
        title: t('emails.licenseExpiring.title', { what, when }),
        paragraphs: [
          t('emails.hello'),
          t('emails.licenseExpiring.body', { what, organization, date: date(input.expiresAt) }),
          t('emails.licenseExpiring.contact'),
        ],
        details: [{ label: t('emails.labels.expiryDate'), value: date(input.expiresAt) }],
        action: { label: t('emails.openSpace'), url: appUrl('/login') },
      },
    };
  });
}
