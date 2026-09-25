import type { Locale } from '@/lib/i18n/config';

// Contenu de la documentation publique, par langue. Le texte long vit ici plutôt que
// dans les dictionnaires : la page choisit l'objet de la langue courante.

const fr = {
  header: {
    docs: 'Documentation',
    search: 'Rechercher dans la doc…',
    back: 'Retour',
    start: 'Commencer',
    navigation: 'Navigation',
    help: 'Besoin d’aide ? Appelez-nous',
    onThisPage: 'Sur cette page',
    copy: 'Copier',
    copied: 'Copié !',
    menu: 'Menu',
  },
  nav: {
    start: {
      title: 'Démarrage',
      items: { introduction: 'Introduction', quickstart: 'Démarrage rapide', architecture: 'Architecture' },
    },
    client: {
      title: 'Côté client (B2C)',
      items: {
        'client-account': 'Compte client',
        'client-reservations': 'Réservations',
        'client-orders': 'Commandes et QR code',
        'client-fidelite': 'Fidélité et promos',
      },
    },
    pro: {
      title: 'Côté professionnel (B2B)',
      items: {
        'pro-dashboard': 'Tableau de bord',
        'pro-pos': 'Caisse',
        'pro-pms': 'Gestion hôtelière',
        'pro-stocks': 'Stocks et catalogue',
        'pro-promos': 'Promotions',
        'pro-analytics': 'Statistiques',
      },
    },
    roles: {
      title: 'Rôles et permissions',
      items: {
        'roles-overview': 'Vue d’ensemble',
        'roles-admin': 'Super admin',
        'roles-cashier': 'Caissier',
        'roles-server': 'Serveur',
      },
    },
    integrations: {
      title: 'Intégrations',
      items: { 'integrations-qr': 'QR code et commande autonome', 'integrations-payment': 'Paiements' },
    },
    support: {
      title: 'Support',
      items: { faq: 'FAQ', 'contact-support': 'Contacter le support' },
    },
  },
  intro: {
    badge: 'Documentation',
    titleBefore: 'Bienvenue sur',
    text: 'Shede est une plateforme SaaS multi-établissements conçue pour les hôtels et restaurants. Elle connecte les professionnels de l’hôtellerie-restauration avec leurs clients via une interface unifiée, intuitive et puissante.',
    cards: [
      { title: 'Restaurants', desc: 'Caisse, commandes, stocks' },
      { title: 'Hôtels', desc: 'Réservations, chambres' },
      { title: 'Clients B2C', desc: 'Application et portail client' },
    ],
    callout: 'Cette documentation couvre l’ensemble des fonctionnalités de Shede. Naviguez avec la barre latérale ou utilisez la recherche pour trouver rapidement ce dont vous avez besoin.',
  },
  quickstart: {
    title: 'Démarrage rapide',
    text: 'Créez votre compte et commencez à utiliser Shede en moins de 5 minutes.',
    steps: [
      { title: 'Créer un compte', desc: 'Rendez-vous sur /register-client (client) ou contactez-nous pour un compte professionnel.' },
      { title: 'Configurer votre établissement', desc: 'Renseignez le nom, le type (restaurant, hôtel ou mixte), les horaires et le logo.' },
      { title: 'Inviter votre équipe', desc: 'Ajoutez vos collaborateurs avec les bons rôles : administrateur, caissier ou serveur.' },
      { title: 'Lancer les opérations', desc: 'Votre caisse est prête, vos QR codes générés. C’est parti !' },
    ],
  },
  architecture: {
    title: 'Architecture',
    text: 'Shede repose sur une architecture multi-établissements moderne.',
    codeTitle: '# Structure des rôles',
    roles: [
      { code: 'SUPER_ADMIN', desc: 'Gère toutes les organisations', indent: 0 },
      { code: 'ORG_ADMIN', desc: 'Gère son organisation et ses points de vente', indent: 1 },
      { code: 'ADMIN', desc: 'Gère son point de vente', indent: 2 },
      { code: 'CAISSE', desc: 'Caisse et paiements', indent: 3 },
      { code: 'SERVEUR', desc: 'Commandes (sans paiement)', indent: 3 },
      { code: 'CLIENT', desc: 'Portail B2C', indent: 1 },
    ],
    callout: 'Chaque établissement est cloisonné : les données d’un point ne sont jamais accessibles depuis un autre point.',
  },
  clientAccount: {
    badge: 'Côté client',
    title: 'Compte client',
    text: 'Le compte client est gratuit et donne accès à tous les établissements partenaires Shede.',
    items: [
      'Inscription via /register-client',
      'Connexion avec e-mail et mot de passe',
      'Profil personnalisable (nom, photo, préférences)',
      'Historique de toutes les commandes et réservations',
      'Accès aux réductions et au programme de fidélité',
    ],
    code: `GET /client            → Tableau de bord client
GET /history           → Historique des commandes et réservations
GET /client/structures → Établissements partenaires`,
  },
  reservations: {
    title: 'Réservations',
    text: 'Réservez une chambre en quelques secondes depuis le portail client ou l’application.',
    items: [
      { title: 'Calendrier en temps réel', desc: 'Disponibilité des chambres mise à jour instantanément.' },
      { title: 'Prépaiement sécurisé', desc: 'Règlement en ligne facultatif selon l’hôtel.' },
      { title: 'Confirmation mobile', desc: 'Notification immédiate après la réservation.' },
      { title: 'Reçu PDF', desc: 'Justificatif téléchargeable depuis la réservation.' },
    ],
    callout: 'Les annulations sont soumises à la politique de chaque hôtel. Vérifiez les conditions avant de confirmer.',
  },
  orders: {
    title: 'Commandes et QR code',
    text: 'Scannez le QR code à votre table ou à la réception pour commander sans attendre.',
    cardTitle: 'Scan & Order',
    cardText: 'Sans contact, 100 % autonome',
    steps: [
      'Scanner le QR code à votre table',
      'Parcourir le menu digital',
      'Ajouter au panier et confirmer',
      'Suivre l’état en temps réel',
    ],
    workflowLabel: 'Parcours d’une commande',
    workflow: 'En attente → En préparation → Prête → Servie',
  },
  loyalty: {
    title: 'Fidélité et promotions',
    text: 'Profitez d’offres exclusives, de réductions automatiques et d’un programme de fidélité intégré.',
    items: [
      { label: 'Programme de points', desc: 'Gagnez des points à chaque commande, échangeables contre des réductions.' },
      { label: 'Promotions ciblées', desc: 'Des offres personnalisées selon vos habitudes et préférences.' },
      { label: 'Cashback automatique', desc: 'Remboursement automatique sur votre prochaine commande.' },
    ],
  },
  dashboard: {
    badge: 'Professionnel',
    title: 'Tableau de bord',
    text: 'Un espace centralisé pour piloter toute votre activité en temps réel.',
    items: [
      'Chiffre d’affaires du jour, de la semaine et du mois',
      'Nombre de commandes en cours',
      'Taux d’occupation des chambres',
      'Alertes de stock et notifications d’équipe',
      'Meilleures ventes',
      'Commandes par canal (salle, chambre, QR code)',
    ],
  },
  pos: {
    title: 'Caisse intelligente',
    text: 'Un système de caisse tactile conçu pour la rapidité et la fiabilité en restaurant.',
    workflowLabel: 'Parcours en caisse',
    workflow: `1. Sélectionner une table ou une commande à emporter
2. Ajouter des articles depuis le catalogue
3. Appliquer des promotions ou remises
4. Envoyer en cuisine (ticket imprimé automatiquement)
5. Marquer comme : Prête → Servie
6. Encaisser : espèces, Mobile Money ou carte`,
    tags: ['Menu digital', 'Gestion des formules', 'Réductions et promos'],
    callout: 'Seuls les administrateurs et les caissiers peuvent finaliser un paiement. Les serveurs peuvent prendre des commandes mais pas encaisser.',
  },
  pms: {
    title: 'Gestion hôtelière',
    text: 'Gérez tout le cycle de vie de vos chambres depuis une seule interface.',
    statuses: [
      { status: 'Disponible', desc: 'La chambre est libre et peut être réservée.' },
      { status: 'Occupée', desc: 'Un client est actuellement en séjour.' },
      { status: 'Réservée', desc: 'Une réservation confirmée attend l’arrivée du client.' },
      { status: 'En nettoyage', desc: 'La chambre est en cours de préparation.' },
    ],
  },
  stocks: {
    title: 'Stocks et catalogue',
    text: 'Gérez vos produits, catégories et niveaux de stock en temps réel.',
    codeLabel: 'Catalogue — structure',
    code: `Catégorie
  └── Produit
        ├── Nom, description, prix
        ├── Image
        ├── Stock actuel / seuil d’alerte
        └── Statut : disponible | épuisé | masqué`,
    callout: 'Quand le stock d’un produit atteint le seuil d’alerte configuré, une notification automatique est envoyée à l’administrateur.',
  },
  promos: {
    title: 'Promotions',
    text: 'Créez et gérez des promotions pour dynamiser vos ventes.',
    items: [
      { title: 'Promotion globale', desc: 'Réduction appliquée à tout le panier. Visible par tous les clients.' },
      { title: 'Réduction produit', desc: 'Remise ciblée sur un ou plusieurs produits.' },
      { title: 'Code promo', desc: 'Un code unique à saisir au paiement pour bénéficier d’une remise.' },
      { title: 'Promotion temporaire', desc: 'Active uniquement pendant une plage horaire définie (happy hour, etc.).' },
    ],
  },
  analytics: {
    title: 'Statistiques',
    text: 'Des rapports complets pour comprendre et optimiser vos performances.',
    stats: [
      { value: 'J / S / M', label: 'Filtres par période' },
      { value: 'CSV / PDF', label: 'Export des rapports' },
      { value: 'Temps réel', label: 'Mise à jour des données' },
    ],
  },
  roles: {
    badge: 'Sécurité et accès',
    title: 'Rôles et permissions',
    text: 'Shede applique un contrôle d’accès strict basé sur les rôles.',
    headers: ['Fonctionnalité', 'Super admin', 'Admin', 'Caissier', 'Serveur', 'Client'],
    rows: [
      ['Gérer les structures', '✅', '❌', '❌', '❌', '❌'],
      ['Tableau de bord et statistiques', '✅', '✅', '❌', '❌', '❌'],
      ['Gérer le catalogue', '✅', '✅', '❌', '❌', '❌'],
      ['Prendre une commande', '✅', '✅', '✅', '✅', '✅'],
      ['Finaliser un paiement', '✅', '✅', '✅', '❌', '❌'],
      ['Gérer les réservations', '✅', '✅', '✅', '❌', '✅'],
      ['Gérer les promotions', '✅', '✅', '❌', '❌', '❌'],
    ],
    superAdmin: {
      title: 'Super admin',
      text: 'Accès complet à tout le système. Peut créer, modifier et supprimer des structures.',
      callout: 'Ce rôle est attribué uniquement par l’équipe Shede. Ne le partagez jamais.',
    },
    cashier: {
      title: 'Caissier',
      text: 'Peut prendre des commandes, les finaliser et encaisser. Ne peut pas modifier le catalogue ni les paramètres.',
    },
    server: {
      title: 'Serveur',
      text: 'Peut uniquement prendre et modifier des commandes en cours. Aucun accès aux fonctions financières.',
    },
  },
  qr: {
    badge: 'Intégrations',
    title: 'QR code et commande autonome',
    text: 'Chaque table dispose d’un QR code unique généré automatiquement par Shede.',
    codeLabel: 'Lien du QR code',
    code: `https://<votre-domaine>/client/structure/{structureId}?tableId={tableId}&tableName={nom}`,
    callout: 'Les QR codes se téléchargent en PDF depuis le plan de salle, prêts à imprimer et à plastifier.',
  },
  payments: {
    title: 'Paiements',
    text: 'Shede prend en charge plusieurs moyens de paiement adaptés au marché local et international.',
    methods: [
      { method: 'Espèces', desc: 'Paiement manuel enregistré' },
      { method: 'Mobile Money', desc: 'MTN MoMo, Orange Money…' },
      { method: 'Carte bancaire', desc: 'Visa, Mastercard' },
    ],
  },
  faq: {
    title: 'Questions fréquentes',
    items: [
      { q: 'Shede est-il gratuit pour les clients ?', a: 'Oui, totalement. Le compte client est 100 % gratuit et sans commission sur les commandes.' },
      { q: 'Puis-je gérer plusieurs établissements ?', a: 'Oui. En tant qu’administrateur d’organisation, vous pilotez plusieurs restaurants et hôtels depuis un seul compte.' },
      { q: 'Les données sont-elles sécurisées ?', a: 'Oui. Les données sont chiffrées, hébergées sur des serveurs sécurisés et cloisonnées par établissement.' },
      { q: 'Faut-il installer une application ?', a: 'Non. Shede est une application web progressive (PWA) accessible depuis n’importe quel navigateur, sur mobile comme sur ordinateur.' },
      { q: 'Comment obtenir un compte professionnel ?', a: 'Inscrivez votre établissement sur /register-business ou appelez-nous au +237 656 954 474. Un de nos experts vous accompagnera.' },
    ],
  },
  contact: {
    title: 'Contacter le support',
    text: 'Notre équipe est disponible 7 j/7 pour vous aider.',
    call: 'Appel téléphonique',
    portfolio: 'Portfolio du développeur',
  },
  footer: {
    version: '© {year} Shede Tech · Documentation v1.0',
    backHome: '← Retour à l’accueil',
  },
};

