'use server';

import { getJournalEntries } from '@/app/actions/accounting';
import { getT } from '@/lib/i18n/server';

/** Toutes les écritures de la période (sans pagination), une ligne par ligne d'écriture, pour l'export Excel. */
export async function exportJournal(params: { from?: string; to?: string; point?: string; journal?: string }) {
  const data = await getJournalEntries(params);
  const { t } = await getT();
  if (!data) return {};
  const pointName = new Map(data.scope.points.map((p) => [p.id, p.name]));
  const rows = data.entries.flatMap((e) =>
    e.lines.map((l) => ({
      [t('accounting.common.journal')]: e.journal,
      [t('accounting.common.number')]: e.number,
      [t('accounting.common.date')]: e.entry_date,
      [t('accounting.common.account')]: l.account,
      [t('accounting.common.label')]: l.label,
      [t('accounting.common.reference')]: e.reference ?? '',
      [t('accounting.common.debit')]: l.debit,
      [t('accounting.common.credit')]: l.credit,
      ...(data.scope.points.length ? { [t('org.pointSelect.label')]: pointName.get(e.structure_id) ?? '' } : {}),
    })),
  );
  return { [t('accounting.nav.journal')]: rows };
}
