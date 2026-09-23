import type { OrderStatus } from './order-status.js';

export interface OrderEvent {
  eventId: string;
  orderId: string;
  status: OrderStatus;
  timestamp: string;
}

export interface EventRecord extends OrderEvent {
  receivedAt: string;
  outcome: 'applied' | 'pending' | 'rejected';
  reason: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus | null;
  updatedAt: string | null;
  pendingEventCount: number;
  events: EventRecord[];
}

export type OrderSummary = Omit<Order, 'events'>;
