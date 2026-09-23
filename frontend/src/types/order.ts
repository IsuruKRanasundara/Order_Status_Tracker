export type OrderStatus = 'created' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
export type StatusFilterValue = OrderStatus | 'all' | 'pending'
export interface OrderSummary {
  id: string
  status: OrderStatus | null
  updatedAt: string | null
  pendingEventCount: number
}
export interface OrderEvent {
  eventId: string
  orderId: string
  status: OrderStatus
  timestamp: string
  receivedAt: string
  outcome: 'applied' | 'pending' | 'rejected'
  reason: string | null
}
export interface OrderDetails extends OrderSummary { events: OrderEvent[] }
