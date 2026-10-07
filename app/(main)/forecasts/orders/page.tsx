import { requireModule } from '@/app/actions/auth';
import { getSuggestions } from '@/app/actions/planning';
import { SuggestionsView } from '@/components/planning/suggestions-view';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function SuggestedOrdersPage() {
  await requireModule('PREVISIONS');
  const data = await getSuggestions();
  if (!data || !data.installed) {
    const { t } = await getT();
    return <p className="m-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('planning.suggestions.notInstalled')}</p>;
  }
  return <SuggestionsView groups={data.groups} canOrder={data.canOrder} openDays={data.openDays} />;
}
