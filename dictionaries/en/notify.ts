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
};

export default notify;
