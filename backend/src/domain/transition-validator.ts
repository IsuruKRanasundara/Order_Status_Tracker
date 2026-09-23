import type { OrderStatus } from './order-status.js';

export function isValidTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean {
  if (nextStatus === 'cancelled') {
    return currentStatus === 'created' || currentStatus === 'paid';
  }

  const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    created: ['paid'],
    paid: ['shipped'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  return allowedTransitions[currentStatus].includes(nextStatus);
}
