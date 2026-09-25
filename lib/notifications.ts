import { getAdminSupabase } from '@/lib/supabase';
import { sendWebPush } from '@/lib/push';
import { getTranslations } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/config';

// Notifications in-app + push. Ce module n'est PAS un fichier 'use server' :
// ses fonctions ne doivent jamais être appelables depuis le navigateur.
// Chaque destinataire reçoit le texte dans sa propre langue (users.locale).

export type NotificationI18n = ReturnType<typeof getTranslations>;
export type NotificationMessage = (i18n: NotificationI18n) => { title: string; body: string };

type Recipient = { id: string; locale: Locale };

/** Destinataires avec leur langue ; tolère l'absence de la colonne `locale` (docs/phase11-locale.sql). */
async function loadRecipients(
  filter: (query: any) => any
): Promise<Recipient[]> {
  const admin = getAdminSupabase();
  let { data, error } = await filter(admin.from('users').select('id, locale'));
  if (error) ({ data } = await filter(admin.from('users').select('id')));
  return ((data || []) as { id: string; locale?: string }[]).map((u) => ({
    id: u.id,
    locale: isLocale(u.locale) ? u.locale : DEFAULT_LOCALE,
  }));
}

async function deliver(input: {
  structureId: string;
  recipients: Recipient[];
  message: NotificationMessage;
  url?: string;
  /** Limite les abonnements push à ceux enregistrés pour ce point. */
  pushScopedToStructure?: boolean;
}) {
  if (!input.recipients.length) return;
  const admin = getAdminSupabase();

  const contents = new Map<Locale, { title: string; body: string }>();
  const contentFor = (locale: Locale) => {
    if (!contents.has(locale)) contents.set(locale, input.message(getTranslations(locale)));
    return contents.get(locale)!;
  };
  const localeOf = new Map(input.recipients.map((r) => [r.id, r.locale]));

  await admin.from('notifications').insert(
    input.recipients.map((r) => ({
      user_id: r.id,
      structure_id: input.structureId,
      ...contentFor(r.locale),
      url: input.url || null,
      is_read: false,
    }))
  );

  let query = admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', input.recipients.map((r) => r.id));
  if (input.pushScopedToStructure) query = query.eq('structure_id', input.structureId);
  const { data: subscriptions } = await query;
  if (!subscriptions?.length) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { ...contentFor(localeOf.get(sub.user_id) ?? DEFAULT_LOCALE), url: input.url }
        );
      } catch (error: any) {
        const code = Number(error?.statusCode || 0);
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    })
  );
}

/** Notifie le personnel actif d'un point (par rôle). N'interrompt jamais l'action appelante. */
export async function notifyStructureStaff(input: {
  structureId: string;
  message: NotificationMessage;
  url?: string;
  roles?: string[];
}) {
  try {
    const recipients = await loadRecipients((query) =>
      query
        .eq('structure_id', input.structureId)
        .in('role', input.roles || ['ADMIN', 'CAISSE', 'SUPER_ADMIN', 'RECEPTION'])
        .eq('is_active', true)
    );
    await deliver({ ...input, recipients, pushScopedToStructure: true });
  } catch (error) {
    console.error('[notifyStructureStaff]', error);
  }
}

/** Notifie un utilisateur précis. N'interrompt jamais l'action appelante. */
export async function notifyUser(input: {
  userId: string;
  structureId: string;
  message: NotificationMessage;
  url?: string;
}) {
  try {
    const recipients = await loadRecipients((query) => query.eq('id', input.userId));
    await deliver({ ...input, recipients });
  } catch (error) {
    console.error('[notifyUser]', error);
  }
}
