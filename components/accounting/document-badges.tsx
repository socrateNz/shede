import { daysOverdue, paymentState, type DocumentStatus } from '@/lib/invoicing';
import type { Translator } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<DocumentStatus, string> = {
  DRAFT: 'border-slate-500/50 bg-slate-700/40 text-slate-300',
  ISSUED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  ACCEPTED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  REFUSED: 'border-red-500/40 bg-red-500/10 text-red-300',
  CONVERTED: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  CANCELLED: 'border-slate-600 bg-slate-700/40 text-slate-400 line-through',
};

const PAYMENT_STYLE = {
  unpaid: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  partial: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  paid: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  overdue: 'border-red-500/50 bg-red-500/15 text-red-300',
};

const chip = 'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold';

/**
 * État lisible d'un document : pour une facture émise, son règlement (à encaisser, partiel,
 * réglée, en retard) ; sinon son statut (brouillon, émis, accepté…).
 */
export function DocumentStateBadge({
  doc,
  today,
  t,
}: {
  doc: { kind: string; status: DocumentStatus; due_date: string | null; total_ttc: number; amount_paid: number; amount_credited: number };
  today: string;
  t: Translator;
}) {
  if (doc.kind === 'INVOICE' && doc.status === 'ISSUED') {
    const late = daysOverdue(doc, today);
    if (late > 0) return <span className={cn(chip, PAYMENT_STYLE.overdue)}>{t('accounting.invoices.payment.overdue', { days: late })}</span>;
    const state = paymentState(doc);
    return <span className={cn(chip, PAYMENT_STYLE[state])}>{t(`accounting.invoices.payment.${state}`)}</span>;
  }
  return <span className={cn(chip, STATUS_STYLE[doc.status])}>{t(`accounting.invoices.statuses.${doc.status}`)}</span>;
}
