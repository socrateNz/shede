'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, RefreshCw, RotateCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  regenerateWebhookSecret,
  retryWebhookDelivery,
  saveWebhookUrl,
  testWebhook,
  type PointApiStatus,
} from '@/app/actions/api-keys';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const STATUS_STYLE = {
  DELIVERED: 'text-emerald-300',
  PENDING: 'text-amber-300',
  FAILED: 'text-red-400',
} as const;

/** Adresse, secret, test et historique des webhooks d'un point. */
export function WebhookSettings({ pointId, webhook }: { pointId: string; webhook: NonNullable<PointApiStatus['webhook']> }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(webhook.url ?? '');
  const [showSecret, setShowSecret] = useState(false);

  function run(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  }

  function test() {
    startTransition(async () => {
      const result = await testWebhook(pointId);
      if (!result.success) toast.error(result.error);
      else if (result.data?.delivered) toast.success(t('api.webhooks.testOk', { detail: result.data.detail }));
      else toast.error(t('api.webhooks.testFailed', { detail: result.data?.detail ?? '' }));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <div>
        <p className="font-medium text-slate-100">{t('api.webhooks.title')}</p>
        <p className="text-xs text-slate-400">{t('api.webhooks.subtitle')}</p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveWebhookUrl(pointId, url), t('api.webhooks.saved'));
        }}
      >
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://marketplace.example/webhooks/shede"
          aria-label={t('api.webhooks.url')}
          className="flex-1 border-slate-600 bg-slate-900/50 font-mono text-sm text-slate-100"
        />
        <Button type="submit" disabled={pending} className="bg-blue-600 text-white hover:bg-blue-700">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </form>

      {webhook.url && webhook.secret && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">{t('api.webhooks.secret')}</span>
            <code className="rounded bg-slate-950 px-2 py-1 font-mono text-xs text-emerald-300">
              {showSecret ? webhook.secret : `${webhook.secret.slice(0, 10)}••••••••••••`}
            </code>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowSecret((v) => !v)} className="h-7 text-slate-300" aria-label={t('api.webhooks.toggleSecret')}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (confirm(t('api.webhooks.regenerateConfirm'))) run(() => regenerateWebhookSecret(pointId), t('api.webhooks.secretRegenerated'));
              }}
              className="h-7 text-slate-300"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {t('api.webhooks.regenerate')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={test} className="ml-auto h-8 border-slate-600 text-slate-200 hover:bg-slate-700">
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {t('api.webhooks.test')}
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-300">{t('api.webhooks.history')}</p>
            {webhook.deliveries.length === 0 ? (
              <p className="text-xs text-slate-500">{t('api.webhooks.noDeliveries')}</p>
            ) : (
              <ul className="divide-y divide-slate-800 rounded-md border border-slate-800 text-xs">
                {webhook.deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="w-28 text-slate-500">{format.dateTime(d.createdAt)}</span>
                    <span className="font-mono text-slate-200">{d.eventType}</span>
                    <span className={cn('font-medium', STATUS_STYLE[d.status])}>
                      {t(`api.webhooks.status.${d.status}`)}
                      {d.lastStatusCode ? ` · HTTP ${d.lastStatusCode}` : d.lastError ? ` · ${d.lastError}` : ''}
                    </span>
                    <span className="text-slate-500">{t('api.webhooks.attempts', { count: d.attempts })}</span>
                    {d.status !== 'DELIVERED' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => retryWebhookDelivery(pointId, d.id), t('api.webhooks.retried'))}
                        className="ml-auto h-7 text-slate-300"
                      >
                        <RotateCw className="mr-1 h-3.5 w-3.5" />
                        {t('api.webhooks.retry')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
