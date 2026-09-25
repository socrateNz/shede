import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPasswordTokenValid } from '@/lib/password-tokens';
import { ResetPasswordForm } from './reset-password-form';
import { getT } from '@/lib/i18n/server';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  const { t } = await getT();
  const valid = await isPasswordTokenValid(token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 bg-white/10 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-blue-400" />
              {t('auth.reset.title')}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {valid ? t('auth.reset.subtitle') : t('auth.reset.invalidLink')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valid ? (
              <ResetPasswordForm token={token} />
            ) : (
              <Link href="/forgot-password" className="text-sm font-medium text-blue-400 hover:text-blue-300">
                {t('auth.reset.requestNew')}
              </Link>
            )}
            <Link href="/login" className="mt-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
              <ArrowLeft className="h-4 w-4" />
              {t('auth.forgot.backToLogin')}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
