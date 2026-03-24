'use client';

import { sendTestPushNotification, subscribePush, unsubscribePush } from '@/app/actions/push';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSettings({
  vapidPublicKey,
  initialSubscriptionCount = 0,
}: {
  vapidPublicKey: string;
  initialSubscriptionCount?: number;
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(initialSubscriptionCount);

  const enablePush = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setMessage('Push non supporte sur ce navigateur.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Permission de notification refusee.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const result = await subscribePush(subscription.toJSON());
      if (result.success) {
        setSubscriptionCount((prev) => prev + 1);
        setMessage('Notifications push activees.');
      } else {
        setMessage(result.error || 'Erreur activation push');
      }
    } catch (error) {
      setMessage('Erreur lors de l activation des notifications.');
    } finally {
      setLoading(false);
    }
  };

  const disablePush = async () => {
    setLoading(true);
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
        setSubscriptionCount((prev) => Math.max(0, prev - 1));
      }
      setMessage('Notifications push desactivees.');
    } catch (error) {
      setMessage('Erreur lors de la desactivation.');
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await sendTestPushNotification();
      setMessage(result.success ? 'Notification test envoyee.' : (result.error || 'Erreur test push'));
    } finally {
      setLoading(false);
    }
  };

  if (!vapidPublicKey) {
    return (
      <p className="text-amber-400 text-sm">
        Push non configure. Ajoute les cles VAPID dans `.env`.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        Appareils abonnes pour ce compte: <span className="font-semibold text-slate-100">{subscriptionCount}</span>
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={enablePush} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          Activer les notifications push
        </Button>
        <Button type="button" onClick={disablePush} disabled={loading} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          Desactiver
        </Button>
        <Button type="button" onClick={sendTest} disabled={loading} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
          Tester
        </Button>
      </div>
      {message && <p className="text-sm text-slate-300">{message}</p>}
    </div>
  );
}
