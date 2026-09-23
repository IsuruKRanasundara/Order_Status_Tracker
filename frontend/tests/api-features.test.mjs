import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { createApp } from '../../backend/dist/app.js'
import { InMemoryOrderRepository } from '../../backend/dist/repositories/order.repository.js'
import { OrderService } from '../../backend/dist/services/order.service.js'

function moduleUrl(source) {
  const compiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  const errors = compiled.diagnostics.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  assert.deepEqual(errors.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [])
  return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
}

async function setup(t) {
  const server = createApp(new OrderService(new InMemoryOrderRepository(), { warn() {} })).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const source = readFileSync(new URL('../src/api/orders.api.ts', import.meta.url), 'utf8')
    .replace('import.meta.env', JSON.stringify({ VITE_API_URL: baseUrl }))
  const apiUrl = moduleUrl(source)
  const checksSource = readFileSync(new URL('../src/api/api-checks.ts', import.meta.url), 'utf8')
    .replace("from './orders.api'", `from '${apiUrl}'`)
  return { api: await import(apiUrl), checks: await import(moduleUrl(checksSource)) }
}

test('all 24 app checks pass twice against real HTTP with independent test orders', async t => {
  const { api, checks } = await setup(t)
  for (const runId of ['first_run', 'second_run']) {
    const results = []
    await checks.runApiChecks(runId, result => results.push(result))
    assert.equal(results.length, 24)
    for (const result of results) assert.equal(result.passed, true, JSON.stringify(result))
  }
  assert.equal((await api.getOrders()).length, 6)
})

test('checks fail on incorrect response bodies even with the expected HTTP status', async t => {
  const { checks } = await setup(t)
  const steps = checks.buildApiChecks('bad_response')
  const result = checks.evaluateApiCheck(steps[3], {
    status: 200, ok: true, body: { duplicate: false, order: { status: 'paid', pendingEventCount: 0 } },
  })
  assert.equal(result.passed, false)
  assert.equal(checks.evaluateApiCheck(steps[9], { status: 200, ok: true, body: null }).passed, false)
  assert.equal(checks.evaluateApiCheck(steps[0], { status: 500, ok: false, body: [] }).passed, false)
})

test('frontend event requests support lifecycle updates, exact retries, and raw validation failures', async t => {
  const { api } = await setup(t)
  const order = await api.createOrder('manual_order', 'request_1')
  const start = Date.parse(order.order.updatedAt)
  let minute = 1
  for (const status of ['paid', 'shipped', 'delivered']) {
    const event = { eventId: `evt_${status}`, orderId: 'manual_order', status, timestamp: new Date(start + minute++ * 1000).toISOString() }
    assert.equal((await api.sendOrderEvent(event)).order.status, status)
    assert.equal((await api.sendOrderEvent(event)).duplicate, true)
  }
  assert.equal((await api.getOrder('manual_order')).events.length, 4)
  const invalid = await api.inspectApi('/webhooks/orders', 'POST', '{"eventId":')
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.error.code, 'INVALID_JSON')
  const missing = await api.inspectApi('/orders/missing', 'GET')
  assert.equal(missing.status, 404)
  const conflicting = await api.inspectApi('/webhooks/orders', 'POST', JSON.stringify({ eventId: 'evt_paid', orderId: 'manual_order', status: 'shipped', timestamp: new Date(start + 1000).toISOString() }))
  assert.equal(conflicting.status, 409)
  assert.equal(conflicting.body.error.code, 'EVENT_ID_CONFLICT')
})

test('stopping a check run prevents subsequent requests', async t => {
  const { api, checks } = await setup(t)
  const controller = new AbortController()
  const results = []
  await checks.runApiChecks('stopped', result => { results.push(result); controller.abort() }, controller.signal)
  assert.equal(results.length, 1)
  assert.deepEqual(await api.getOrders(), [])
})

test('status action fills a missing predecessor before an existing pending successor', async t => {
  const { api } = await setup(t)
  const source = readFileSync(new URL('../src/api/order-events.ts', import.meta.url), 'utf8')
  const { prepareOrderEvent } = await import(moduleUrl(source))
  await api.sendOrderEvent({ eventId: 'early_shipped', orderId: 'pending', status: 'shipped', timestamp: '2026-01-01T00:02:00Z' })
  await api.sendOrderEvent(prepareOrderEvent(await api.getOrder('pending'), 'created'))
  const before = await api.getOrder('pending')
  assert.equal(before.status, 'created')
  const result = await api.sendOrderEvent(prepareOrderEvent(before, 'paid'))
  assert.equal(result.order.status, 'shipped')
  assert.equal(result.order.pendingEventCount, 0)
})
