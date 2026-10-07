import type { Translator } from '@/lib/i18n/translate';

/**
 * Modules activables par la licence d'une organisation.
 * Les libellés et descriptions sont traduits : dictionnaire `modules`.
 */
export const MODULE_OPTIONS = [
  // ── Core ──
  { value: 'POS', icon: '🖥️', category: 'Core' },
  { value: 'CLIENT_APP', icon: '📱', category: 'Core' },

  // ── Restauration ──
  { value: 'CUISINE', icon: '🍳', category: 'Restauration' },
  { value: 'BAR', icon: '🍺', category: 'Restauration' },
  { value: 'LIVRAISON', icon: '🛵', category: 'Restauration' },
  { value: 'TABLES', icon: '🪑', category: 'Restauration' },

  // ── Gestion ──
  { value: 'HOTEL', icon: '🏨', category: 'Gestion' },
  { value: 'STOCK', icon: '📦', category: 'Gestion' },
  { value: 'ACHATS', icon: '🧾', category: 'Gestion' },
  { value: 'PREVISIONS', icon: '📈', category: 'Gestion' },
  { value: 'PROMOTION', icon: '🏷️', category: 'Gestion' },
  { value: 'RH', icon: '👥', category: 'Gestion' },
  { value: 'CRM', icon: '🤝', category: 'Gestion' },
  { value: 'COMPTABILITE', icon: '📒', category: 'Gestion' },
  { value: 'API', icon: '🔌', category: 'Gestion' },
] as const;

export type ModuleCode = (typeof MODULE_OPTIONS)[number]['value'];
export type ModuleCategory = (typeof MODULE_OPTIONS)[number]['category'];

export const KNOWN_MODULES: string[] = MODULE_OPTIONS.map((m) => m.value);

/**
 * Modules requis par un autre : activés automatiquement avec lui.
 * ACHATS et PREVISIONS reposent sur le stock (ingrédients, recettes).
 */
export const MODULE_DEPENDENCIES: Partial<Record<ModuleCode, ModuleCode[]>> = {
  ACHATS: ['STOCK'],
  PREVISIONS: ['STOCK'],
};

export const MODULE_CATEGORIES: ModuleCategory[] = ['Core', 'Restauration', 'Gestion'];

function isModuleCode(value: string): value is ModuleCode {
  return KNOWN_MODULES.includes(value);
}

/** « 🏨 Hôtel (PMS) » dans la langue courante. */
export function moduleLabel(t: Translator, value: string): string {
  if (!isModuleCode(value)) return value;
  const icon = MODULE_OPTIONS.find((m) => m.value === value)?.icon ?? '';
  return `${icon} ${t(`modules.names.${value}`)}`.trim();
}

export function moduleDescription(t: Translator, value: string): string {
  return isModuleCode(value) ? t(`modules.descriptions.${value}`) : '';
}

export function moduleCategoryLabel(t: Translator, category: ModuleCategory): string {
  return t(`modules.categories.${category}`);
}

/** Filtre sur les modules connus, ajoute leurs dépendances et dédoublonne ; POS par défaut. */
export function sanitizeModules(modules: unknown): string[] {
  const raw = Array.isArray(modules) ? modules.map(String) : [];
  const known = raw.filter((m): m is ModuleCode => isModuleCode(m));
  const withDependencies = known.flatMap((m) => [m, ...(MODULE_DEPENDENCIES[m] ?? [])]);
  const clean = [...new Set(withDependencies)];
  return clean.length > 0 ? clean : ['POS'];
}
