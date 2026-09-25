'use server';

import { hashPassword } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { consumePasswordToken, createPasswordToken, hasRecentResetToken } from '@/lib/password-tokens';
import { buildPasswordChangedMail, buildPasswordResetMail, queueMail } from '@/lib/emails';
import { getT } from '@/lib/i18n/server';

type State = { success: boolean; error: string };

/** Anti-abus : une demande par compte toutes les 2 minutes. */
const RESET_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * « Mot de passe oublié ». La réponse est identique que l'email existe ou non,
 * pour ne pas révéler quels comptes existent.
 */
export async function requestPasswordReset(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const { t, locale } = await getT();
  if (!email) return { success: false, error: t('auth.forgot.emailRequired') };

  try {
    const admin = getAdminSupabase();
    const { data: user } = await admin
      .from('users')
      .select('id, email, first_name, is_active')
      // ilike : insensible à la casse ; % et _ échappés pour une égalité stricte.
      .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();

    if (user?.is_active && !(await hasRecentResetToken(user.id, RESET_REQUEST_COOLDOWN_MS))) {
      const token = await createPasswordToken(user.id, 'RESET');
      if (token) {
        queueMail(async () => buildPasswordResetMail({ email: user.email, firstName: user.first_name, token, locale }));
      }
    }
  } catch (error) {
    console.error('[requestPasswordReset] error:', error);
  }

  return { success: true, error: '' };
}

/** Définit un nouveau mot de passe à partir d'un lien (réinitialisation ou invitation). */
export async function resetPassword(_prev: State, formData: FormData): Promise<State> {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  const { t, locale } = await getT();

  if (password.length < 8) {
    return { success: false, error: t('auth.reset.tooShort') };
  }
  if (password !== confirm) {
    return { success: false, error: t('auth.reset.mismatch') };
  }

  try {
    const userId = await consumePasswordToken(token);
    if (!userId) {
      return { success: false, error: t('auth.reset.expired') };
    }

    const admin = getAdminSupabase();
    const { data: user, error } = await admin
      .from('users')
      .update({ password_hash: await hashPassword(password), updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('email, first_name')
      .single();

    if (error || !user) {
      return { success: false, error: t('auth.reset.failed') };
    }

    queueMail(async () => buildPasswordChangedMail({ email: user.email, firstName: user.first_name, locale }));
    return { success: true, error: '' };
  } catch (error) {
    console.error('[resetPassword] error:', error);
    return { success: false, error: t('auth.reset.failed') };
  }
}
