import webpush from 'web-push';

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const contact = process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@example.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(contact, publicKey, privateKey);
}

export function getVapidPublicKey() {
  return publicKey || '';
}

export function isPushConfigured() {
  return Boolean(publicKey && privateKey);
}

export async function sendWebPush(
  subscription: webpush.PushSubscription,
  payload: Record<string, unknown>
) {
  if (!isPushConfigured()) return;
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
