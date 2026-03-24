self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nouvelle notification';
  const options = {
    body: data.body || '',
    icon: '/icon-light-32x32.png',
    badge: '/icon-light-32x32.png',
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(clients.openWindow(targetUrl));
});
