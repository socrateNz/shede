/**
 * Palette catégorielle (référence dataviz, variante sombre), validée sur la
 * surface des cartes (#1e293b) : ordre fixe, jamais recyclé. La couleur suit
 * le point, pas son rang — elle est attribuée selon l'ordre des points de
 * l'organisation, pas selon le filtre.
 *
 * Module neutre (ni serveur ni client) : utilisable depuis les Server
 * Components comme depuis les graphiques client.
 */
export const POINT_COLORS = [
  '#3987e5', // bleu
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // jaune
  '#d55181', // magenta
  '#008300', // vert (contraste < 3:1 : le tableau comparatif sert de vue texte)
  '#9085e9', // violet
  '#e66767', // rouge
];

/** Au-delà de 8 points, les suivants partagent un gris neutre (« autres »). */
export function pointColor(index: number) {
  return POINT_COLORS[index] ?? '#64748b';
}