export type DocsContent = typeof fr;

const en: DocsContent = {
  header: {
    docs: 'Documentation',
    search: 'Search the docs…',
    back: 'Back',
    start: 'Get started',
    navigation: 'Navigation',
    help: 'Need help? Call us',
    onThisPage: 'On this page',
    copy: 'Copy',
    copied: 'Copied!',
    menu: 'Menu',
  },
  nav: {
    start: {
      title: 'Getting started',
      items: { introduction: 'Introduction', quickstart: 'Quick start', architecture: 'Architecture' },
    },
    client: {
      title: 'Customer side (B2C)',
      items: {
        'client-account': 'Customer account',
        'client-reservations': 'Bookings',
        'client-orders': 'Orders and QR codes',
        'client-fidelite': 'Loyalty and promos',
      },
    },
    pro: {
      title: 'Professional side (B2B)',
      items: {
        'pro-dashboard': 'Dashboard',
        'pro-pos': 'Register',
        'pro-pms': 'Hotel management',
        'pro-stocks': 'Stock and catalogue',
        'pro-promos': 'Promotions',
        'pro-analytics': 'Statistics',
      },
    },
    roles: {
      title: 'Roles and permissions',
      items: {
        'roles-overview': 'Overview',
        'roles-admin': 'Super admin',
        'roles-cashier': 'Cashier',
        'roles-server': 'Waiter',
      },
    },
    integrations: {
      title: 'Integrations',
      items: { 'integrations-qr': 'QR codes and self-ordering', 'integrations-payment': 'Payments' },
    },
    support: {
      title: 'Support',
      items: { faq: 'FAQ', 'contact-support': 'Contact support' },
    },
  },
  intro: {
    badge: 'Documentation',
    titleBefore: 'Welcome to',
    text: 'Shede is a multi-establishment SaaS platform built for hotels and restaurants. It connects hospitality professionals with their customers through a unified, intuitive and powerful interface.',
    cards: [
      { title: 'Restaurants', desc: 'Register, orders, stock' },
      { title: 'Hotels', desc: 'Bookings, rooms' },
      { title: 'B2C customers', desc: 'Customer app and portal' },
    ],
    callout: 'This documentation covers all of Shede’s features. Use the sidebar or the search to quickly find what you need.',
  },
  quickstart: {
    title: 'Quick start',
    text: 'Create your account and start using Shede in under 5 minutes.',
    steps: [
      { title: 'Create an account', desc: 'Go to /register-client (customers) or contact us for a professional account.' },
      { title: 'Set up your establishment', desc: 'Enter the name, type (restaurant, hotel or both), opening hours and logo.' },
      { title: 'Invite your team', desc: 'Add your staff with the right roles: administrator, cashier or waiter.' },
      { title: 'Start operating', desc: 'Your register is ready and your QR codes are generated. Let’s go!' },
    ],
  },
  architecture: {
    title: 'Architecture',
    text: 'Shede is built on a modern multi-establishment architecture.',
    codeTitle: '# Role structure',
    roles: [
      { code: 'SUPER_ADMIN', desc: 'Manages every organisation', indent: 0 },
      { code: 'ORG_ADMIN', desc: 'Manages their organisation and its outlets', indent: 1 },
      { code: 'ADMIN', desc: 'Manages their outlet', indent: 2 },
      { code: 'CAISSE', desc: 'Register and payments', indent: 3 },
      { code: 'SERVEUR', desc: 'Orders (no payments)', indent: 3 },
      { code: 'CLIENT', desc: 'B2C portal', indent: 1 },
    ],
    callout: 'Every establishment is isolated: one outlet’s data is never accessible from another outlet.',
  },
  clientAccount: {
    badge: 'Customer side',
    title: 'Customer account',
    text: 'The customer account is free and gives access to every Shede partner establishment.',
    items: [
      'Sign up at /register-client',
      'Log in with email and password',
      'Customisable profile (name, photo, preferences)',
      'History of all orders and bookings',
      'Access to discounts and the loyalty programme',
    ],
    code: `GET /client            → Customer dashboard
GET /history           → Order and booking history
GET /client/structures → Partner establishments`,
  },
  reservations: {
    title: 'Bookings',
    text: 'Book a room in seconds from the customer portal or the app.',
    items: [
      { title: 'Real-time calendar', desc: 'Room availability updated instantly.' },
      { title: 'Secure prepayment', desc: 'Optional online payment depending on the hotel.' },
      { title: 'Mobile confirmation', desc: 'Instant notification after booking.' },
      { title: 'PDF receipt', desc: 'Downloadable proof from the booking.' },
    ],
    callout: 'Cancellations follow each hotel’s policy. Check the conditions before confirming.',
  },
  orders: {
    title: 'Orders and QR codes',
    text: 'Scan the QR code at your table or at reception to order without waiting.',
    cardTitle: 'Scan & Order',
    cardText: 'Contactless, fully self-service',
    steps: [
      'Scan the QR code at your table',
      'Browse the digital menu',
      'Add to cart and confirm',
      'Track the status in real time',
    ],
    workflowLabel: 'Order flow',
    workflow: 'Pending → In preparation → Ready → Served',
  },
  loyalty: {
    title: 'Loyalty and promotions',
    text: 'Enjoy exclusive offers, automatic discounts and a built-in loyalty programme.',
    items: [
      { label: 'Points programme', desc: 'Earn points with every order and redeem them for discounts.' },
      { label: 'Targeted promotions', desc: 'Personalised offers based on your habits and preferences.' },
      { label: 'Automatic cashback', desc: 'Money back automatically on your next order.' },
    ],
  },
  dashboard: {
    badge: 'Professional',
    title: 'Dashboard',
    text: 'A central hub to run your whole business in real time.',
    items: [
      'Revenue for the day, week and month',
      'Number of orders in progress',
      'Room occupancy rate',
      'Stock alerts and team notifications',
      'Best sellers',
      'Orders by channel (dining room, room, QR code)',
    ],
  },
  pos: {
    title: 'Smart register',
    text: 'A touch-screen register built for speed and reliability in restaurants.',
    workflowLabel: 'Register flow',
    workflow: `1. Select a table or a takeaway order
2. Add items from the catalogue
3. Apply promotions or discounts
4. Send to the kitchen (ticket printed automatically)
5. Mark as: Ready → Served
6. Take payment: cash, Mobile Money or card`,
    tags: ['Digital menu', 'Set menus', 'Discounts and promos'],
    callout: 'Only administrators and cashiers can complete a payment. Waiters can take orders but cannot take payment.',
  },
  pms: {
    title: 'Hotel management',
    text: 'Manage the whole lifecycle of your rooms from a single interface.',
    statuses: [
      { status: 'Available', desc: 'The room is free and can be booked.' },
      { status: 'Occupied', desc: 'A guest is currently staying.' },
      { status: 'Booked', desc: 'A confirmed booking is waiting for the guest to arrive.' },
      { status: 'Cleaning', desc: 'The room is being prepared.' },
    ],
  },
  stocks: {
    title: 'Stock and catalogue',
    text: 'Manage your products, categories and stock levels in real time.',
    codeLabel: 'Catalogue — structure',
    code: `Category
  └── Product
        ├── Name, description, price
        ├── Image
        ├── Current stock / alert threshold
        └── Status: available | sold out | hidden`,
    callout: 'When a product’s stock reaches the configured alert threshold, an automatic notification is sent to the administrator.',
  },
  promos: {
    title: 'Promotions',
    text: 'Create and manage promotions to boost your sales.',
    items: [
      { title: 'Store-wide promotion', desc: 'Discount applied to the whole cart. Visible to every customer.' },
      { title: 'Product discount', desc: 'Discount targeted at one or more products.' },
      { title: 'Promo code', desc: 'A unique code entered at checkout to get a discount.' },
      { title: 'Time-limited promotion', desc: 'Active only during a set time slot (happy hour, etc.).' },
    ],
  },
  analytics: {
    title: 'Statistics',
    text: 'Complete reports to understand and optimise your performance.',
    stats: [
      { value: 'D / W / M', label: 'Period filters' },
      { value: 'CSV / PDF', label: 'Report export' },
      { value: 'Real time', label: 'Data updates' },
    ],
  },
  roles: {
    badge: 'Security and access',
    title: 'Roles and permissions',
    text: 'Shede enforces strict role-based access control.',
    headers: ['Feature', 'Super admin', 'Admin', 'Cashier', 'Waiter', 'Customer'],
    rows: [
      ['Manage structures', '✅', '❌', '❌', '❌', '❌'],
      ['Dashboard and statistics', '✅', '✅', '❌', '❌', '❌'],
      ['Manage the catalogue', '✅', '✅', '❌', '❌', '❌'],
      ['Take an order', '✅', '✅', '✅', '✅', '✅'],
      ['Complete a payment', '✅', '✅', '✅', '❌', '❌'],
      ['Manage bookings', '✅', '✅', '✅', '❌', '✅'],
      ['Manage promotions', '✅', '✅', '❌', '❌', '❌'],
    ],
    superAdmin: {
      title: 'Super admin',
      text: 'Full access to the whole system. Can create, edit and delete structures.',
      callout: 'This role is only granted by the Shede team. Never share it.',
    },
    cashier: {
      title: 'Cashier',
      text: 'Can take orders, complete them and take payment. Cannot change the catalogue or settings.',
    },
    server: {
      title: 'Waiter',
      text: 'Can only take and edit active orders. No access to financial features.',
    },
  },
  qr: {
    badge: 'Integrations',
    title: 'QR codes and self-ordering',
    text: 'Every table has a unique QR code generated automatically by Shede.',
    codeLabel: 'QR code link',
    code: `https://<your-domain>/client/structure/{structureId}?tableId={tableId}&tableName={name}`,
    callout: 'QR codes can be downloaded as a PDF from the floor plan, ready to print and laminate.',
  },
  payments: {
    title: 'Payments',
    text: 'Shede supports several payment methods suited to local and international markets.',
    methods: [
      { method: 'Cash', desc: 'Manual payment recorded' },
      { method: 'Mobile Money', desc: 'MTN MoMo, Orange Money…' },
      { method: 'Bank card', desc: 'Visa, Mastercard' },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'Is Shede free for customers?', a: 'Yes, completely. The customer account is 100% free with no commission on orders.' },
      { q: 'Can I manage several establishments?', a: 'Yes. As an organisation administrator, you run several restaurants and hotels from a single account.' },
      { q: 'Is the data secure?', a: 'Yes. Data is encrypted, hosted on secure servers and isolated per establishment.' },
      { q: 'Do I need to install an app?', a: 'No. Shede is a progressive web app (PWA) that works in any browser, on mobile and desktop.' },
      { q: 'How do I get a professional account?', a: 'Register your establishment at /register-business or call us on +237 656 954 474. One of our experts will help you.' },
    ],
  },
  contact: {
    title: 'Contact support',
    text: 'Our team is available 7 days a week to help you.',
    call: 'Phone call',
    portfolio: 'Developer portfolio',
  },
  footer: {
    version: '© {year} Shede Tech · Documentation v1.0',
    backHome: '← Back to home',
  },
};

export const DOCS_CONTENT: Record<Locale, DocsContent> = { fr, en };
