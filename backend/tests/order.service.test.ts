import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/domain/app-error.js';
import type { OrderEvent } from '../src/domain/order.js';
import type { OrderStatus } from '../src/domain/order-status.js';
import { isValidTransition } from '../src/domain/transition-validator.js';
import { InMemoryOrderRepository } from '../src/repositories/order.repository.js';
import { OrderService } from '../src/services/order.service.js';

function setup() {
  const warnings: unknown[] = [];
  const service = new OrderService(new InMemoryOrderRepository(), { warn: (entry) => warnings.push(entry) });
  return { service, warnings };
}
function event(status: OrderStatus, minute: number, orderId = 'ord_1'): OrderEvent {
  return { eventId: `${orderId}_${status}_${minute}`, orderId, status,
    timestamp: `2026-09-20T10:${String(minute).padStart(2, '0')}:00Z` };
}
function expectError(action: () => unknown, code: string, statusCode = 409) {
  assert.throws(action, (error) => error instanceof AppError
    && error.code === code && error.statusCode === statusCode);
}
function permutations<T>(items: T[]): T[][] {
  if (items.length === 0) return [[]];
  return items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index))
    .map((rest) => [item, ...rest]));
}

test('transition validator allows only the five defined edges', () => {
  const statuses: OrderStatus[] = ['created', 'paid', 'shipped', 'delivered', 'cancelled'];
  const edges = new Set(['created:paid', 'paid:shipped', 'shipped:delivered', 'created:cancelled', 'paid:cancelled']);
  for (const from of statuses) for (const to of statuses) {
    assert.equal(isValidTransition(from, to), edges.has(`${from}:${to}`), `${from} -> ${to}`);
  }
});

test('all 24 arrival permutations converge to delivered with chronological history', () => {
  const events = [event('created', 0), event('paid', 1), event('shipped', 2), event('delivered', 3)];
  for (const arrival of permutations(events)) {
    const { service } = setup();
    for (const payload of arrival) service.receiveEvent(payload);
    const order = service.getOrder('ord_1');
    assert.equal(order.status, 'delivered');
    assert.equal(order.updatedAt, '2026-09-20T10:03:00.000Z');
    assert.equal(order.pendingEventCount, 0);
    assert.deepEqual(order.events.map((entry) => entry.status), events.map((entry) => entry.status));
    assert.ok(order.events.every((entry) => entry.outcome === 'applied'));
  }
});

test('missing predecessor stays pending without skipping or inventing state', () => {
  const { service } = setup();
  const shipped = event('shipped', 2);
  assert.equal(service.receiveEvent(shipped).event.outcome, 'pending');
  assert.equal(service.getOrder('ord_1').status, null);
  service.receiveEvent(event('created', 0));
  assert.equal(service.getOrder('ord_1').status, 'created');
  assert.equal(service.getOrder('ord_1').pendingEventCount, 1);
  service.receiveEvent(event('paid', 1));
  assert.equal(service.getOrder('ord_1').status, 'shipped');
  assert.equal(service.receiveEvent(shipped).event.outcome, 'applied');
});

test('duplicates are idempotent globally and normalize timestamp offsets', () => {
  const { service } = setup();
  const payload = event('created', 0);
  service.receiveEvent(payload);
  assert.equal(service.receiveEvent({ ...payload, timestamp: '2026-09-20T15:30:00+05:30' }).duplicate, true);
  assert.equal(service.getOrder('ord_1').events.length, 1);
  expectError(() => service.receiveEvent({ ...payload, orderId: 'ord_2' }), 'EVENT_ID_CONFLICT');
  expectError(() => service.receiveEvent({ ...payload, status: 'paid' }), 'EVENT_ID_CONFLICT');
  expectError(() => service.receiveEvent({ ...payload, timestamp: '2026-09-20T11:00:00Z' }), 'EVENT_ID_CONFLICT');
  assert.equal(service.listOrders().length, 1);
});

