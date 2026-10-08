'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Eye, EyeOff, Loader2, MoreVertical, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { saveSupplier, setSupplierActive, type PurchasingSupplier } from '@/app/actions/purchasing';
import { useT } from '@/lib/i18n/client';

const INPUT = 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500';
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type Form = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  niu: string;
  address: string;
  deliveryDays: number[];
  leadTimeDays: string;
  minOrderAmount: string;
  chargesVat: boolean;
};
const EMPTY: Form = { name: '', contactName: '', phone: '', email: '', niu: '', address: '', deliveryDays: [], leadTimeDays: '1', minOrderAmount: '0', chargesVat: true };

/** Fournisseurs (module ACHATS) : liste, création et modification dans un dialogue. */
export function SuppliersManager({ suppliers, canManage }: { suppliers: PurchasingSupplier[] | null; canManage: boolean }) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PurchasingSupplier | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const list = suppliers ?? [];
  const dayLabel = (d: number) => t(`purchasing.weekdays.d${d as 1 | 2 | 3 | 4 | 5 | 6 | 7}`);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? list.filter((s) => s.name.toLowerCase().includes(q) || s.contact_name?.toLowerCase().includes(q)) : list;
  }, [list, search]);

  function openEdit(supplier: PurchasingSupplier | 'new') {
    setForm(
      supplier === 'new'
        ? EMPTY
        : {
            name: supplier.name,
            contactName: supplier.contact_name ?? '',
            phone: supplier.phone ?? '',
            email: supplier.email ?? '',
            niu: supplier.niu ?? '',
            address: supplier.address ?? '',
            deliveryDays: supplier.delivery_days,
            leadTimeDays: String(supplier.lead_time_days),
            minOrderAmount: String(supplier.min_order_amount),
            chargesVat: supplier.charges_vat,
          }
    );
    setEditing(supplier);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveSupplier({
        id: editing && editing !== 'new' ? editing.id : undefined,
        ...form,
        leadTimeDays: Number(form.leadTimeDays) || 0,
        minOrderAmount: Number(form.minOrderAmount) || 0,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(editing === 'new' ? t('purchasing.suppliers.created') : t('purchasing.suppliers.saved'));
      setEditing(null);
      router.refresh();
    });
  }

  function toggle(supplier: PurchasingSupplier) {
    startTransition(async () => {
      const result = await setSupplierActive(supplier.id, !supplier.is_active);
      if (!result.success) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">{t('purchasing.suppliers.title')}</h1>
          <p className="max-w-2xl text-slate-400">{t('purchasing.suppliers.subtitle')}</p>
        </div>
        {suppliers !== null && canManage && (
          <Button type="button" onClick={() => openEdit('new')} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700">
            <Plus className="mr-2 h-4 w-4" /> {t('purchasing.suppliers.newButton')}
          </Button>
        )}
      </div>

      {suppliers === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('purchasing.notInstalled')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
          <div className="border-b border-slate-700/50 p-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('purchasing.suppliers.search')} className={`pl-9 ${INPUT}`} />
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="py-14 text-center text-sm text-slate-400">{t('purchasing.suppliers.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.suppliers.colName')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.suppliers.colContact')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.suppliers.colDelivery')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.suppliers.colLeadTime')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.suppliers.colMinOrder')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.suppliers.colCatalog')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('purchasing.suppliers.colStatus')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('purchasing.suppliers.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((supplier) => (
                  <TableRow key={supplier.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className={`font-medium ${supplier.is_active ? 'text-slate-50' : 'text-slate-500 line-through'}`}>
                      <Link href={`/purchasing/suppliers/${supplier.id}`} className="hover:text-cyan-300">{supplier.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">
                      {supplier.contact_name ?? '—'}
                      {(supplier.phone || supplier.email) && <p className="text-xs text-slate-500">{[supplier.phone, supplier.email].filter(Boolean).join(' · ')}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">
                      {supplier.delivery_days.length ? supplier.delivery_days.map(dayLabel).join(', ') : t('purchasing.suppliers.onDemand')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">{t('purchasing.suppliers.leadTimeValue', { days: supplier.lead_time_days })}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">{supplier.min_order_amount ? format.money(supplier.min_order_amount) : '—'}</TableCell>
                    <TableCell className="text-right text-sm text-slate-300">{t('purchasing.suppliers.items', { count: supplier.item_count })}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${supplier.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700/40 text-slate-400'}`}>
                        {supplier.is_active ? t('purchasing.suppliers.active') : t('purchasing.suppliers.inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={t('purchasing.suppliers.colActions')}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 border-slate-700 bg-slate-800 text-slate-200">
                          <DropdownMenuItem asChild className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                            <Link href={`/purchasing/suppliers/${supplier.id}`}>
                              <BookOpen className="h-4 w-4 text-cyan-300" /> {t('purchasing.suppliers.catalog')}
                            </Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem onClick={() => openEdit(supplier)} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                                <Pencil className="h-4 w-4 text-blue-400" /> {t('purchasing.suppliers.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem onClick={() => toggle(supplier)} disabled={pending} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                                {supplier.is_active ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                                {supplier.is_active ? t('purchasing.suppliers.deactivate') : t('purchasing.suppliers.activate')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !pending && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('purchasing.suppliers.newTitle') : t('purchasing.suppliers.editTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('purchasing.suppliers.name')} id="s-name">
                <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={150} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.contactName')} id="s-contact">
                <Input id="s-contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.phone')} id="s-phone">
                <Input id="s-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.email')} id="s-email">
                <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.niu')} id="s-niu">
                <Input id="s-niu" value={form.niu} onChange={(e) => setForm({ ...form, niu: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.address')} id="s-address">
                <Input id="s-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={INPUT} />
              </Field>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-300">{t('purchasing.suppliers.deliveryDays')}</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = form.deliveryDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm({ ...form, deliveryDays: on ? form.deliveryDays.filter((x) => x !== d) : [...form.deliveryDays, d] })}
                      className={`h-9 w-11 rounded-lg border text-xs font-semibold ${on ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200' : 'border-slate-600 text-slate-300'}`}
                    >
                      {dayLabel(d)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">{t('purchasing.suppliers.deliveryDaysHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('purchasing.suppliers.leadTime')} id="s-lead" hint={t('purchasing.suppliers.leadTimeHint')}>
                <Input id="s-lead" type="number" min="0" max="60" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} className={INPUT} />
              </Field>
              <Field label={t('purchasing.suppliers.minOrder')} id="s-min">
                <Input id="s-min" type="number" min="0" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} className={INPUT} />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.chargesVat} onChange={(e) => setForm({ ...form, chargesVat: e.target.checked })} className="mt-0.5 h-4 w-4" />
              <span>
                {t('purchasing.suppliers.chargesVat')}
                <span className="block text-xs text-slate-500">{t('purchasing.suppliers.chargesVatHint')}</span>
              </span>
            </label>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                {t('purchasing.suppliers.cancel')}
              </Button>
              <Button type="submit" disabled={pending || !form.name.trim()} className="bg-cyan-600 text-white hover:bg-cyan-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing === 'new' ? t('purchasing.suppliers.create') : t('purchasing.suppliers.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
