'use server';

import { createSession, getSession, hashPassword } from '@/lib/auth';
import { getAdminSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { notifyStructureStaff } from '@/app/actions/push';
import {
  BUSINESS_TRIAL_MONTHS,
  formatTrialDateFr,
  getBusinessTrialEndDate,
} from '@/lib/trial';

function parseModulesFromFormData(formData: FormData): string[] {
  const raw = formData.getAll('modules').flatMap((value) =>
    String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
  const unique = [...new Set(raw)];
  return unique.length > 0 ? unique : ['POS'];
}

type StructureRegistrationInput = {
  structureName: string;
  structureEmail: string;
  city: string;
  structureType: string;
  modules: string[];
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  license: {
    plan: string;
    maxUsers: number;
    maxTables: number;
    expiresAt: string | null;
  };
};

function parseStructureRegistrationFormData(
  formData: FormData
): { data: StructureRegistrationInput } | { error: string } {
  const structureName = String(formData.get('structureName') || '').trim();
  const structureEmail = String(formData.get('structureEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const adminFirstName = String(formData.get('adminFirstName') || '').trim();
  const adminLastName = String(formData.get('adminLastName') || '').trim();
  const adminEmail = String(formData.get('adminEmail') || '').trim().toLowerCase();
  const adminPassword = String(formData.get('adminPassword') || '');
  const structureType = String(formData.get('structureType') || 'RESTAURANT');
  const modules = parseModulesFromFormData(formData);

  if (
    !structureName ||
    !structureEmail ||
    !city ||
    !adminFirstName ||
    !adminLastName ||
    !adminEmail ||
    !adminPassword
  ) {
    return { error: 'Tous les champs obligatoires doivent être remplis.' };
  }

  if (adminPassword.length < 8) {
    return {
      error: 'Le mot de passe doit contenir au moins 8 caractères.',
    };
  }

  return {
    data: {
      structureName,
      structureEmail,
      city,
      structureType,
      modules,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
      license: {
        plan: 'FREE',
        maxUsers: 5,
        maxTables: 10,
        expiresAt: null,
      },
    },
  };
}

async function createStructureWithAdminCore(
  input: StructureRegistrationInput,
  options?: {
    autoLogin?: boolean;
    welcomeBody?: string;
  }
): Promise<{
  success: boolean;
  error: string;
  structureId?: string;
  redirect?: string;
  trialEndsAt?: string;
}> {
  try {
    const admin = getAdminSupabase();

    const { data: existingStructure } = await admin
      .from('structures')
      .select('id')
      .eq('email', input.structureEmail)
      .maybeSingle();

    if (existingStructure) {
      return {
        success: false,
        error: 'Une structure utilise déjà cet email professionnel.',
      };
    }

    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', input.adminEmail)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: 'Un compte existe déjà avec cet email administrateur.',
      };
    }

    const { data: structure, error: structureError } = await admin
      .from('structures')
      .insert({
        name: input.structureName,
        email: input.structureEmail,
        city: input.city,
        type: input.structureType,
        modules: input.modules,
      })
      .select('id, modules')
      .single();

    if (structureError || !structure) {
      return { success: false, error: 'Échec de la création de la structure.' };
    }

    const passwordHash = await hashPassword(input.adminPassword);

    const { data: user, error: userError } = await admin
      .from('users')
      .insert({
        structure_id: structure.id,
        email: input.adminEmail,
        password_hash: passwordHash,
        first_name: input.adminFirstName,
        last_name: input.adminLastName,
        role: 'ADMIN',
        is_active: true,
      })
      .select('id, email, role')
      .single();

    if (userError || !user) {
      await admin.from('structures').delete().eq('id', structure.id);
      return { success: false, error: 'Échec de la création du compte administrateur.' };
    }

    await admin.from('licenses').insert({
      structure_id: structure.id,
      plan: input.license.plan,
      max_users: input.license.maxUsers,
      max_tables: input.license.maxTables,
      is_active: true,
      expires_at: input.license.expiresAt,
    });

    const trialEndsAt = input.license.expiresAt ?? undefined;

    await notifyStructureStaff({
      structureId: structure.id,
      title: 'Bienvenue chez Shede !',
      body:
        options?.welcomeBody ??
        `Votre structure ${input.structureName} a été enregistrée avec succès.`,
      url: '/dashboard',
      roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    });

    if (options?.autoLogin) {
      await createSession({
        userId: user.id,
        email: user.email,
        role: user.role,
        structureId: structure.id,
        modules: (structure.modules as string[]) || input.modules,
        licenseActive: true,
      });
    }

    return {
      success: true,
      error: '',
      structureId: structure.id,
      redirect: options?.autoLogin ? '/dashboard' : undefined,
      trialEndsAt,
    };
  } catch {
    return { success: false, error: 'Échec de la création de la structure.' };
  }
}

export async function getAllStructures() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return [];
  }

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from('structures')
      .select('id, name, email, created_at, licenses(is_active, expires_at, plan, max_users, max_tables)')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

export async function createStructureWithAdmin(
  _prevState: { success: boolean; error: string; structureId?: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = parseStructureRegistrationFormData(formData);
  if ('error' in parsed) {
    return { success: false, error: parsed.error };
  }

  return createStructureWithAdminCore(parsed.data);
}

export async function registerBusiness(
  _prevState: {
    success: boolean;
    error: string;
    redirect?: string;
    trialEndsAt?: string;
  },
  formData: FormData
) {
  const parsed = parseStructureRegistrationFormData(formData);
  if ('error' in parsed) {
    return { success: false, error: parsed.error };
  }

  const trialEnd = getBusinessTrialEndDate();
  const trialEndIso = trialEnd.toISOString();
  const trialEndLabel = formatTrialDateFr(trialEnd);

  const result = await createStructureWithAdminCore(
    {
      ...parsed.data,
      license: {
        plan: 'TRIAL',
        maxUsers: 5,
        maxTables: 10,
        expiresAt: trialEndIso,
      },
    },
    {
      autoLogin: true,
      welcomeBody: `Votre établissement est actif avec ${BUSINESS_TRIAL_MONTHS} mois d'essai gratuit, jusqu'au ${trialEndLabel}.`,
    }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    error: '',
    redirect: result.redirect ?? '/dashboard',
    trialEndsAt: result.trialEndsAt ?? trialEndIso,
  };
}

export async function updateStructureLicense(
  structureId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const isActive = String(formData.get('isActive') || 'false') === 'true';
  const expiresAtRaw = String(formData.get('expiresAt') || '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('licenses')
      .update({
        is_active: isActive,
        expires_at: expiresAt,
      })
      .eq('structure_id', structureId);

    if (error) {
      return { success: false, error: 'Failed to update license' };
    }

    await notifyStructureStaff({
      structureId: structureId,
      title: 'Mise à jour de licence',
      body: `Le statut de votre licence a été mis à jour par le Super Administrateur (Actif: ${isActive}).`,
      url: '/dashboard',
      roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: 'Failed to update license' };
  }
}

export async function updateStructure(
  structureId: string,
  _prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const name = String(formData.get('structureName') || '').trim();
  const email = String(formData.get('structureEmail') || '').trim().toLowerCase();
  const city = String(formData.get('city') || '').trim();
  const type = String(formData.get('structureType') || '');
  const modules = parseModulesFromFormData(formData);

  if (!name || !email) {
    return { success: false, error: 'Name and email are required' };
  }

  try {
    const admin = getAdminSupabase();
    const { error } = await admin
      .from('structures')
      .update({
        name,
        email,
        ...(city ? { city } : {}),
        ...(type ? { type } : {}),
        ...(modules.length > 0 ? { modules } : {}),
      })
      .eq('id', structureId);

    if (error) {
      console.error('Structure Update Error:', error);
      return { success: false, error: error.message || 'Failed to update structure' };
    }

    await notifyStructureStaff({
      structureId: structureId,
      title: 'Informations de structure modifiées',
      body: `Les détails de l'établissement ${name} ont été mis à jour par le Super Administrateur.`,
      url: '/settings',
      roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    });

    revalidatePath('/structures');
    return { success: true, error: '' };
  } catch (error: any) {
    console.error('Structure Update Catch Error:', error);
    return { success: false, error: error.message || 'Failed to update structure' };
  }
}

export async function deleteStructure(structureId: string) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const admin = getAdminSupabase();
    // This assumes cascading deletes are configured via foreign keys for related items (users, rooms, orders, etc.)
    const { error } = await admin
      .from('structures')
      .delete()
      .eq('id', structureId);

    if (error) {
      return { success: false, error: 'Failed to delete structure' };
    }

    revalidatePath('/structures');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete structure' };
  }
}

// ─────────────────────────────────────────────────────────
// updateStructureSettings — mise à jour des paramètres de
// l'établissement par l'ADMIN ou MANAGER.
// ─────────────────────────────────────────────────────────
export async function updateStructureSettings(
  _prevState: { success: boolean; error: string },
  formData: FormData
): Promise<{ success: boolean; error: string }> {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }

  const structureId = session.structureId;
  if (!structureId) {
    return { success: false, error: 'Aucune structure associée à ce compte.' };
  }

  const name     = String(formData.get('name') || '').trim();
  const email    = String(formData.get('email') || '').trim().toLowerCase();
  const phone    = String(formData.get('phone') || '').trim() || null;
  const address  = String(formData.get('address') || '').trim() || null;
  const city     = String(formData.get('city') || '').trim() || null;
  const country  = String(formData.get('country') || '').trim() || null;
  const currency = String(formData.get('currency') || 'XOF').trim();
  const timezone = String(formData.get('timezone') || 'Africa/Abidjan').trim();
  const type     = String(formData.get('type') || 'RESTAURANT').trim();
  const logo_url = String(formData.get('logo_url') || '').trim() || null;
  const taxRate  = Number(formData.get('tax_rate') || 0);
  const takeawayFee = Number(formData.get('takeaway_fee') || 0);

  if (!name || !email) {
    return { success: false, error: 'Le nom et l\'email sont obligatoires.' };
  }

  if (!['RESTAURANT', 'HOTEL', 'MIXTE'].includes(type)) {
    return { success: false, error: 'Type d\'établissement invalide.' };
  }

  try {
    const admin = getAdminSupabase();

    const { error } = await admin
      .from('structures')
      .update({
        name,
        email,
        phone,
        address,
        city,
        country,
        currency,
        timezone,
        type,
        logo_url,
        tax_rate: isNaN(taxRate) ? 0 : taxRate,
        takeaway_fee: isNaN(takeawayFee) ? 0 : takeawayFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', structureId);

    if (error) {
      return { success: false, error: error.message || 'Erreur lors de la mise à jour.' };
    }

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true, error: '' };
  } catch (err: any) {
    console.error('[updateStructureSettings] error:', err);
    return { success: false, error: err?.message || 'Erreur serveur.' };
  }
}
