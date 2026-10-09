import { listNotifications } from '@/app/actions/push';
import { NotificationsList } from '@/components/notifications-list';
import { parsePage } from '@/lib/pagination';

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  // 20 notifications par page ; total et non lues comptés par la base.
  const initial = await listNotifications({ page: parsePage(params.page) });
  return <NotificationsList initial={initial} />;
}
