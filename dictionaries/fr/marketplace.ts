/** Commandes reçues des marketplaces de livraison (côté restaurant). */
const marketplace = {
  title: 'Commandes marketplace',
  empty: 'Aucune commande en attente.',
  pause: 'Mettre en pause',
  resume: 'Reprendre les commandes',
  pausedText: 'Pause active : les marketplaces ne peuvent plus envoyer de commande à ce point.',
  pausedToast: 'Commandes marketplace en pause',
  resumed: 'Commandes marketplace reprises',
  prepTime: 'Prête dans',
  minutes: '{count} min',
  accept: 'Accepter',
  reject: 'Refuser',
  accepted: 'Commande acceptée : elle part en cuisine',
  rejected: 'Commande refusée',
  rejectReason: 'Motif du refus (transmis à la marketplace) : rupture, fermeture…',
  orderFrom: 'Commande {partner} n° {ref}',
  awaiting: 'En attente de votre acceptation.',
  acceptedWith: 'Acceptée — prête en {minutes} min.',
  rejectedWith: 'Refusée : {reason}',
  courier: 'Livreur : {status} ({name})',
  courierStatus: {
    ASSIGNED: 'en route vers le restaurant',
    PICKED_UP: 'commande récupérée',
    DELIVERED: 'livrée au client',
    FAILED: 'livraison échouée',
  },
  paidByPartner: 'Payée par la marketplace : la vente est clôturée automatiquement quand le livreur récupère la commande.',
  errors: {
    invalidPrepTime: 'Temps de préparation invalide (1 à 240 minutes).',
    notPending: 'Cette commande n’est plus en attente d’acceptation.',
    reasonRequired: 'Indiquez le motif du refus.',
  },
};

export default marketplace;