test('cancellation from created or paid converges regardless of arrival order', () => {
  for (const events of [
    [event('created', 0), event('cancelled', 2)],
    [event('created', 0), event('paid', 1), event('cancelled', 2)],
  ]) {
    for (const arrival of permutations(events)) {
      const { service } = setup();
      arrival.forEach((payload) => service.receiveEvent(payload));
      assert.equal(service.getOrder('ord_1').status, 'cancelled');
      assert.equal(service.getOrder('ord_1').pendingEventCount, 0);
    }
  }
});

test('invalid transitions are logged and recorded without changing state; retries do not duplicate history', () => {
  const { service, warnings } = setup();
  ['created', 'paid', 'shipped'].forEach((status, minute) => service.receiveEvent(event(status as OrderStatus, minute)));
  const invalid = event('cancelled', 3);
  expectError(() => service.receiveEvent(invalid), 'INVALID_TRANSITION');
  expectError(() => service.receiveEvent(invalid), 'INVALID_TRANSITION');
  const order = service.getOrder('ord_1');
  assert.equal(order.status, 'shipped');
  assert.equal(order.events.length, 4);
  assert.equal(order.events[3]?.outcome, 'rejected');
  assert.equal(warnings.length, 1);
  service.receiveEvent(event('delivered', 4));
  assert.equal(service.getOrder('ord_1').status, 'delivered');
});

test('repeated statuses with new IDs, backwards events and terminal changes are rejected', () => {
  const { service } = setup();
  service.receiveEvent(event('created', 0));
  service.receiveEvent(event('paid', 1));
  expectError(() => service.receiveEvent(event('paid', 2)), 'INVALID_TRANSITION');
  expectError(() => service.receiveEvent(event('created', 3)), 'INVALID_TRANSITION');
  service.receiveEvent(event('cancelled', 4));
  expectError(() => service.receiveEvent(event('shipped', 5)), 'INVALID_TRANSITION');
  assert.equal(service.getOrder('ord_1').status, 'cancelled');
});

test('late contradictory insertion does not mutate already accepted history', () => {
  const { service } = setup();
  service.receiveEvent(event('created', 0));
  service.receiveEvent(event('shipped', 3));
  expectError(() => service.receiveEvent(event('cancelled', 2)), 'INVALID_TRANSITION');
  assert.equal(service.getOrder('ord_1').status, 'created');
  assert.equal(service.getOrder('ord_1').pendingEventCount, 1);
  service.receiveEvent(event('paid', 1));
  assert.equal(service.getOrder('ord_1').status, 'shipped');
});

test('simultaneous events use status sequence as a deterministic tie breaker', () => {
  const { service } = setup();
  ['delivered', 'shipped', 'paid', 'created'].forEach((status) => service.receiveEvent(event(status as OrderStatus, 0)));
  assert.equal(service.getOrder('ord_1').status, 'delivered');
});

test('invalid input never creates an order', () => {
  const { service } = setup();
  for (const input of [null, {}, [], { ...event('created', 0), eventId: ' ' },
    { ...event('created', 0), orderId: 1 }, { ...event('created', 0), status: 'unknown' },
    { ...event('created', 0), timestamp: '2026-02-30T10:00:00Z' },
    { ...event('created', 0), timestamp: '2026-09-20T10:00:00' },
    { ...event('created', 0), timestamp: '2026-09-20T10:00:00.0001Z' },
  ]) expectError(() => service.receiveEvent(input), 'INVALID_EVENT', 400);
  assert.deepEqual(service.listOrders(), []);
});

test('list filtering, missing orders, and repository isolation', () => {
  const { service } = setup();
  service.receiveEvent(event('created', 0));
  service.receiveEvent(event('created', 0, 'ord_2'));
  service.receiveEvent(event('paid', 1, 'ord_2'));
  assert.deepEqual(service.listOrders('paid').map((order) => order.id), ['ord_2']);
  assert.equal('events' in service.listOrders()[0]!, false);
  const copy = service.getOrder('ord_1');
  copy.events.length = 0;
  assert.equal(service.getOrder('ord_1').events.length, 1);
  expectError(() => service.getOrder('missing'), 'ORDER_NOT_FOUND', 404);
});
