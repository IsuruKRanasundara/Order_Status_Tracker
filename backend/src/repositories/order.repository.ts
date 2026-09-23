import type { EventRecord, Order } from '../domain/order.js';

export interface OrderRepository {
  findById(id: string): Order | undefined;
  findEvent(eventId: string): EventRecord | undefined;
  list(): Order[];
  save(order: Order): void;
}

// Synchronous reads/writes are atomic within one Node process. A database-backed
// implementation needs transactions and a unique constraint on eventId.
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private readonly events = new Map<string, EventRecord>();

  findById(id: string): Order | undefined {
    const order = this.orders.get(id);
    return order ? structuredClone(order) : undefined;
  }

  findEvent(eventId: string): EventRecord | undefined {
    const event = this.events.get(eventId);
    return event ? structuredClone(event) : undefined;
  }

  list(): Order[] {
    return structuredClone([...this.orders.values()]);
  }

  save(order: Order): void {
    this.orders.set(order.id, structuredClone(order));
    for (const event of order.events) this.events.set(event.eventId, structuredClone(event));
  }
}
