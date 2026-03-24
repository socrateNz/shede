'use client';

import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(login, {
    success: false,
    error: '',
  });

  useEffect(() => {
    if (state.success && state.redirect) {
      router.push(state.redirect);
    }
  }, [state.success, state.redirect, router]);

  return (
    <Card className="border-slate-700 bg-slate-800">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-slate-50">Shede POS</CardTitle>
        <CardDescription className="text-slate-400">Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Email</label>
            <Input
              type="email"
              name="email"
              placeholder="john@example.com"
              className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Password</label>
            <Input
              type="password"
              name="password"
              placeholder="••••••••"
              className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
              required
            />
          </div>

          {state.error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
