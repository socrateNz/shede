'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Loader2, Plus, Smartphone, Trash2 } from 'lucide-react';
import { createDeviceEnrollment, revokeWaiterDevice, type WaiterDeviceRow } from '@/app/actions/waiter-devices';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDialogs } from '@/components/dialog-provider';
import { useT } from '@/lib/i18n/client';

/** Page Équipe : téléphones où les serveurs se connectent par code PIN. null = migration absente. */
export function WaiterDevicesManager({ devices }: { devices: WaiterDeviceRow[] | null }) {
  const { t, format } = useT();
  const router = useRouter();
  const dialogs = useDialogs();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setName('');
      setLink(null);
      router.refresh();
    }
  };

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await createDeviceEnrollment(name);
      if (!r.success) toast.error(r.error);
      else setLink({ url: r.url, expiresAt: r.expiresAt });
    });
  };

  const revoke = async (d: WaiterDeviceRow) => {
    if (!(await dialogs.confirm({ description: t('waiter.devices.revokeConfirm', { name: d.name }), destructive: true }))) return;
    startTransition(async () => {
      const r = await revokeWaiterDevice(d.id);
      if (!r.success) toast.error(r.error);
      else {
        toast.success(t('waiter.devices.revoked'));
        router.refresh();
      }
    });
  };

  return (
    <section className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
            <Smartphone className="h-5 w-5 text-blue-400" aria-hidden />
            {t('waiter.devices.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t('waiter.devices.subtitle')}</p>
        </div>
        {devices !== null && (
          <Button type="button" onClick={() => reset(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> {t('waiter.devices.add')}
          </Button>
        )}
      </div>

      {devices === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">{t('waiter.devices.notInstalled')}</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-slate-400">{t('waiter.devices.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-700/60">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{d.name}</p>
                <p className="text-xs text-slate-400">{d.lastSeenAt ? t('waiter.devices.lastSeen', { date: format.dateTime(d.lastSeenAt) }) : t('waiter.devices.neverSeen')}</p>
              </div>
              <Button type="button" variant="ghost" onClick={() => revoke(d)} disabled={pending} className="text-red-300 hover:bg-red-500/10 hover:text-red-200">
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> {t('waiter.devices.revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{link ? t('waiter.devices.scanTitle') : t('waiter.devices.add')}</DialogTitle>
            {link && <DialogDescription>{t('waiter.devices.scanHint', { time: format.time(link.expiresAt) })}</DialogDescription>}
          </DialogHeader>
          {!link ? (
            <form onSubmit={generate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="device-name">{t('waiter.devices.nameLabel')}</Label>
                <Input id="device-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={t('waiter.devices.namePlaceholder')} autoFocus />
              </div>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {t('waiter.devices.generate')}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={link.url} size={220} level="M" />
              </div>
              <p className="w-full break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{link.url}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigator.clipboard?.writeText(link.url).then(() => toast.success(t('waiter.devices.copied')))}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden /> {t('waiter.devices.copy')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
