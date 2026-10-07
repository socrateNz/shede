// Constantes du stock partagées entre serveur et navigateur.

/** Motifs d'une perte déclarée (stock_movements.loss_reason, docs/phase17-inventory.sql). */
export const LOSS_REASONS = ['expired', 'damaged', 'preparation_error', 'theft', 'staff_meal', 'other'] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
