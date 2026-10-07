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
    ACHATS: 'Purchasing (suppliers)',
    PREVISIONS: 'Forecasting & production',
  },
  descriptions: {
    POS: 'Point of sale, orders, payments',
    CLIENT_APP: 'Public catalogue, cart, online orders',
    CUISINE: 'Real-time kitchen display, order tracking',
    BAR: 'Drink orders display',
    LIVRAISON: 'Delivery zones, riders, delivery tracking',
    TABLES: 'Interactive floor plan and table management',
    HOTEL: 'Rooms, bookings, check-in and check-out',
    STOCK: 'Ingredients, recipes, stock counts, losses and food cost',
    PROMOTION: 'Promo codes, automatic discounts, special offers',
    RH: 'Staff management',
    CRM: 'Customer records, profiles, order history',
    COMPTABILITE: 'Automatic entries, expenses, ledger, trial balance, balance sheet, VAT',
    API: 'One API key per outlet to connect a delivery marketplace',
    ACHATS: 'Supplier catalogue, purchase orders and receiving (also enables Stock)',
    PREVISIONS: 'Sales forecasts, suggested orders and production plan (also enables Stock)',
  },
  categories: {
    Core: '⚡ Essentials',
    Restauration: '🍽️ Food service',
    Gestion: '🏢 Management',
  },
};

export default modules;
