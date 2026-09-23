import type { OrderDetails, OrderEventInput, OrderStatus } from '../types/order'

export function prepareOrderEvent(order: OrderDetails, status: OrderStatus): OrderEventInput {
  const nextTime = Math.max(Date.now(), order.updatedAt ? Date.parse(order.updatedAt) + 1 : 0)
  const earliestPending = order.events
    .filter(event => event.outcome === 'pending')
    .reduce((time, event) => Math.min(time, Date.parse(event.timestamp)), Infinity)
  // Fill a missing predecessor before (or at) its pending successor. The backend
  // orders equal timestamps by status, so millisecond-sized gaps are safe too.
  const timestamp = Math.min(nextTime, earliestPending)
  return { eventId: `evt_${crypto.randomUUID()}`, orderId: order.id, status, timestamp: new Date(timestamp).toISOString() }
}
