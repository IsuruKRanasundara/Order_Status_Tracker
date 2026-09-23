import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createApp } from '../src/app.js';
import type { Order, OrderSummary } from '../src/domain/order.js';
import { InMemoryOrderRepository } from '../src/repositories/order.repository.js';
import { OrderService } from '../src/services/order.service.js';

type WebhookResponse = ReturnType<OrderService['receiveEvent']>;
type ErrorResponse = { error: { code: string; message: string } };
async function json<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

async function start(t: TestContext) {
  const service = new OrderService(new InMemoryOrderRepository(), { warn() {} });
  const server = createApp(service).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    get: (path: string) => fetch(`${base}${path}`),
    post: (body: unknown) => fetch(`${base}/webhooks/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    raw: (body: string) => fetch(`${base}/webhooks/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }),
  };
}

test('HTTP: pending -> applied, duplicates, list filtering and full history', async (t) => {
  const api = await start(t);
  assert.deepEqual(await (await api.get('/orders')).json(), []);
  const paid = { eventId: 'evt_paid', orderId: 'ord_9', status: 'paid', timestamp: '2026-09-20T10:15:00Z' };
  const pending = await api.post(paid);
  assert.equal(pending.status, 202);
  assert.equal((await json<WebhookResponse>(pending)).order.status, null);
  const created = await api.post({ eventId: 'evt_created', orderId: 'ord_9', status: 'created', timestamp: '2026-09-20T10:00:00Z' });
  assert.equal(created.status, 200);
  assert.equal((await json<WebhookResponse>(created)).order.status, 'paid');
  const duplicate = await api.post(paid);
  assert.equal(duplicate.status, 200);
  assert.equal((await json<WebhookResponse>(duplicate)).duplicate, true);
  const list = await json<OrderSummary[]>(await api.get('/orders?status=paid'));
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, 'ord_9');
  assert.equal('events' in list[0]!, false);
  assert.deepEqual(await (await api.get('/orders?status=shipped')).json(), []);
  const details = await json<Order>(await api.get('/orders/ord_9'));
  assert.deepEqual(details.events.map((event: { status: string }) => event.status), ['created', 'paid']);
  assert.equal(details.pendingEventCount, 0);
});

test('HTTP: bad input, invalid JSON, invalid filters, missing routes and oversized requests', async (t) => {
  const api = await start(t);
  for (const body of [{}, { status: 'wrong' }, null]) assert.equal((await api.post(body)).status, 400);
  const malformed = await api.raw('{');
  assert.equal(malformed.status, 400);
  assert.equal((await json<ErrorResponse>(malformed)).error.code, 'INVALID_JSON');
  assert.equal((await api.post({ padding: 'x'.repeat(17000) })).status, 413);
  for (const path of ['/orders?status=wrong', '/orders?status=paid&status=created']) {
    assert.equal((await api.get(path)).status, 400);
  }
  assert.equal((await api.get('/orders/missing')).status, 404);
  assert.equal((await api.get('/missing')).status, 404);
  assert.deepEqual(await (await api.get('/orders')).json(), []);
});

test('HTTP: invalid transition returns 409 and remains visible in history', async (t) => {
  const api = await start(t);
  const payload = { eventId: 'evt_created', orderId: 'ord_9', status: 'created', timestamp: '2026-09-20T10:00:00Z' };
  await api.post(payload);
  const response = await api.post({ ...payload, eventId: 'evt_repeat', timestamp: '2026-09-20T10:01:00Z' });
  assert.equal(response.status, 409);
  assert.equal((await json<ErrorResponse>(response)).error.code, 'INVALID_TRANSITION');
  const history = await json<Order>(await api.get('/orders/ord_9'));
  assert.equal(history.status, 'created');
  assert.equal(history.events[1]?.outcome, 'rejected');
  assert.equal((await api.post({ ...payload, status: 'paid' })).status, 409);
});
