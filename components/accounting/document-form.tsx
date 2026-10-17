'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveSalesDocument, type CustomerWithBalance, type SalesDocument } from '@/app/actions/invoicing';
import { CustomerDialog } from '@/components/accounting/customer-dialog';
import { computeDocumentTotals, dueDateFrom, LINE_NATURE_KEYS, natureOfAccount, type DocumentKind, type LineNature } from '@/lib/invoicing';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

type Line = {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
  nature: LineNature;
};


/** Saisie d'un devis, d'une facture ou d'un avoir (brouillon) ; totaux recalculés à chaque frappe. */
export function DocumentForm({
  kind,
  customers,
  defaultTaxRate,
  today,
  document,
}: {
  kind: DocumentKind;
  customers: CustomerWithBalance[];
  defaultTaxRate: number;
  today: string;
  /** Brouillon existant (modification). */
  document?: SalesDocument;
}) {
  const { t, format } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState(document?.customer_id ?? '');
  const [issueDate, setIssueDate] = useState(document?.issue_date ?? today);
  const [dueDate, setDueDate] = useState(document?.due_date ?? '');
  const [subject, setSubject] = useState(document?.subject ?? '');
  const [notes, setNotes] = useState(document?.notes ?? '');
  // Clés stables entre le rendu serveur et le navigateur : index au départ, puis compteur
  const nextKey = useRef((document?.sales_document_lines.length || 1) + 1);
  const emptyLine = (key = nextKey.current++): Line => ({ key, description: '', quantity: '1', unitPrice: '', discountPercent: '0', taxRate: String(defaultTaxRate), nature: 'services' });
  const [lines, setLines] = useState<Line[]>(() =>
    document?.sales_document_lines.length
      ? document.sales_document_lines.map((l, i) => ({
          key: i,
          description: l.description,
          quantity: String(Number(l.quantity)),
          unitPrice: String(Number(l.unit_price)),
          discountPercent: String(Number(l.discount_percent)),
          taxRate: String(Number(l.tax_rate)),
          nature: natureOfAccount(l.account),
        }))
      : [emptyLine(0)]
  );

  const customer = customers.find((c) => c.id === customerId);
  const suggestedDue = customer ? dueDateFrom(issueDate, customer.payment_terms_days) : '';
  const totals = useMemo(
    () =>
      computeDocumentTotals(
        lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          discountPercent: Number(l.discountPercent) || 0,
          taxRate: Number(l.taxRate) || 0,
          nature: l.nature,
        }))
      ),
    [lines]
  );

  const update = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const kindLabel = t(`accounting.invoices.kinds.${kind}` as TranslationKey).toLowerCase();

  function save() {
    startTransition(async () => {
      const result = await saveSalesDocument({
        id: document?.id,
        kind,
        customerId,
        issueDate,
        dueDate: kind === 'CREDIT_NOTE' ? null : dueDate || null,
        subject,
        notes,
        sourceDocumentId: document?.source_document_id ?? null,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice) || 0,
          discountPercent: Number(l.discountPercent) || 0,
          taxRate: Number(l.taxRate) || 0,
          nature: l.nature,
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t('accounting.invoices.form.saved'));
      if (!document && result.data) router.push(`/accounting/invoices/${result.data.id}`);
      else router.refresh();
    });
  }

  const field = 'border-slate-600 bg-slate-900/50 text-slate-100';
  const label = 'block space-y-1 text-sm text-slate-300';

  return (
    <div className="space-y-6 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-slate-50">
        {document ? t('accounting.invoices.form.titleEdit', { kind: t(`accounting.invoices.kinds.${kind}` as TranslationKey) }) : t('accounting.invoices.form.titleNew', { kind: kindLabel })}
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className={label}>
            {t('accounting.invoices.form.customer')}
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`h-9 w-full rounded-md border px-3 text-sm ${field}`} required>
              <option value="">{customers.length ? t('accounting.invoices.form.chooseCustomer') : t('accounting.invoices.form.noCustomer')}</option>
              {customers
                .filter((c) => c.is_active || c.id === customerId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="mt-1.5">
            <CustomerDialog trigger="link" onCreated={setCustomerId} />
          </div>
        </div>
        <label className={label}>
          {t('accounting.invoices.form.issueDate')}
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={field} required />
        </label>
        {kind !== 'CREDIT_NOTE' && (
          <label className={label} title={t('accounting.invoices.form.dueDateHint')}>
            {t('accounting.invoices.form.dueDate')}
            <Input type="date" value={dueDate} min={issueDate} placeholder={suggestedDue} onChange={(e) => setDueDate(e.target.value)} className={field} />
            {!dueDate && suggestedDue && <span className="text-xs text-slate-500">{format.date(suggestedDue)}</span>}
          </label>
        )}
        <label className={`${label} md:col-span-4`}>
          {t('accounting.invoices.form.subject')}
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('accounting.invoices.form.subjectPlaceholder')} maxLength={200} className={field} />
        </label>
      </div>

      {/* Lignes */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-200">{t('accounting.invoices.form.lines')}</p>
        <div className="space-y-3">
          {lines.map((l, i) => {
            const computed = totals.lines[i];
            return (
              <div key={l.key} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3 md:grid-cols-12 md:items-end">
                <label className={`${label} col-span-2 md:col-span-4`}>
                  {t('accounting.invoices.form.description')}
                  <Input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} maxLength={500} className={field} />
                </label>
                <label className={`${label} md:col-span-1`}>
                  {t('accounting.invoices.form.quantity')}
                  <Input type="number" inputMode="decimal" min={0} step="any" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={field} />
                </label>
                <label className={`${label} md:col-span-2`}>
                  {t('accounting.invoices.form.unitPrice')}
                  <Input type="number" inputMode="decimal" min={0} step="any" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={field} />
                </label>
                <label className={`${label} md:col-span-1`}>
                  {t('accounting.invoices.form.discount')}
                  <Input type="number" min={0} max={100} step="any" value={l.discountPercent} onChange={(e) => update(l.key, { discountPercent: e.target.value })} className={field} />
                </label>
                <label className={`${label} md:col-span-1`}>
                  {t('accounting.invoices.form.taxRate')}
                  <Input type="number" min={0} max={100} step="any" value={l.taxRate} onChange={(e) => update(l.key, { taxRate: e.target.value })} className={field} />
                </label>
                <label className={`${label} col-span-2 md:col-span-2`}>
                  {t('accounting.invoices.form.nature')}
                  <select value={l.nature} onChange={(e) => update(l.key, { nature: e.target.value as LineNature })} className={`h-9 w-full rounded-md border px-2 text-sm ${field}`}>
                    {LINE_NATURE_KEYS.map((n) => (
                      <option key={n} value={n}>
                        {t(`accounting.invoices.form.natures.${n}` as TranslationKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:flex-col md:items-end">
                  <span className="text-sm font-semibold tabular-nums text-slate-100">{format.money(computed?.totalHt ?? 0)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    aria-label={t('accounting.invoices.form.removeLine')}
                    className="h-8 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="ghost" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="mt-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300">
          <Plus className="mr-1 h-4 w-4" /> {t('accounting.invoices.form.addLine')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className={label}>
          {t('accounting.invoices.form.notes')}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={t('accounting.invoices.form.notesPlaceholder')}
            className={`w-full rounded-md border px-3 py-2 text-sm ${field}`}
          />
        </label>
        <dl className="space-y-1.5 self-end rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm">
          <div className="flex justify-between text-slate-300">
            <dt>{t('accounting.invoices.form.subtotal')}</dt>
            <dd className="tabular-nums">{format.money(totals.subtotalHt)}</dd>
          </div>
          {totals.taxByRate
            .filter((r) => r.rate > 0)
            .map((r) => (
              <div key={r.rate} className="flex justify-between text-slate-400">
                <dt>
                  {t('accounting.invoices.form.tax')} {format.number(r.rate, { maximumFractionDigits: 2 })} %
                </dt>
                <dd className="tabular-nums">{format.money(r.tax)}</dd>
              </div>
            ))}
          <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-bold text-slate-50">
            <dt>{t('accounting.invoices.form.total')}</dt>
            <dd className="tabular-nums">{format.money(totals.totalTtc)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending || !customerId} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t('accounting.invoices.form.saveDraft')}
        </Button>
      </div>
    </div>
  );
}
