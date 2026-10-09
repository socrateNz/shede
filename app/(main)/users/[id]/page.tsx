import { requireRole } from '@/app/actions/auth';
import { updateUser } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, User, Mail, Briefcase, CheckCircle, AlertCircle, Save, X } from 'lucide-react';
import Link from 'next/link';
import { getAdminSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { STAFF_ROLES, staffRoleIcon } from '@/lib/staff-roles';
import { WaiterPinSetter } from '@/components/waiter/pin-setter';

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const { id: userId } = await params;
  const { t } = await getT();
  const admin = getAdminSupabase();

  const { data: user } = await admin
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('structure_id', session.structureId)
    .single();

  if (!user) {
    return (
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="w-full">
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t('team.form.notFound')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roles = STAFF_ROLES.map((role) => ({
    ...role,
    label: t(`roles.${role.value}`),
    description: t(`team.roleDescriptions.${role.value}`),
  }));

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Back Button */}
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t('team.form.back')}</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {t('team.form.editTitle')}
          </h1>
          <p className="text-slate-400">{t('team.form.editSubtitle')}</p>
        </div>

        {/* Info Card */}
        <div className="mb-6 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <span className="text-xl">{staffRoleIcon(user.role)}</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">{t('team.form.editing')}</p>
              <p className="text-slate-50 font-medium">
                {user.first_name} {user.last_name}
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <CardHeader className="border-b border-slate-700/50 pb-6">
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <User className="w-5 h-5 text-white" />
              </div>
              {t('team.form.editCard')}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8">
            <form
              action={async (formData) => {
                'use server';
                const result = await updateUser(
                  userId,
                  String(formData.get('firstName') || ''),
                  String(formData.get('lastName') || ''),
                  String(formData.get('role') || ''),
                  formData.get('isActive') === 'on'
                );

                if (!result.success) {
                  redirect(`/users/${userId}`);
                }

                redirect('/users');
              }}
              className="space-y-8"
            >
              {/* Section Informations personnelles */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold">{t('team.form.personal')}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      {t('team.form.firstName')}
                    </label>
                    <Input
                      type="text"
                      name="firstName"
                      defaultValue={user.first_name || ''}
                      placeholder={t('team.form.firstNamePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      {t('team.form.lastName')}
                    </label>
                    <Input
                      type="text"
                      name="lastName"
                      defaultValue={user.last_name || ''}
                      placeholder={t('team.form.lastNamePlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    {t('team.form.emailLabel')}
                  </label>
                  <Input
                    type="email"
                    value={user.email}
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 cursor-not-allowed opacity-75"
                    disabled
                  />
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    {t('team.form.emailLocked')}
                  </p>
                </div>
              </div>

              {/* Section Rôle et Statut */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Briefcase className="w-4 h-4 text-purple-400" />
                  <h3 className="font-semibold">{t('team.form.roleAndStatus')}</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-purple-400" />
                    {t('team.form.role')}
                  </label>
                  <select
                    name="role"
                    defaultValue={user.role}
                    className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 cursor-pointer hover:border-slate-500"
                    required
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {t('team.form.roleOption', { icon: role.icon, label: role.label, description: role.description })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={user.is_active}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    <span className="ml-3 text-sm font-medium text-slate-300 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {t('team.form.activeAccount')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
                >
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {t('team.form.save')}
                  </div>
                </Button>

                <Link href="/users" className="flex-1 sm:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
                  >
                    <X className="w-4 h-4 mr-2" />
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Mode serveur : code PIN (comptes Serveur uniquement ; l'empreinte ne quitte jamais le serveur) */}
        {user.role === 'SERVEUR' && <WaiterPinSetter userId={user.id} hasPin={Boolean(user.pin_hash)} />}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            {t('team.form.editFooter')}
          </p>
        </div>
      </div>
    </div>
  );
}