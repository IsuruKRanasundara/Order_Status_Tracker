export type OrderStatus =
  | 'created'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// Cancellation is a branch, not a forward step. Use the validator for transitions.
export const statusRank: Record<OrderStatus, number> = {
  created: 1,
  paid: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};
