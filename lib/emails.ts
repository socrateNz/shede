import { after } from 'next/server';
import { appUrl, sendMail, type MailContent } from '@/lib/mail';
import { getAdminSupabase } from '@/lib/supabase';
import { createPasswordToken } from '@/lib/password-tokens';
import { getModuleLabel } from '@/lib/modules';
import { formatTrialDateFr } from '@/lib/trial';

// ─────────────────────────────────────────────────────────
// Emails métier de Shede : destinataires + contenus.
// Tous les envois passent par `queueMail`, qui les exécute après la réponse
// (next/server `after`) : l'action utilisateur n'attend pas le serveur SMTP
// et n'échoue jamais à cause de lui.
// ─────────────────────────────────────────────────────────

type OutgoingMail = { to: string | string[]; subject: string; content: MailContent };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ORG_ADMIN: "Administrateur d'organisation",
  ADMIN: 'Administrateur du point',
  MANAGER: 'Manager',
  CAISSE: 'Caisse',
  SERVEUR: 'Serveur',
  RECEPTION: 'Réception',
  CUISINIER: 'Cuisinier',
  BAR: 'Bar',
  LIVREUR: 'Livreur',
  COMPTABLE: 'Comptable',
  MAGASINIER: 'Magasinier',
  RH: 'Ressources humaines',
  CLIENT: 'Client',
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function formatDate(iso: string | null | undefined) {
  return iso ? formatTrialDateFr(new Date(iso)) : 'Illimitée';
}

/** Planifie un email après la réponse. `build` peut renvoyer null (rien à envoyer). */
export function queueMail(build: () => Promise<OutgoingMail | null>) {
  after(async () => {
    try {
      const mail = await build();
      if (mail) await sendMail(mail);
    } catch (error) {
      console.error('[mail] préparation impossible :', error);
    }
  });
}

// ── Destinataires ───────────────────────────────────────

/** Administrateurs actifs d'une organisation ; à défaut, les admins de ses points. */
export async function getOrganizationAdminEmails(organizationId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const { data: orgAdmins } = await admin
    .from('users')
    .select('email')
    .eq('organization_id', organizationId)
    .eq('role', 'ORG_ADMIN')
    .eq('is_active', true);

  if (orgAdmins?.length) return orgAdmins.map((u) => u.email);

  const { data: pointAdmins } = await admin
    .from('users')
    .select('email, structures!inner(organization_id)')
    .eq('structures.organization_id', organizationId)
    .eq('role', 'ADMIN')
    .eq('is_active', true);

  return (pointAdmins || []).map((u) => u.email);
}

export async function getPointAdminEmails(pointId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('users')
    .select('email')
    .eq('structure_id', pointId)
    .eq('role', 'ADMIN')
    .eq('is_active', true);
  return (data || []).map((u) => u.email);
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
  scopeName: string;
}): Promise<OutgoingMail> {
  const token = await createPasswordToken(input.userId, 'INVITE');
  const greeting = input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,';

  return {
    to: input.email,
    subject: `Votre accès Shede — ${input.scopeName}`,
    content: {
      title: 'Votre compte a été créé',
      paragraphs: [
        greeting,
        `Un compte « ${roleLabel(input.role)} » vient d'être créé pour vous sur Shede, pour ${input.scopeName}.`,
        token
          ? "Pour des raisons de sécurité, choisissez votre propre mot de passe avec le bouton ci-dessous. Vous pouvez aussi vous connecter avec le mot de passe qui vous a été communiqué."
          : 'Connectez-vous avec le mot de passe qui vous a été communiqué.',
      ],
      details: [
        { label: 'Identifiant', value: input.email },
        { label: 'Rôle', value: roleLabel(input.role) },
        { label: 'Rattachement', value: input.scopeName },
      ],
      action: token
        ? { label: 'Choisir mon mot de passe', url: appUrl(`/reset-password?token=${encodeURIComponent(token)}`) }
        : { label: 'Me connecter', url: appUrl('/login') },
      footnote: token
        ? `Ce lien est valable 7 jours. Page de connexion : ${appUrl('/login')}`
        : undefined,
    },
  };
}

