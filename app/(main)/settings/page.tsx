import { requireAuth } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Bell } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { PushSubscriptionToggle } from '@/components/push-subscription-toggle';

export default async function SettingsPage() {
  const session = await requireAuth();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-50 mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Account Info */}
      <Card className="bg-slate-800 border-slate-700 max-w-2xl mb-6">
        <CardHeader>
          <CardTitle className="text-slate-50">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Email</label>
            <p className="text-slate-50 font-medium">{session.email}</p>
          </div>
          <div>
            <label className="text-sm text-slate-400">Role</label>
            <p className="text-slate-50 font-medium">{session.role}</p>
          </div>
          <div>
            <label className="text-sm text-slate-400">Structure ID</label>
            <p className="text-slate-50 font-mono text-sm">{session.structureId}</p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-slate-800 border-slate-700 max-w-2xl mb-6 shadow-xl">
        <CardHeader>
          <CardTitle className="text-slate-50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            Configurez comment vous souhaitez recevoir les alertes pour les nouvelles commandes et réservations.
          </p>
          <PushSubscriptionToggle />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-slate-800 border-slate-700 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={logout}>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
