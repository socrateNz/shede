import type fr from '../fr/modules';

const modules: typeof fr = {
  names: {
    POS: 'Point of sale (POS)',
    CLIENT_APP: 'Customer app (B2C)',
    CUISINE: 'Kitchen display (KDS)',
    BAR: 'Bar display',
    LIVRAISON: 'Delivery',
    TABLES: 'Floor plan',
    HOTEL: 'Hotel (PMS)',
    STOCK: 'Stock (inventory)',
    PROMOTION: 'Promotions',
    RH: 'Human resources',
    CRM: 'Customer CRM',
    COMPTABILITE: 'Accounting (SYSCOHADA)',
    API: 'API (marketplaces)',
  },
  descriptions: {
    POS: 'Point of sale, orders, payments',
    CLIENT_APP: 'Public catalogue, cart, online orders',
    CUISINE: 'Real-time kitchen display, order tracking',
    BAR: 'Drink orders display',
    LIVRAISON: 'Delivery zones, riders, delivery tracking',
    TABLES: 'Interactive floor plan and table management',
    HOTEL: 'Rooms, bookings, check-in and check-out',
    STOCK: 'Stock movements, alert thresholds, recipes',
    PROMOTION: 'Promo codes, automatic discounts, special offers',
    RH: 'Staff management',
    CRM: 'Customer records, profiles, order history',
    COMPTABILITE: 'Automatic entries, expenses, ledger, trial balance, balance sheet, VAT',
    API: 'One API key per outlet to connect a delivery marketplace',
  },
  categories: {
    Core: '⚡ Essentials',
    Restauration: '🍽️ Food service',
    Gestion: '🏢 Management',
  },
};

export default modules;
