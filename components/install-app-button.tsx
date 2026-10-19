'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '@/lib/pwa';

/**
 * « Installer l'application » : visible seulement quand le navigateur le permet
 * (Chrome, Edge, Android) ou sur iPhone, où l'on explique le passage par Partager.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const { t } = useT();
  const [mode, setMode] = useState<'prompt' | 'ios' | null>(null);

  useEffect(() => {
    const refresh = () => setMode(isStandalone() ? null : canPromptInstall() ? 'prompt' : isIos() ? 'ios' : null);
    refresh();
    return onInstallChange(refresh);
  }, []);

  if (!mode) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        if (mode === 'ios') {
          toast.info(t('common.pwa.iosHint'), { duration: 8000 });
          return;
        }
        if (await promptInstall()) toast.success(t('common.pwa.installed'));
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-50',
        className,
      )}
    >
      <Download className="h-5 w-5" aria-hidden />
      <span className="font-medium">{t('common.pwa.install')}</span>
    </button>
  );
}
