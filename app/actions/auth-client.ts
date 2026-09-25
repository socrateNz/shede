'use server';

import { getAdminSupabase } from '@/lib/supabase';
import { hashPassword, createSession } from '@/lib/auth';
import { buildClientWelcomeMail, queueMail } from '@/lib/emails';
import { getLocale, getT } from '@/lib/i18n/server';

export async function registerClient(
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const email = String(formData.get('email') || '').trim();
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const password = String(formData.get('password') || '');
  const { t } = await getT();

  if (!email || !firstName || !lastName || !password) {
    return { success: false, error: t('auth.errors.missingFields') };
  }

  try {
    const admin = getAdminSupabase();
    const passwordHash = await hashPassword(password);

    // 1. Check if email already exists globally
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return { success: false, error: t('auth.errors.emailTaken') };
    }

    // 2. Create the user with structure_id = null (Global Client)
    const { data: user, error } = await admin
      .from('users')
      .insert({
        structure_id: null, // Note: Ensure 03-global-clients.sql has been applied in DB
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: 'CLIENT',
        is_active: true,
      })
      .select()
      .single();

    if (error || !user) {
      console.error('Client registration error:', error);
      return { success: false, error: t('auth.errors.registrationFailed') };
    }

    const locale = await getLocale();
    queueMail(async () => buildClientWelcomeMail({ email: user.email, firstName, locale }));

    // 3. Log them in automatically
    await createSession({
      userId: user.id,
      email: user.email,
      role: 'CLIENT',
      structureId: undefined // Undefined or null maps to Global Client
    });

    return { success: true, error: '' };
  } catch (error) {
    console.error('Unhandled Registration Exception:', error);
    return { success: false, error: t('common.genericError') };
  }
}
