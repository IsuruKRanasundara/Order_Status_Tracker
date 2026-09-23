import { z } from 'zod';
import { AppError } from '../domain/app-error.js';
import type { EventRecord, Order, OrderSummary } from '../domain/order.js';
import { statusRank, type OrderStatus } from '../domain/order-status.js';
import { isValidTransition } from '../domain/transition-validator.js';
import type { OrderRepository } from '../repositories/order.repository.js';

export const orderStatusSchema = z.enum(['created', 'paid', 'shipped', 'delivered', 'cancelled']);
const eventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  orderId: z.string().trim().min(1).max(200),
  status: orderStatusSchema,
  timestamp: z.iso.datetime({ offset: true })
    .refine((value) => !/\.\d{4,}/.test(value), 'Use at most millisecond precision')
    .transform((value) => new Date(value).toISOString()),
});

function chronological(a: EventRecord, b: EventRecord): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp)
    || statusRank[a.status] - statusRank[b.status]
    || a.eventId.localeCompare(b.eventId);
}

// Gaps can be filled later. Regressions and moves out of terminal states cannot.
function canEventuallyFollow(previous: OrderStatus, next: OrderStatus): boolean {
  if (previous === 'cancelled' || previous === 'delivered') return false;
  if (next === 'cancelled') return previous === 'created' || previous === 'paid';
  return statusRank[next] > statusRank[previous];
}

function replay(events: EventRecord[]): Pick<Order, 'status' | 'updatedAt' | 'pendingEventCount'> {
  const accepted = events.filter((event) => event.outcome !== 'rejected').sort(chronological);
  let previous: OrderStatus | null = null;
  let status: OrderStatus | null = null;
  let updatedAt: string | null = null;
  let blocked = false;
  let pendingEventCount = 0;
  for (const event of accepted) {
    if (previous !== null && !canEventuallyFollow(previous, event.status)) {
      throw new AppError(409, 'INVALID_TRANSITION',
        `Event timeline cannot move from ${previous} to ${event.status}.`);
    }
    previous = event.status;
    const valid = status === null ? event.status === 'created' : isValidTransition(status, event.status);
    if (blocked || !valid) {
      blocked = true;
      pendingEventCount++;
      event.outcome = 'pending';
      event.reason = 'Waiting for an earlier predecessor event.';
    } else {
      status = event.status;
      updatedAt = event.timestamp;
      event.outcome = 'applied';
      event.reason = null;
    }
  }
  return { status, updatedAt, pendingEventCount };
}

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly logger: Pick<Console, 'warn'> = console,
  ) {}

  receiveEvent(input: unknown): { duplicate: boolean; event: EventRecord; order: OrderSummary } {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_EVENT', parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; '));
    }
    const payload = parsed.data;
    const existing = this.repository.findEvent(payload.eventId);
    if (existing) {
      if (existing.orderId !== payload.orderId || existing.status !== payload.status
        || existing.timestamp !== payload.timestamp) {
        this.logger.warn({ code: 'EVENT_ID_CONFLICT', eventId: payload.eventId });
        throw new AppError(409, 'EVENT_ID_CONFLICT', 'This eventId was already used for a different event.');
      }
      if (existing.outcome === 'rejected') {
        throw new AppError(409, 'INVALID_TRANSITION', existing.reason!);
      }
      return { duplicate: true, event: existing, order: this.summary(this.getOrder(payload.orderId)) };
    }
    const order = this.repository.findById(payload.orderId) ?? {
      id: payload.orderId, status: null, updatedAt: null, pendingEventCount: 0, events: [],
    };
    const event: EventRecord = {
      ...payload, receivedAt: new Date().toISOString(), outcome: 'pending', reason: null,
    };
    // Replaying a copy ensures rejected insertions cannot partially change history.
    const events = [...structuredClone(order.events), event];
    try {
      Object.assign(order, replay(events), { events: events.sort(chronological) });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      event.outcome = 'rejected';
      event.reason = error.message;
      order.events.push(event);
      order.events.sort(chronological);
      this.repository.save(order);
      this.logger.warn({ code: error.code, eventId: event.eventId, orderId: order.id, reason: error.message });
      throw error;
    }
    this.repository.save(order);
    return { duplicate: false, event: structuredClone(event), order: this.summary(order) };
  }

  listOrders(status?: OrderStatus): OrderSummary[] {
    return this.repository.list()
      .filter((order) => status === undefined || order.status === status)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((order) => this.summary(order));
  }

  getOrder(id: string): Order {
    const order = this.repository.findById(id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', `Order ${id} was not found.`);
    return order;
  }

  private summary({ events: _events, ...summary }: Order): OrderSummary { return summary; }
}
