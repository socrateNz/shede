import { requireAuth } from '@/app/actions/auth';
import { getMyNotifications, getMyPushSubscriptionsCount } from '@/app/actions/push';
import { PushSettings } from '@/components/push-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVapidPublicKey } from '@/lib/push';

export default async function NotificationsPage() {
  await requireAuth();
  const vapidPublicKey = getVapidPublicKey();
  const subscriptionCount = await getMyPushSubscriptionsCount();
  const notifications = await getMyNotifications(100);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-50 mb-2">Notifications</h1>
        <p className="text-slate-400">Gere les notifications push de votre compte.</p>
      </div>

      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-slate-50">Notifications Push</CardTitle>
        </CardHeader>
        <CardContent>
          <PushSettings
            vapidPublicKey={vapidPublicKey}
            initialSubscriptionCount={subscriptionCount}
          />
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-50">Liste des notifications ({notifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-slate-400">Aucune notification pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification: any) => (
                <div key={notification.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-50 font-medium">{notification.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(notification.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                  <p className="text-slate-300 text-sm mt-1">{notification.body}</p>
                  {notification.url && (
                    <a href={notification.url} className="text-blue-400 text-sm hover:text-blue-300 mt-2 inline-block">
                      Ouvrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
