'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, KeyRound, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generatePointApiKey, revokePointApiKey, type PointApiStatus } from '@/app/actions/api-keys';
import { useT } from '@/lib/i18n/client';
import { WebhookSettings } from '@/components/organization/webhook-settings';

/** Section « API » de la fiche d'un point (administrateur d'organisation). */
export function PointApiCard({ pointId, status }: { pointId: string; status: PointApiStatus }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!status.moduleEnabled) return <p className="text-sm text-amber-400">{t('api.keys.moduleRequired')}</p>;
  if (!status.installed) return <p className="text-sm text-amber-400">{t('api.keys.notInstalled')}</p>;

  function generate() {
    if (status.credential && !confirm(t('api.keys.regenerateConfirm'))) return;
    startTransition(async () => {
      const result = await generatePointApiKey(pointId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCopied(false);
      setNewKey(result.data!.key);
      router.refresh();
    });
  }

  function revoke() {
    if (!confirm(t('api.keys.revokeConfirm'))) return;
    startTransition(async () => {
      const result = await revokePointApiKey(pointId);
      if (!result.success) toast.error(result.error);
      else {
        toast.success(t('api.keys.revoked'));
        router.refresh();
      }
    });
  }

  async function copy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    toast.success(t('api.keys.copied'));
  }

  const monthLabel = format.date(status.usage.month, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        {status.credential ? (
          <div>
            <p className="text-xs text-slate-400">{t('api.keys.keyPrefix')}</p>
            <p className="font-mono text-slate-100">{status.credential.prefix}••••••••••••</p>
            <p className="mt-1 text-xs text-slate-500">
              {t('api.keys.createdAt', { date: format.dateTime(status.credential.createdAt) })} ·{' '}
              {status.credential.lastUsedAt
                ? t('api.keys.lastUsed', { date: format.dateTime(status.credential.lastUsedAt) })
                : t('api.keys.neverUsed')}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t('api.keys.noKey')}</p>
        )}
        <div className="flex gap-2">
          <Button type="button" onClick={generate} disabled={pending} className="bg-blue-600 text-white hover:bg-blue-700">
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : status.credential ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {status.credential ? t('api.keys.regenerate') : t('api.keys.generate')}
          </Button>
          {status.credential && (
            <Button type="button" variant="outline" onClick={revoke} disabled={pending} className="border-red-900/60 text-red-400 hover:bg-red-900/30 hover:text-red-300">
              <Trash2 className="mr-2 h-4 w-4" />
              {t('api.keys.revoke')}
            </Button>
          )}
        </div>
      </div>

      {status.credential &&
        (status.webhook ? (
          <WebhookSettings pointId={pointId} webhook={status.webhook} />
        ) : (
          <p className="text-sm text-amber-400">{t('api.webhooks.notInstalled')}</p>
        ))}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-300">{t('api.keys.usageTitle', { month: monthLabel })}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">{t('api.keys.requests')}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-50">{format.number(status.usage.requests)}</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">{t('api.keys.orders')}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-50">{format.number(status.usage.orders)}</p>
          </div>
          <div className="rounded-lg bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">{t('api.keys.organizationQuota')}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-50">
              {status.quota == null
                ? t('api.keys.unlimited', { used: format.number(status.usage.organizationOrders) })
                : t('api.keys.quota', { used: format.number(status.usage.organizationOrders), max: format.number(status.quota) })}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('api.keys.newKeyTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-amber-300">{t('api.keys.newKeyWarning')}</p>
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 p-3">
            <code className="flex-1 break-all font-mono text-sm text-emerald-300">{newKey}</code>
            <Button type="button" size="sm" variant="outline" onClick={copy} className="border-slate-600 text-slate-200 hover:bg-slate-700">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5">{t('api.keys.copy')}</span>
            </Button>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setNewKey(null)} className="bg-blue-600 text-white hover:bg-blue-700">
              {t('api.keys.done')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
