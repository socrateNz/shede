'use server';

import { getSession } from '@/lib/auth';
import { sendWebPush } from '@/lib/push';
import { getAdminSupabase } from '@/lib/supabase';

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
    return { success: false, error: 'Unauthorized' };
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { success: false, error: 'Invalid subscription payload' };
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
      return { success: false, error: 'Failed to save subscription' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Push subscription failed' };
  }
}

export async function unsubscribePush(endpoint: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
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
    return { success: false, error: 'Failed to unsubscribe' };
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
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const admin = getAdminSupabase();
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', session.userId);

    if (!subscriptions?.length) {
      return { success: false, error: 'Aucun appareil abonne pour ce compte.' };
    }

    await createNotificationsForUsers({
      structureId: session.structureId,
      userIds: [session.userId],
      title: 'Test notification',
      body: 'Les notifications push fonctionnent correctement.',
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
            {
              title: 'Test notification',
              body: 'Les notifications push fonctionnent correctement.',
              url: '/notifications',
            }
          );
        } catch (error) {
          // Ignore individual endpoint failures to keep test resilient.
        }
      })
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Echec de l envoi du test push.' };
  }
}

export async function notifyStructureOrderCreated(input: {
  structureId: string;
  title: string;
  body: string;
  url: string;
}) {
  try {
    const admin = getAdminSupabase();
    const { data: recipients } = await admin
      .from('users')
      .select('id')
      .eq('structure_id', input.structureId)
      .in('role', ['ADMIN', 'CAISSE', 'SUPER_ADMIN'])
      .eq('is_active', true);

    if (!recipients?.length) return;

    const recipientIds = recipients.map((r) => r.id);
    await createNotificationsForUsers({
      structureId: input.structureId,
      userIds: recipientIds,
      title: input.title,
      body: input.body,
      url: input.url,
    });

    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', recipientIds)
      .eq('structure_id', input.structureId);

    if (!subscriptions?.length) return;

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
            {
              title: input.title,
              body: input.body,
              url: input.url,
            }
          );
        } catch (error: any) {
          const code = Number(error?.statusCode || 0);
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      })
    );
  } catch (error) {
    // Keep order flow resilient; push failures should not block transactions.
    console.error('Push notification error:', error);
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
