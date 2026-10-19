'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, BookCheck, Check, FileDown, FileMinus, FileOutput, Loader2, MessageCircle, Stamp, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  convertQuoteToInvoice,
  createCreditNote,
  deleteDraft,
  issueSalesDocument,
  postMissingDocumentEntry,
  recordSalesPayment,
  setQuoteOutcome,
  type SalesDocument,
} from '@/app/actions/invoicing';
import { useDialogs } from '@/components/dialog-provider';
import { TreasurySelect, type TreasuryChoice } from '@/components/accounting/treasury-select';
import { PAYMENT_METHODS } from '@/lib/accounting/mapping';
import type { DocumentStructure } from '@/lib/documents';
import { remainingDue } from '@/lib/invoicing';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

/** Boutons de la fiche d'un document de vente, selon son type et son état. */
export function DocumentActions({
  document,
  structure,
  today,
  treasuryAccounts = [],
}: {
  document: SalesDocument;
  structure: DocumentStructure | null;
  today: string;
  treasuryAccounts?: TreasuryChoice[];
}) {
  const i18n = useT();
  const { t, format } = i18n;
  const dialogs = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const due = remainingDue(document);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState('TRANSFER');
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  const run = (key: string, action: () => Promise<void>) => {
    setBusy(key);
    startTransition(async () => {
      try {
        await action();
      } finally {
        setBusy(null);
      }
    });
  };
  const icon = (key: string, Icon: typeof Check) => (busy === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />);
  const btn = 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-slate-50';

  // La confirmation est demandée avant la transition : une fenêtre ouverte pendant une
  // transition ne s'afficherait qu'à sa fin, c'est-à-dire jamais.
  const issue = async () => {
    if (!(await dialogs.confirm({ description: t('accounting.invoices.actions.issueConfirm') }))) return;
    run('issue', async () => {
      const result = await issueSalesDocument(document.id);
      if (!result.success) return void toast.error(result.error);
      toast.success(t('accounting.invoices.actions.issued', { number: result.data?.number ?? '' }));
      if (result.data?.accountingWarning) toast.warning(result.data.accountingWarning, { duration: 8000 });
      router.refresh();
    });
  };

  const remove = async () => {
    if (!(await dialogs.confirm({ description: t('accounting.invoices.actions.deleteConfirm'), destructive: true }))) return;
    run('delete', async () => {
      const result = await deleteDraft(document.id);
      if (!result.success) return void toast.error(result.error);
      toast.success(t('accounting.invoices.actions.deleted'));
      router.push('/accounting/invoices');
    });
  };

  const copyTo = (key: string, action: (id: string) => Promise<{ success: boolean; error?: string; data?: { id: string } }>, message: string) =>
    run(key, async () => {
      const result = await action(document.id);
      if (!result.success || !result.data) return void toast.error(result.error ?? '');
      toast.success(message);
      router.push(`/accounting/invoices/${result.data.id}`);
    });

  const outcome = (value: 'ACCEPTED' | 'REFUSED') =>
    run(value, async () => {
      const result = await setQuoteOutcome(document.id, value);
      if (!result.success) return void toast.error(result.error);
      router.refresh();
    });

  const pay = () =>
    run('pay', async () => {
      const result = await recordSalesPayment({ documentId: document.id, amount: Number(amount), method, paidAt, reference, bankAccountId: bankAccountId || null });
      if (!result.success) return void toast.error(result.error);
      toast.success(t('accounting.invoices.actions.paymentSaved'));
      if (result.data?.accountingWarning) toast.warning(result.data.accountingWarning, { duration: 8000 });
      setPayOpen(false);
      router.refresh();
    });

  const post = () =>
    run('post', async () => {
      const result = await postMissingDocumentEntry(document.id);
      if (!result.success) return void toast.error(result.error);
      toast.success(t('accounting.invoices.actions.postedNow'));
      router.refresh();
    });

  const pdf = () =>
    run('pdf', async () => {
      const { generateSalesDocumentPdf } = await import('@/lib/pdf-utils');
      await generateSalesDocumentPdf(document, structure, i18n);
    });

  const kindLabel = t(`accounting.invoices.kinds.${document.kind}` as TranslationKey).toLowerCase();
  const whatsappHref = (() => {
    const phone = (document.customers.phone ?? '').replace(/\D/g, '');
    const text = t('accounting.invoices.actions.whatsappText', { kind: kindLabel, number: document.number ?? '', amount: format.money(document.total_ttc) });
    return `https://wa.me/${phone.length === 9 ? `237${phone}` : phone}?text=${encodeURIComponent(text)}`;
  })();

  const isDraft = document.status === 'DRAFT';
  const isIssuedInvoice = document.kind === 'INVOICE' && document.status === 'ISSUED';
  const isOpenQuote = document.kind === 'QUOTE' && ['ISSUED', 'ACCEPTED', 'REFUSED'].includes(document.status);
  const needsPosting = document.kind !== 'QUOTE' && document.status === 'ISSUED' && (!document.entry_id || document.sales_payments.some((p) => !p.entry_id));

  return (
    <div className="flex flex-wrap gap-2">
      {isDraft && (
        <>
          <Button onClick={issue} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {icon('issue', Stamp)} {t('accounting.invoices.actions.issue')}
          </Button>
          <Button variant="outline" onClick={remove} disabled={pending} className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10">
            {icon('delete', Trash2)} {t('accounting.invoices.actions.delete')}
          </Button>
        </>
      )}

      {isIssuedInvoice && due > 0 && (
        <Button onClick={() => setPayOpen(true)} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Banknote className="mr-2 h-4 w-4" /> {t('accounting.invoices.actions.recordPayment')}
        </Button>
      )}

      {isOpenQuote && document.status !== 'REFUSED' && (
        <Button onClick={() => copyTo('convert', convertQuoteToInvoice, t('accounting.invoices.actions.converted'))} disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {icon('convert', FileOutput)} {t('accounting.invoices.actions.convert')}
        </Button>
      )}
      {isOpenQuote && document.status !== 'ACCEPTED' && (
        <Button variant="outline" onClick={() => outcome('ACCEPTED')} disabled={pending} className={btn}>
          {icon('ACCEPTED', Check)} {t('accounting.invoices.actions.accept')}
        </Button>
      )}
      {isOpenQuote && document.status !== 'REFUSED' && (
        <Button variant="outline" onClick={() => outcome('REFUSED')} disabled={pending} className={btn}>
          {icon('REFUSED', X)} {t('accounting.invoices.actions.refuse')}
        </Button>
      )}

      {isIssuedInvoice && due > 0 && (
        <Button variant="outline" onClick={() => copyTo('credit', createCreditNote, t('accounting.invoices.actions.creditNoteCreated'))} disabled={pending} className={btn}>
          {icon('credit', FileMinus)} {t('accounting.invoices.actions.creditNote')}
        </Button>
      )}

      {needsPosting && (
        <Button variant="outline" onClick={post} disabled={pending} className="border-amber-500/40 bg-transparent text-amber-300 hover:bg-amber-500/10">
          {icon('post', BookCheck)} {t('accounting.invoices.actions.postMissing')}
        </Button>
      )}

      <Button variant="outline" onClick={pdf} disabled={pending} className={btn}>
        {icon('pdf', FileDown)} {t('accounting.invoices.actions.pdf')}
      </Button>
      {!isDraft && document.customers.phone && (
        <Button asChild variant="outline" className={btn}>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> {t('accounting.invoices.actions.whatsapp')}
          </a>
        </Button>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('accounting.invoices.actions.paymentTitle', { number: document.number ?? '' })}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pay();
            }}
            className="space-y-3"
          >
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.invoices.actions.amount')}
              <Input type="number" min={1} max={due} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="border-slate-600 bg-slate-900/50 text-slate-100" required />
              <span className="text-xs text-slate-500">
                {t('accounting.invoices.detail.remaining')} : {format.money(due)}
              </span>
            </label>
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.invoices.actions.method')}
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-100">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`accounting.paymentMethods.${m}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </label>
            <TreasurySelect accounts={treasuryAccounts} method={method} value={bankAccountId} onChange={setBankAccountId} />
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.invoices.actions.paidAt')}
              <Input type="date" min={document.issue_date} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="border-slate-600 bg-slate-900/50 text-slate-100" required />
            </label>
            <label className="block space-y-1 text-sm text-slate-300">
              {t('accounting.invoices.actions.reference')}
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('accounting.invoices.actions.referencePlaceholder')} maxLength={120} className="border-slate-600 bg-slate-900/50 text-slate-100" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPayOpen(false)} className="text-slate-300">
                {t('accounting.common.cancel')}
              </Button>
              <Button type="submit" disabled={pending} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {busy === 'pay' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('accounting.common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
