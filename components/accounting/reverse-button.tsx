'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reverseAccountingEntry } from '@/app/actions/accounting';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';

export function ReverseButton({ entryId, number }: { entryId: string; number: string }) {
  const { t } = useT();
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        const answer = await dialogs.prompt({
          description: t('accounting.journal.reverseConfirm', { number }),
          label: t('accounting.journal.reverseReason'),
          destructive: true,
        });
        if (answer === null) return;
        const reason = answer || undefined;
        startTransition(async () => {
          const result = await reverseAccountingEntry(entryId, reason);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(t('accounting.journal.reversed'));
          router.refresh();
        });
      }}
      className="h-7 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
    >
      {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1 h-3.5 w-3.5" />}
      {t('accounting.journal.reverse')}
    </Button>
  );
}
