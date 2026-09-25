// Crée (ou répare) un compte SUPER_ADMIN.
//
// Usage : node scripts/create-super-admin.mjs <email> <motDePasse> [prénom] [nom]
//
// Le SUPER_ADMIN n'est rattaché à aucun point ni aucune organisation
// (structure_id et organization_id à NULL) : il ne dépend d'aucune licence
// et n'est pas supprimé en cascade avec une organisation.
// Remplace scripts/init-super-admin.js, qui le rattachait à une structure
// « Shede HQ » (incompatible avec le modèle organisations / points).

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

function readEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return env;
}

const [email, password, firstName = 'Super', lastName = 'Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage : node scripts/create-super-admin.mjs <email> <motDePasse> [prénom] [nom]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Le mot de passe doit contenir au moins 8 caractères.');
  process.exit(1);
}

const env = { ...readEnv(path.join(process.cwd(), '.env')), ...readEnv(path.join(process.cwd(), '.env.local')) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env');
  process.exit(1);
}

const db = createClient(url, serviceKey);
const normalizedEmail = email.trim().toLowerCase();

const account = {
  email: normalizedEmail,
  password_hash: await bcrypt.hash(password, 10),
  first_name: firstName,
  last_name: lastName,
  role: 'SUPER_ADMIN',
  is_active: true,
  structure_id: null,
  organization_id: null,
};

const { data: existing, error: findError } = await db
  .from('users')
  .select('id, role')
  .eq('email', normalizedEmail)
  .maybeSingle();

if (findError) {
  console.error('Erreur de lecture :', findError.message);
  process.exit(1);
}

if (existing && existing.role !== 'SUPER_ADMIN') {
  console.error(
    `Un compte ${existing.role} existe déjà avec l'email ${normalizedEmail}. ` +
      'Utilisez un autre email pour le super admin.'
  );
  process.exit(1);
}

const { error } = existing
  ? await db.from('users').update(account).eq('id', existing.id)
  : await db.from('users').insert(account);

if (error) {
  console.error('Échec :', error.message);
  process.exit(1);
}

console.log(existing ? `SUPER_ADMIN ${normalizedEmail} mis à jour.` : `SUPER_ADMIN ${normalizedEmail} créé.`);