export function buildBusinessWelcomeMail(input: {
  email: string;
  firstName: string;
  organizationName: string;
  trialEndsAt?: string | null;
}): OutgoingMail {
  return {
    to: input.email,
    subject: `Bienvenue sur Shede — ${input.organizationName}`,
    content: {
      title: 'Bienvenue sur Shede',
      paragraphs: [
        `Bonjour ${input.firstName},`,
        `Votre organisation « ${input.organizationName} » est créée. Vous pouvez dès maintenant créer vos points de vente et leurs administrateurs, puis suivre toute votre activité depuis la vue propriétaire.`,
      ],
      details: [
        { label: 'Identifiant', value: input.email },
        ...(input.trialEndsAt ? [{ label: "Fin de la période d'essai", value: formatDate(input.trialEndsAt) }] : []),
      ],
      action: { label: 'Accéder à mon espace', url: appUrl('/login') },
    },
  };
}

export function buildClientWelcomeMail(input: { email: string; firstName: string }): OutgoingMail {
  return {
    to: input.email,
    subject: 'Bienvenue sur Shede',
    content: {
      title: 'Bienvenue sur Shede',
      paragraphs: [
        `Bonjour ${input.firstName},`,
        'Votre compte client est créé. Commandez chez vos établissements préférés, réservez une chambre et retrouvez tout votre historique au même endroit.',
      ],
      details: [{ label: 'Identifiant', value: input.email }],
      action: { label: 'Découvrir les établissements', url: appUrl('/client') },
    },
  };
}

export function buildPasswordResetMail(input: { email: string; firstName?: string | null; token: string }): OutgoingMail {
  return {
    to: input.email,
    subject: 'Réinitialisation de votre mot de passe Shede',
    content: {
      title: 'Réinitialiser votre mot de passe',
      paragraphs: [
        input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,',
        'Vous avez demandé à réinitialiser le mot de passe de votre compte Shede. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
      ],
      action: { label: 'Choisir un nouveau mot de passe', url: appUrl(`/reset-password?token=${encodeURIComponent(input.token)}`) },
      footnote: "Ce lien est valable 1 heure et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
    },
  };
}

export function buildPasswordChangedMail(input: { email: string; firstName?: string | null }): OutgoingMail {
  return {
    to: input.email,
    subject: 'Votre mot de passe Shede a été modifié',
    content: {
      title: 'Mot de passe modifié',
      paragraphs: [
        input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,',
        'Le mot de passe de votre compte Shede vient d\'être modifié.',
        "Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement votre administrateur ou le support.",
      ],
      action: { label: 'Me connecter', url: appUrl('/login') },
    },
  };
}

export function buildLicenseChangedMail(input: {
  to: string[];
  organizationName: string;
  isActive: boolean;
  expiresAt: string | null;
  maxPoints: number;
}): OutgoingMail {
  return {
    to: input.to,
    subject: `Licence ${input.isActive ? 'mise à jour' : 'désactivée'} — ${input.organizationName}`,
    content: {
      title: input.isActive ? 'Votre licence a été mise à jour' : 'Votre licence a été désactivée',
      paragraphs: [
        'Bonjour,',
        input.isActive
          ? `La licence de l'organisation « ${input.organizationName} » a été mise à jour.`
          : `La licence de l'organisation « ${input.organizationName} » a été désactivée : vos points et leur personnel ne peuvent plus accéder à Shede. Contactez le support pour la réactiver.`,
      ],
      details: [
        { label: 'Statut', value: input.isActive ? 'Active' : 'Désactivée' },
        { label: 'Expiration', value: formatDate(input.expiresAt) },
        { label: 'Points autorisés', value: String(input.maxPoints) },
      ],
      action: input.isActive ? { label: 'Accéder à mon espace', url: appUrl('/login') } : undefined,
    },
  };
}

