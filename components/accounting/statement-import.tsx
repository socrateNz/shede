'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { importStatement } from '@/app/actions/bank';
import { guessMapping, parseStatement, type Cell, type ColumnMapping } from '@/lib/bank-import';
import { useT } from '@/lib/i18n/client';

type Workbook = { name: string; sheets: { name: string; table: Cell[][] }[] };

function decodeText(data: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(data);
  }
}

/**
 * Import d'un relevé : le fichier est lu dans le navigateur (Excel ou CSV), les colonnes
 * sont devinées puis ajustables, et seules les lignes de mouvements partent au serveur.
 */
export function StatementImport({ bankAccountId, accountName }: { bankAccountId: string; accountName: string }) {
  const { t, format } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [book, setBook] = useState<Workbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [reading, setReading] = useState(false);

  const table = book?.sheets[sheetIndex]?.table ?? [];
  const result = useMemo(() => (mapping && table.length ? parseStatement(table, mapping) : null), [mapping, table]);
  const header = mapping ? (table[mapping.headerRow] ?? []) : [];
  const width = Math.max(0, ...table.slice(0, 50).map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => ({ value: i, label: `${String.fromCharCode(65 + (i % 26))} — ${String(header[i] ?? '').slice(0, 30) || '…'}` }));

  async function readFile(file: File) {
    setReading(true);
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      // CSV : texte brut (sinon « 05/10/2026 » serait lu à l'américaine, mois/jour) ; Excel : vraies dates
      const isText = /\.(csv|txt)$/i.test(file.name);
      // CSV : décodé ici (UTF-8, sinon Windows-1252 des exports Excel) pour garder les accents
      const wb = isText
        ? XLSX.read(decodeText(data), { type: 'string', raw: true, dense: true })
        : XLSX.read(data, { type: 'array', cellDates: true, dense: true });
      const sheets = wb.SheetNames.map((name) => ({
        name,
        table: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }),
      })).filter((s) => s.table.length);
      if (!sheets.length) throw new Error('empty');
      const first = sheets.findIndex((s) => s.table.length > 1);
      setBook({ name: file.name, sheets });
      setSheetIndex(Math.max(0, first));
      setMapping(guessMapping(sheets[Math.max(0, first)].table));
    } catch {
      toast.error(t('accounting.bank.import.readError'));
      setBook(null);
      setMapping(null);
    } finally {
      setReading(false);
    }
  }

  function submit() {
    if (!result?.rows.length || !book) return;
    startTransition(async () => {
      const res = await importStatement({ bankAccountId, fileName: book.name, rows: result.rows });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(t('accounting.bank.import.done', { imported: res.data?.imported ?? 0 }), {
        description: res.data?.duplicates ? t('accounting.bank.import.duplicates', { count: res.data.duplicates }) : undefined,
      });
      setOpen(false);
      setBook(null);
      setMapping(null);
      router.refresh();
    });
  }

  const select = 'h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-2 text-sm text-slate-100';
  const label = 'block space-y-1 text-sm text-slate-300';
  const set = (patch: Partial<ColumnMapping>) => setMapping((m) => (m ? { ...m, ...patch } : m));
  const split = mapping?.debit != null && mapping?.credit != null;
  const totals = result?.rows.reduce((acc, r) => (r.amount > 0 ? { ...acc, in: acc.in + r.amount } : { ...acc, out: acc.out - r.amount }), { in: 0, out: 0 });
  const dates = result?.rows.map((r) => r.date).sort() ?? [];

  const columnSelect = (key: 'date' | 'label' | 'reference' | 'amount' | 'debit' | 'credit', optional = false) => (
    <select
      value={mapping?.[key] ?? ''}
      onChange={(e) => set({ [key]: e.target.value === '' ? null : Number(e.target.value) } as Partial<ColumnMapping>)}
      className={select}
    >
      {optional && <option value="">{t('accounting.bank.import.none')}</option>}
      {columns.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-700">
        <Upload className="mr-2 h-4 w-4" /> {t('accounting.bank.import.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto border-slate-700 bg-slate-800 text-slate-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('accounting.bank.import.title', { name: accountName })}</DialogTitle>
          </DialogHeader>

          <label className={label}>
            {t('accounting.bank.import.file')}
            <span className="flex items-center gap-2 rounded-md border border-dashed border-slate-500 bg-slate-900/40 px-3 py-3">
              <FileUp className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                className="w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100"
              />
              {reading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            </span>
            <span className="text-xs text-slate-500">{t('accounting.bank.import.fileHint')}</span>
          </label>

          {book && mapping && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {book.sheets.length > 1 && (
                  <label className={label}>
                    {t('accounting.bank.import.sheet')}
                    <select
                      value={sheetIndex}
                      onChange={(e) => {
                        const i = Number(e.target.value);
                        setSheetIndex(i);
                        setMapping(guessMapping(book.sheets[i].table));
                      }}
                      className={select}
                    >
                      {book.sheets.map((s, i) => (
                        <option key={s.name} value={i}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={label}>
                  {t('accounting.bank.import.headerRow')}
                  <select value={mapping.headerRow} onChange={(e) => set({ headerRow: Number(e.target.value) })} className={select}>
                    {table.slice(0, 30).map((row, i) => (
                      <option key={i} value={i}>
                        {i + 1} — {row.filter((c) => c != null && c !== '').slice(0, 3).map(String).join(' · ').slice(0, 50) || '…'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  {t('accounting.bank.import.date')}
                  {columnSelect('date')}
                </label>
                <label className={label}>
                  {t('accounting.bank.import.label')}
                  {columnSelect('label')}
                </label>
                <label className={label}>
                  {t('accounting.bank.import.reference')}
                  {columnSelect('reference', true)}
                </label>
                <label className={label}>
                  {t('accounting.bank.import.amountMode')}
                  <select
                    value={split ? 'split' : 'single'}
                    onChange={(e) =>
                      e.target.value === 'split'
                        ? set({ amount: null, debit: mapping.debit ?? 0, credit: mapping.credit ?? 1 })
                        : set({ debit: null, credit: null, amount: mapping.amount ?? 0 })
                    }
                    className={select}
                  >
                    <option value="single">{t('accounting.bank.import.single')}</option>
                    <option value="split">{t('accounting.bank.import.split')}</option>
                  </select>
                </label>
                {split ? (
                  <>
                    <label className={label}>
                      {t('accounting.bank.import.debit')}
                      {columnSelect('debit')}
                    </label>
                    <label className={label}>
                      {t('accounting.bank.import.credit')}
                      {columnSelect('credit')}
                    </label>
                  </>
                ) : (
                  <label className={label}>
                    {t('accounting.bank.import.amount')}
                    {columnSelect('amount')}
                  </label>
                )}
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
                  <input type="checkbox" checked={mapping.dayFirst !== false} onChange={(e) => set({ dayFirst: e.target.checked })} />
                  {t('accounting.bank.import.dayFirst')}
                </label>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-200">{t('accounting.bank.import.preview')}</p>
                {result && result.rows.length > 0 ? (
                  <>
                    <p className="text-sm text-slate-300">
                      {t('accounting.bank.import.summary', {
                        count: result.rows.length,
                        from: format.date(dates[0]),
                        to: format.date(dates[dates.length - 1]),
                        in: format.money(totals?.in ?? 0),
                        out: format.money(totals?.out ?? 0),
                      })}
                    </p>
                    <table className="mt-2 w-full text-xs">
                      <tbody className="divide-y divide-slate-700/60">
                        {result.rows.slice(0, 6).map((r, i) => (
                          <tr key={i} className="text-slate-300">
                            <td className="py-1 pr-2 whitespace-nowrap">{format.date(r.date)}</td>
                            <td className="py-1 pr-2">{r.label}</td>
                            <td className="py-1 pr-2 text-slate-500">{r.reference}</td>
                            <td className={`py-1 text-right tabular-nums ${r.amount > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{format.money(r.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="text-sm text-amber-300">{t('accounting.bank.import.nothing')}</p>
                )}
                {result && result.errors.length > 0 && (
                  <p className="mt-2 text-xs text-amber-300">
                    {t('accounting.bank.import.errors', { count: result.errors.length, rows: result.errors.slice(0, 10).map((e) => e.row).join(', ') })}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-300">
                  {t('accounting.common.cancel')}
                </Button>
                <Button type="button" onClick={submit} disabled={pending || !result?.rows.length} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('accounting.bank.import.submit', { count: result?.rows.length ?? 0 })}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
