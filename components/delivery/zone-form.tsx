'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

type ActionState = { success: boolean; error: string };

/** Formulaire d'une zone (création si `zone` absent, modification sinon). */
export function ZoneForm({
  action,
  zone,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  zone?: { name: string; fee: number };
}) {
  const router = useRouter();
  const { t } = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, { success: false, error: '' });

  useEffect(() => {
    if (state.success) {
      if (!zone) formRef.current?.reset();
      router.refresh();
    }
  }, [state, zone, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          name="name"
          defaultValue={zone?.name}
          placeholder={t('delivery.zones.namePlaceholder')}
          aria-label={t('delivery.zones.nameLabel')}
          required
          className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500"
        />
      </div>
      <div className="sm:w-40">
        <Input
          name="fee"
          type="number"
          min={0}
          step={50}
          defaultValue={zone?.fee ?? ''}
          placeholder={t('delivery.zones.feePlaceholder')}
          aria-label={t('delivery.zones.feeLabel')}
          required
          className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500"
        />
      </div>
      <Button
        type="submit"
        disabled={isPending}
        size="sm"
        className="h-9 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {zone ? <Save className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
        {zone ? t('common.save') : t('common.add')}
      </Button>
      {state.error && <p role="alert" className="text-sm text-red-400 sm:self-center">{state.error}</p>}
    </form>
  );
}
