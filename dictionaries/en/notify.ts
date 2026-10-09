import type fr from '../fr/notify';

const notify: typeof fr = {
  test: {
    title: 'Test notification',
    body: 'Push notifications are working.',
    settingsBody: 'This is a test notification to check your settings.',
  },
  bookingUpdated: {
    title: 'Your booking has been updated',
    body: 'Your booking {ref} is now: {status}.',
  },
  webBooking: {
    title: 'New booking (web)',
    body: 'Booking request from {name} from {from} to {to}.',
  },
  bookingCancelled: {
    title: 'Booking cancelled',
    body: 'The customer cancelled booking {ref}.',
  },
  bookingDatesChanged: {
    title: 'Booking changed',
    body: 'The customer changed the dates of booking {ref}.',
  },
  orderCancelled: {
    title: 'Order cancelled',
    body: 'The customer cancelled order {ref}.',
  },
  webOrder: {
    title: 'New order (web)',
    body: 'Order {ref} received from an online customer.',
  },
  newOrder: {
    title: 'New order',
    body: 'Order {ref} created.',
  },
  marketplaceOrder: {
    title: 'New {partner} order',
    body: 'Order {ref} awaiting acceptance.',
  },
  marketplaceCancelled: {
    title: 'Marketplace order cancelled',
    body: 'The marketplace cancelled order {ref}.',
  },
  orderUpdated: {
    title: 'Your order has been updated',
    body: 'Your order {ref} is now: {status}.',
  },
  welcome: {
    title: 'Welcome to the team!',
    body: 'Your “{role}” account has been created.',
  },
  profileUpdated: {
    title: 'Your profile has been updated',
    body: 'Your profile or role ({role}) was updated by the administrator.',
  },
  licenseStatus: {
    title: 'License update',
    activated: 'Your organisation’s license has been activated by the super admin.',
    suspended: 'Your organisation’s license has been suspended by the super admin.',
  },
  licenseModules: {
    title: 'License changed',
    body: 'The modules of the {name} organisation have been updated. Log in again to use them.',
  },
  orderReady: {
    title: 'Order ready',
    body: 'Table {table}: the order is ready to serve.',
  },
  waiterOrder: {
    title: 'Order to collect',
    body: '{table} · order taken by {waiter} ({amount}), awaiting payment.',
  },
  orderServed: {
    title: 'Table served, payment due',
    body: '{table} was served by {waiter}: {amount} to collect.',
  },
  counterReady: {
    title: 'Order ready',
    body: 'Order {ref} is ready to hand over.',
    bodyTable: '{table}: order {ref} is ready to serve.',
  },
  deliveryReady: {
    title: 'Delivery ready to go',
    body: 'Order {ref} ({name}) is ready: a courier can pick it up.',
  },
  deliveryAssigned: {
    title: 'New delivery',
    body: 'Delivery {ref} has been assigned to you.',
  },
  deliveryFailed: {
    title: 'Delivery failed',
    body: 'Delivery {ref} could not be completed: {reason}',
  },
  shiftVariance: {
    title: 'Cash variance at closing',
    short: '{amount} missing (expected {expected}, counted {actual}).',
    over: '{amount} over (expected {expected}, counted {actual}).',
  },
  lossDeclared: {
    title: 'Loss recorded',
    body: '{quantity} × {name} ({reason}), worth {value}.',
  },
  goodsReceived: {
    title: 'Supplier delivery received',
    body: 'Receipt {number} recorded: {amount} excl. tax.',
  },
  expenseToPay: {
    title: 'Expense to pay',
    body: '{label}: {amount} to pay.',
  },
  lowStock: {
    title: 'Low stock',
    outTitle: 'Out of stock',
    body: '{name}: only {quantity} left in stock.',
  },
};

export default notify;
