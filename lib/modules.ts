/** Modules activables par la licence d'une organisation. */
export const MODULE_OPTIONS = [
  // ── Core ──
  { value: 'POS',        label: '🖥️ Caisse (POS)',              description: 'Point de vente, commandes, paiements',                  category: 'Core' },
  { value: 'CLIENT_APP', label: '📱 Application Client (B2C)',   description: 'Catalogue public, panier, commandes en ligne',           category: 'Core' },

  // ── Restauration ──
  { value: 'CUISINE',    label: '🍳 Kitchen Display (KDS)',       description: 'Affichage cuisine en temps réel, gestion commandes',    category: 'Restauration' },
  { value: 'BAR',        label: '🍺 Bar Display',                description: 'Affichage des commandes bar/boissons',                  category: 'Restauration' },
  { value: 'LIVRAISON',  label: '🛵 Livraison',                  description: 'Gestion des commandes à livrer, suivi livreurs',        category: 'Restauration' },
  { value: 'TABLES',     label: '🪑 Plan de salle',              description: 'Floor manager interactif pour la gestion des tables',   category: 'Restauration' },

  // ── Gestion ──
  { value: 'HOTEL',      label: '🏨 Hôtel (PMS)',                description: 'Chambres, réservations, check-in/check-out',            category: 'Gestion' },
  { value: 'STOCK',      label: '📦 Stock (Inventaire)',          description: "Mouvements de stock, seuils d'alerte, recettes",        category: 'Gestion' },
  { value: 'PROMOTION',  label: '🏷️ Promotions',                description: 'Codes promo, remises automatiques, offres spéciales',   category: 'Gestion' },
  { value: 'RH',         label: '👥 Ressources Humaines',        description: 'Gestion du personnel, planning, congés',                category: 'Gestion' },
  { value: 'CRM',        label: '🤝 CRM Clients',                description: 'Base de données clients, fiches, historique commandes', category: 'Gestion' },
] as const;

export const KNOWN_MODULES: string[] = MODULE_OPTIONS.map((m) => m.value);

export const MODULE_CATEGORY_LABELS: Record<string, string> = {
  Core: '⚡ Essentiels',
  Restauration: '🍽️ Restauration',
  Gestion: '🏢 Gestion',
};

export function getModuleLabel(value: string): string {
  return MODULE_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

/** Filtre sur les modules connus et dédoublonne ; POS par défaut. */
export function sanitizeModules(modules: unknown): string[] {
  const raw = Array.isArray(modules) ? modules.map(String) : [];
  const clean = [...new Set(raw.filter((m) => KNOWN_MODULES.includes(m)))];
  return clean.length > 0 ? clean : ['POS'];
}
