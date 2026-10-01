import type fr from '../fr/marketplace';

const marketplace: typeof fr = {
  title: 'Marketplace orders',
  empty: 'No orders waiting.',
  pause: 'Pause',
  resume: 'Resume orders',
  pausedText: 'Paused: marketplaces cannot send orders to this outlet.',
  pausedToast: 'Marketplace orders paused',
  resumed: 'Marketplace orders resumed',
  prepTime: 'Ready in',
  minutes: '{count} min',
  accept: 'Accept',
  reject: 'Decline',
  accepted: 'Order accepted: sent to the kitchen',
  rejected: 'Order declined',
  rejectReason: 'Reason for declining (sent to the marketplace): out of stock, closed…',
  orderFrom: '{partner} order no. {ref}',
  awaiting: 'Waiting for your acceptance.',
  acceptedWith: 'Accepted — ready in {minutes} min.',
  rejectedWith: 'Declined: {reason}',
  courier: 'Courier: {status} ({name})',
  courierStatus: {
    ASSIGNED: 'on the way to the restaurant',
    PICKED_UP: 'order picked up',
    DELIVERED: 'delivered to the customer',
    FAILED: 'delivery failed',
  },
  paidByPartner: 'Paid by the marketplace: the sale is closed automatically when the courier picks up the order.',
  errors: {
    invalidPrepTime: 'Invalid preparation time (1 to 240 minutes).',
    notPending: 'This order is no longer awaiting acceptance.',
    reasonRequired: 'Give the reason for declining.',
  },
};

export default marketplace;
