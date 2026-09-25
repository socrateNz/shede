'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, MapPin, Briefcase, Phone, Home, User, Lock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

type ActionState = { success: boolean; error: string; pointId?: string };

export interface PointFormValues {
  name?: string;
  email?: string;
  city?: string;
  type?: string;
  phone?: string | null;
  address?: string | null;
}

interface PointFormProps {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  /** Point existant : pas de section administrateur. */
  defaultValues?: PointFormValues;
  withAdmin?: boolean;
  submitLabel: string;
  successHref?: string;
}

const inputClass =
  'bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20';

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-400" />
        {label}
      </label>
      {children}
    </div>
  );
}

export function PointForm({
  action,
  defaultValues,
  withAdmin = false,
  submitLabel,
  successHref = '/organization/points',
}: PointFormProps) {
  const router = useRouter();
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(action, { success: false, error: '' });

  useEffect(() => {
    if (state.success) {
      router.push(successHref);
      router.refresh();
    }
  }, [state.success, successHref, router]);

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold">{t('org.pointForm.sectionPoint')}</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Field icon={Building2} label={t('org.pointForm.name')}>
            <Input name="pointName" defaultValue={defaultValues?.name} placeholder={t('org.pointForm.namePlaceholder')} className={inputClass} required />
          </Field>
          <Field icon={Mail} label={t('org.pointForm.email')}>
            <Input name="pointEmail" type="email" defaultValue={defaultValues?.email} placeholder={t('org.pointForm.emailPlaceholder')} className={inputClass} required />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Field icon={MapPin} label={t('org.pointForm.city')}>
            <Input name="city" defaultValue={defaultValues?.city} placeholder={t('org.pointForm.cityPlaceholder')} className={inputClass} required />
          </Field>
          <Field icon={Briefcase} label={t('org.pointForm.type')}>
            <select
              name="pointType"
              defaultValue={defaultValues?.type || 'RESTAURANT'}
              className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-blue-500 cursor-pointer"
              required
            >
              <option value="RESTAURANT">{t('org.pointTypes.RESTAURANT')}</option>
              <option value="HOTEL">{t('org.pointTypes.HOTEL')}</option>
              <option value="MIXTE">{t('org.pointTypes.MIXTE_LONG')}</option>
            </select>
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Field icon={Phone} label={t('org.pointForm.phone')}>
            <Input name="phone" defaultValue={defaultValues?.phone ?? ''} placeholder={t('org.pointForm.phonePlaceholder')} className={inputClass} />
          </Field>
          <Field icon={Home} label={t('org.pointForm.address')}>
            <Input name="address" defaultValue={defaultValues?.address ?? ''} placeholder={t('org.pointForm.addressPlaceholder')} className={inputClass} />
          </Field>
        </div>
      </div>

      {withAdmin && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
            <User className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold">{t('org.pointForm.sectionAdmin')}</h3>
          </div>
          <p className="text-xs text-slate-500 -mt-3">
            {t('org.pointForm.adminHint')}
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <Field icon={User} label={t('org.pointForm.adminFirstName')}>
              <Input name="adminFirstName" placeholder={t('org.pointForm.adminFirstNamePlaceholder')} className={inputClass} required />
            </Field>
            <Field icon={User} label={t('org.pointForm.adminLastName')}>
              <Input name="adminLastName" placeholder={t('org.pointForm.adminLastNamePlaceholder')} className={inputClass} required />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Field icon={Mail} label={t('org.pointForm.adminEmail')}>
              <Input name="adminEmail" type="email" placeholder={t('org.pointForm.adminEmailPlaceholder')} className={inputClass} required />
            </Field>
            <Field icon={Lock} label={t('org.pointForm.adminPassword')}>
              <Input name="adminPassword" type="password" placeholder="••••••••" minLength={8} className={inputClass} required />
              <p className="text-xs text-slate-500">{t('org.pointForm.passwordHint')}</p>
            </Field>
          </div>
        </div>
      )}

      {state.error && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 font-semibold disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? t('org.pointForm.saving') : submitLabel}
        </Button>
        <Link href="/organization/points" className="sm:flex-none">
          <Button type="button" variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
            {t('common.cancel')}
          </Button>
        </Link>
      </div>
    </form>
  );
}
