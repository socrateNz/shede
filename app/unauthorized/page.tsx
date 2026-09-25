import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getT } from '@/lib/i18n/server';
import { moduleLabel } from '@/lib/modules';

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; module?: string }>;
}) {
  const { t } = await getT();
  const { error, module } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-6xl font-bold text-red-400">403</div>
          <h1 className="text-2xl font-bold text-slate-50">{t('unauthorized.title')}</h1>
          <p className="text-slate-400">
            {error === 'module_required' && module
              ? t('unauthorized.moduleRequired', { module: moduleLabel(t, module) })
              : t('unauthorized.description')}
          </p>
          <Link href="/dashboard">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {t('unauthorized.back')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
