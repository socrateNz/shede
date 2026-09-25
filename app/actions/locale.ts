'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/config';

/** Change la langue de l'interface (cookie) et la mémorise sur le compte connecté. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return { success: false };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });

  // Langue des emails envoyés à cet utilisateur (docs/phase11-locale.sql).
  const session = await getSession();
  if (session?.userId) {
    const { error } = await getAdminSupabase().from('users').update({ locale }).eq('id', session.userId);
    if (error) console.warn('[locale] langue non enregistrée sur le compte :', error.message);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
