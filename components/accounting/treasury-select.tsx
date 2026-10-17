'use client';

import { accountFamily } from '@/lib/accounting/treasury-family';
import { useT } from '@/lib/i18n/client';

export type TreasuryChoice = { id: string; name: string; account: string };

/**
 * Banque ou compte Mobile Money qui reçoit / paie, selon le moyen de paiement. Masqué quand
 * aucun compte ne correspond (espèces, ou pas de compte bancaire créé) : le compte par défaut
 * du moyen de paiement est alors utilisé.
 */
export function TreasurySelect({
  accounts,
  method,
  value,
  onChange,
  className,
}: {
  accounts: TreasuryChoice[];
  method: string;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { t } = useT();
  const family = accountFamily(method);
  const defaultAccount = family === '55' ? '552' : method === 'CHEQUE' ? '513' : '521';
  // Le compte bancaire rattaché au compte par défaut n'est pas proposé deux fois : il devient l'option par défaut
  const defaultBank = accounts.find((a) => a.account === defaultAccount);
  const options = family ? accounts.filter((a) => a.account.startsWith(family) && a.id !== defaultBank?.id) : [];
  if (!options.length) return null;
  return (
    <label className="block space-y-1 text-sm text-slate-300">
      {t(family === '55' ? 'accounting.bank.paymentMobile' : 'accounting.bank.paymentBank')}
      <select
        value={options.some((o) => o.id === value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className={className ?? 'h-9 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-100'}
      >
        <option value="">{defaultBank ? `${defaultBank.name} (${defaultBank.account})` : t('accounting.bank.defaultAccount', { account: defaultAccount })}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.account})
          </option>
        ))}
      </select>
    </label>
  );
}
