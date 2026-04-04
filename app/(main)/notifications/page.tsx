'use client';

import { useEffect, useState } from 'react';
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/push';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Check, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    const data = await getMyNotifications(100);
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    const res = await markNotificationAsRead(id);
    if (res.success) {
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
    }
  };

  const handleMarkAllAsRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.success) {
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Centre de Notifications</h1>
          <p className="text-slate-400 font-medium">Restez informé des activités de votre établissement</p>
        </div>
        <div className="flex items-center gap-2">
          {notifications.some(n => !n.is_read) && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              Tout marquer comme lu
            </Button>
          )}
          <Bell className="w-8 h-8 text-blue-500 opacity-50 hidden sm:block" />
        </div>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-slate-50 flex items-center gap-2">
            Historique récent
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Chargement...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Aucune notification pour le moment.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/50">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`p-4 hover:bg-slate-700/30 transition-colors flex items-start gap-4 ${!notif.is_read ? 'bg-blue-500/5 shadow-[inset_4px_0_0_0_#3b82f6]' : ''}`}
                >
                  <div className={`mt-1 p-2 rounded-full ${!notif.is_read ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-500'}`}>
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={`font-semibold text-sm sm:text-base ${!notif.is_read ? 'text-slate-50' : 'text-slate-400'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                      {notif.body}
                    </p>
                    <div className="flex items-center gap-3">
                      {notif.url && (
                        <Link 
                          href={notif.url}
                          onClick={() => {
                            if (!notif.is_read) {
                              handleMarkAsRead(notif.id);
                            }
                          }}
                        >
                          <Button size="sm" variant="outline" className="h-8 text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1.5">
                            Voir le détail <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                      {!notif.is_read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="h-8 text-xs text-slate-500 hover:text-slate-300 gap-1.5"
                        >
                          Marquer comme lu <Check className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