export function buildModulesChangedMail(input: {
  to: string[];
  organizationName: string;
  added: string[];
  removed: string[];
}): OutgoingMail {
  return {
    to: input.to,
    subject: `Modules modifiés — ${input.organizationName}`,
    content: {
      title: 'Les modules de votre licence ont changé',
      paragraphs: [
        'Bonjour,',
        `Les modules de la licence de « ${input.organizationName} » ont été modifiés. Ils s'appliquent à tous vos points, à la prochaine connexion de leur personnel.`,
      ],
      details: [
        ...(input.added.length ? [{ label: 'Ajoutés', value: input.added.map(getModuleLabel).join(', ') }] : []),
        ...(input.removed.length ? [{ label: 'Retirés', value: input.removed.map(getModuleLabel).join(', ') }] : []),
      ],
      action: { label: 'Accéder à mon espace', url: appUrl('/login') },
    },
  };
}

export function buildPointStatusMail(input: { to: string[]; pointName: string; isActive: boolean }): OutgoingMail {
  return {
    to: input.to,
    subject: `${input.pointName} a été ${input.isActive ? 'réactivé' : 'désactivé'}`,
    content: {
      title: input.isActive ? 'Votre point est réactivé' : 'Votre point est désactivé',
      paragraphs: [
        'Bonjour,',
        input.isActive
          ? `Le point « ${input.pointName} » a été réactivé par l'administrateur de l'organisation. Son personnel peut de nouveau se connecter.`
          : `Le point « ${input.pointName} » a été désactivé par l'administrateur de l'organisation. Son personnel ne peut plus se connecter et il n'apparaît plus dans le catalogue client.`,
      ],
      action: input.isActive ? { label: 'Me connecter', url: appUrl('/login') } : undefined,
    },
  };
}

export function buildAccountStatusMail(input: {
  email: string;
  firstName?: string | null;
  isActive: boolean;
  scopeName: string;
}): OutgoingMail {
  return {
    to: input.email,
    subject: `Votre compte Shede a été ${input.isActive ? 'réactivé' : 'désactivé'}`,
    content: {
      title: input.isActive ? 'Compte réactivé' : 'Compte désactivé',
      paragraphs: [
        input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,',
        input.isActive
          ? `Votre accès à Shede pour ${input.scopeName} a été réactivé.`
          : `Votre accès à Shede pour ${input.scopeName} a été désactivé par un administrateur. Contactez-le pour plus d'informations.`,
      ],
      action: input.isActive ? { label: 'Me connecter', url: appUrl('/login') } : undefined,
    },
  };
}

export function buildRoleChangedMail(input: {
  email: string;
  firstName?: string | null;
  previousRole: string;
  role: string;
  scopeName: string;
}): OutgoingMail {
  return {
    to: input.email,
    subject: 'Votre rôle sur Shede a changé',
    content: {
      title: 'Nouveau rôle',
      paragraphs: [
        input.firstName ? `Bonjour ${input.firstName},` : 'Bonjour,',
        `Votre rôle pour ${input.scopeName} a été modifié par un administrateur. Reconnectez-vous pour accéder à vos nouveaux écrans.`,
      ],
      details: [
        { label: 'Ancien rôle', value: roleLabel(input.previousRole) },
        { label: 'Nouveau rôle', value: roleLabel(input.role) },
      ],
      action: { label: 'Me connecter', url: appUrl('/login') },
    },
  };
}

export function buildLicenseExpiringMail(input: {
  to: string[];
  organizationName: string;
  expiresAt: string;
  daysLeft: number;
  isTrial: boolean;
}): OutgoingMail {
  const what = input.isTrial ? "Votre période d'essai" : 'Votre licence';
  const when = input.daysLeft <= 1 ? 'demain' : `dans ${input.daysLeft} jours`;
  return {
    to: input.to,
    subject: `${what} expire ${when} — ${input.organizationName}`,
    content: {
      title: `${what} expire ${when}`,
      paragraphs: [
        'Bonjour,',
        `${what} pour « ${input.organizationName} » expire le ${formatDate(input.expiresAt)}. Passé cette date, vos points et leur personnel ne pourront plus accéder à Shede.`,
        'Contactez le support pour prolonger votre abonnement.',
      ],
      details: [{ label: 'Date d’expiration', value: formatDate(input.expiresAt) }],
      action: { label: 'Accéder à mon espace', url: appUrl('/login') },
    },
  };
}
