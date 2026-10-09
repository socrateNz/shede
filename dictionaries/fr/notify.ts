/** Notifications envoyées aux utilisateurs (centre de notifications et push). */
const notify = {
  test: {
    title: 'Notification de test',
    body: 'Les notifications push fonctionnent correctement.',
    settingsBody: 'Ceci est une notification de test pour vérifier vos réglages.',
  },
  bookingUpdated: {
    title: 'Mise à jour de votre réservation',
    body: 'Votre réservation {ref} est désormais : {status}.',
  },
  webBooking: {
    title: 'Nouvelle réservation (web)',
    body: 'Demande de réservation au nom de {name} du {from} au {to}.',
  },
  bookingCancelled: {
    title: 'Réservation annulée',
    body: 'Le client a annulé la réservation {ref}.',
  },
  bookingDatesChanged: {
    title: 'Réservation modifiée',
    body: 'Le client a modifié les dates de la réservation {ref}.',
  },
  orderCancelled: {
    title: 'Commande annulée',
    body: 'Le client a annulé la commande {ref}.',
  },
  webOrder: {
    title: 'Nouvelle commande (web)',
    body: 'Commande {ref} reçue d’un client en ligne.',
  },
  newOrder: {
    title: 'Nouvelle commande',
    body: 'Commande {ref} créée.',
  },
  marketplaceOrder: {
    title: 'Nouvelle commande {partner}',
    body: 'Commande {ref} à accepter.',
  },
  marketplaceCancelled: {
    title: 'Commande marketplace annulée',
    body: 'La marketplace a annulé la commande {ref}.',
  },
  orderUpdated: {
    title: 'Mise à jour de votre commande',
    body: 'Votre commande {ref} est maintenant : {status}.',
  },
  welcome: {
    title: 'Bienvenue dans l’équipe !',
    body: 'Votre compte « {role} » a été créé.',
  },
  profileUpdated: {
    title: 'Mise à jour de votre profil',
    body: 'Votre profil ou votre rôle ({role}) a été mis à jour par l’administrateur.',
  },
  licenseStatus: {
    title: 'Mise à jour de la licence',
    activated: 'La licence de votre organisation a été activée par le super administrateur.',
    suspended: 'La licence de votre organisation a été suspendue par le super administrateur.',
  },
  licenseModules: {
    title: 'Licence modifiée',
    body: 'Les modules de l’organisation {name} ont été mis à jour. Reconnectez-vous pour en profiter.',
  },
  orderReady: {
    title: 'Commande prête',
    body: 'Table {table} : la commande est prête à servir.',
  },
};

export default notify;
