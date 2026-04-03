'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { subscribePush, unsubscribePush, getPublicKey, sendTestNotification } from '@/app/actions/push';
import { toast } from 'sonner';

export function PushSubscriptionToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscription) {
        // Unsubscribe
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribePush(endpoint);
        setSubscription(null);
        toast.success('Notifications désactivées');
      } else {
        // Subscribe
        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        
        if (permissionResult !== 'granted') {
          toast.error('Permission refusée');
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const publicKey = await getPublicKey();
        
        if (!publicKey) {
          toast.error('Configuration Push manquante sur le serveur');
          return;
        }

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const res = await subscribePush({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh')!) as any)),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth')!) as any)),
          },
        });

        if (res.success) {
          setSubscription(sub);
          toast.success('Notifications activées avec succès !');
        } else {
          toast.error(res.error || 'Erreur lors de l\'abonnement');
        }
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await sendTestNotification();
      if (res.success) {
        toast.info('Notification de test envoyée !');
      } else {
        toast.error('Échec de l\'envoi du test');
      }
    } catch (error) {
      toast.error('Erreur lors du test');
    } finally {
      setIsTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-slate-500 italic">
        Votre navigateur ne supporte pas les notifications push.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${subscription ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
          {subscription ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">
            {subscription ? 'Notifications activées' : 'Notifications désactivées'}
          </p>
          <p className="text-xs text-slate-500">
            {subscription ? 'Vous recevrez des alertes en temps réel sur cet appareil.' : 'Activez-les pour ne rien manquer.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {subscription && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || isTesting}
            onClick={handleTest}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tester'}
          </Button>
        )}
        <Button
          variant={subscription ? "outline" : "default"}
          size="sm"
          disabled={loading || permission === 'denied'}
          onClick={handleToggle}
          className={subscription ? "border-slate-700 text-slate-300" : "bg-blue-600 hover:bg-blue-700"}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : subscription ? (
            'Désactiver'
          ) : (
            'Activer'
          )}
        </Button>
      </div>
    </div>
  );
}
