'use server';

import { getSession } from '@/lib/auth';
import { sendWebPush, getVapidPublicKey } from '@/lib/push';
import { getAdminSupabase } from '@/lib/supabase';
import { buildMeta, emptyPage, pageRange, settlePage, type Paginated } from '@/lib/pagination';
import { getT, te } from '@/lib/i18n/server';
import { notifyUser } from '@/lib/notifications';

export async function getPublicKey() {
  return getVapidPublicKey();
}

interface PushSubscriptionPayload {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

async function createNotificationsForUsers(input: {
  structureId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}) {
  if (!input.userIds.length) return;

  const admin = getAdminSupabase();
  await admin.from('notifications').insert(
    input.userIds.map((userId) => ({
      user_id: userId,
      structure_id: input.structureId,
      title: input.title,
      body: input.body,
      url: input.url || null,
      is_read: false,
    }))
  );
}

export async function subscribePush(subscription: PushSubscriptionPayload) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { success: false, error: await te('errors.invalidSubscription') };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_id: session.userId,
          structure_id: session.structureId,
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      return { success: false, error: await te('errors.subscriptionSaveFailed') };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.subscriptionFailed') };
  }
}

export async function unsubscribePush(endpoint: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: await te('errors.unauthorized') };
  }

  try {
    const admin = getAdminSupabase();
    await admin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', session.userId);

    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.unsubscribeFailed') };
  }
}

export async function getMyPushSubscriptionsCount() {
  const session = await getSession();
  if (!session) return 0;

  try {
    const admin = getAdminSupabase();
    const { count } = await admin
      .from('push_subscriptions')
      .select('endpoint', { count: 'exact', head: true })
      .eq('user_id', session.userId);

    return count || 0;
  } catch (error) {
    return 0;
  }
}

export async function sendTestPushNotification() {
  const session = await getSession();
  if (!session) return { success: false, error: await te('errors.unauthorized') };

  try {
    const admin = getAdminSupabase();
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', session.userId);

    if (!subscriptions?.length) {
      return { success: false, error: await te('errors.noSubscribedDevice') };
    }

    const { t } = await getT();
    const content = { title: t('notify.test.title'), body: t('notify.test.body') };
    await createNotificationsForUsers({
      structureId: session.structureId!,
      userIds: [session.userId],
      ...content,
      url: '/notifications',
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await sendWebPush(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            { ...content, url: '/notifications' }
          );
        } catch (error) {
          // Ignore individual endpoint failures to keep test resilient.
        }
      })
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: await te('errors.pushTestFailed') };
  }
}

export async function getMyNotifications(limit: number = 50) {
  const session = await getSession();
  if (!session) return [];

  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from('notifications')
      .select('id, title, body, url, is_read, created_at')
      .eq('user_id', session.userId)
      .eq('structure_id', session.structureId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    return [];
  }
}

export type NotificationListStats = { total: number; unread: number };

/** Notifications de l'utilisateur connecté, 20 par page (les plus récentes d'abord), avec total et non lues. */
export async function listNotifications(filters: { page?: number } = {}): Promise<Paginated<any, NotificationListStats>> {
  const empty: NotificationListStats = { total: 0, unread: 0 };
  const session = await getSession();
  const page = Math.max(1, filters.page ?? 1);
  if (!session) return emptyPage(empty, page);
  const admin = getAdminSupabase();
  const [from, to] = pageRange(page);
  const mine = () => {
    let q = admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.userId);
    return session.structureId ? q.eq('structure_id', session.structureId) : q.is('structure_id', null);
  };
  let list = admin
    .from('notifications')
    .select('id, title, body, url, is_read, created_at', { count: 'exact' })
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  list = session.structureId ? list.eq('structure_id', session.structureId) : list.is('structure_id', null);

  const [{ data, count }, unread] = await Promise.all([settlePage(list), mine().eq('is_read', false)]);
  const total = count ?? 0;
  return { items: data ?? [], meta: buildMeta(page, total, { total, unread: unread.count ?? 0 }) };
}

export async function getUnreadNotificationsCount() {
  const session = await getSession();
  if (!session) return 0;

  try {
    const admin = getAdminSupabase();
    const { count } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.userId)
      .eq('structure_id', session.structureId)
      .eq('is_read', false);

    return count || 0;
  } catch (error) {
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const session = await getSession();
  if (!session) return { success: false };

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', session.userId);

    if (error) return { success: false, error: await te('errors.markReadFailed') };
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function markAllNotificationsAsRead() {
  const session = await getSession();
  if (!session) return { success: false };

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.userId)
      .eq('structure_id', session.structureId!)
      .eq('is_read', false);

    if (error) return { success: false, error: await te('errors.markAllReadFailed') };
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function sendTestNotification() {
  const session = await getSession();
  if (!session) return { success: false };

  await notifyUser({
    userId: session.userId,
    structureId: session.structureId!,
    message: ({ t }) => ({ title: t('notify.test.title'), body: t('notify.test.settingsBody') }),
    url: '/settings',
  });

  return { success: true };
}
