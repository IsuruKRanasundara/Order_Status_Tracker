import { inspectApi, type ApiInspection } from './orders.api'
import type { OrderDetails, OrderSummary, WebhookResult } from '../types/order'

type Check = { label: string; verify: (body: unknown) => boolean }
export interface ApiCheckStep {
  name: string
  method: 'GET' | 'POST'
  path: string
  expectedStatus: number
  body?: string
  checks: Check[]
}
export interface ApiCheckResult {
  name: string
  path: string
  method: string
  expectedStatus: number
  status: number | null
  passed: boolean
  assertions: { label: string; passed: boolean }[]
  body: unknown
}

export function buildApiChecks(runId: string): ApiCheckStep[] {
  const steps: ApiCheckStep[] = []
  const add = (name: string, method: 'GET' | 'POST', path: string, expectedStatus: number, checks: Check[] = [], body?: string) => {
    steps.push({ name, method, path, expectedStatus, checks, ...(body === undefined ? {} : { body }) })
  }
  const event = (order: string, status: string, minute: number, id = `${order}_${status}`) => ({
    eventId: `${runId}_${id}`, orderId: `${runId}_${order}`, status,
    timestamp: `2026-09-20T10:${String(minute).padStart(2, '0')}:00Z`,
  })
  const errorCode = (code: string): Check => ({ label: `Error code is ${code}`, verify: body => (body as { error: { code: string } }).error.code === code })
  const detailPath = (order: string) => `/orders/${encodeURIComponent(`${runId}_${order}`)}`
  const post = (name: string, order: string, status: string, minute: number, current = status, pending = 0, duplicate = false) => {
    add(name, 'POST', '/webhooks/orders', 200, [
      { label: `Current status is ${current}`, verify: b => (b as WebhookResult).order.status === current },
      { label: `Duplicate is ${duplicate}`, verify: b => (b as WebhookResult).duplicate === duplicate },
      { label: `Pending count is ${pending}`, verify: b => (b as WebhookResult).order.pendingEventCount === pending },
    ], JSON.stringify(event(order, status, minute)))
  }

  add('Begin a fresh run and list orders', 'GET', '/orders', 200, [{ label: 'Returns an array', verify: Array.isArray }])
  post('Create an order', 'normal', 'created', 0)
  post('Mark order paid', 'normal', 'paid', 1)
  post('Resend identical paid event', 'normal', 'paid', 1, 'paid', 0, true)
  add('Check duplicate did not add history', 'GET', detailPath('normal'), 200, [
    { label: 'Exactly two events', verify: b => (b as OrderDetails).events.length === 2 },
    { label: 'Created then paid', verify: b => (b as OrderDetails).events.map(e => e.status).join(',') === 'created,paid' },
  ])
  add('Filter paid orders', 'GET', '/orders?status=paid', 200, [
    { label: 'All returned orders are paid', verify: b => (b as OrderSummary[]).every(o => o.status === 'paid') },
    { label: 'Includes this run’s order', verify: b => (b as OrderSummary[]).some(o => o.id === `${runId}_normal`) },
  ])
  post('Ship order', 'normal', 'shipped', 2)
  add('Reject cancellation after shipping', 'POST', '/webhooks/orders', 409, [errorCode('INVALID_TRANSITION')], JSON.stringify(event('normal', 'cancelled', 3)))
  post('Deliver order', 'normal', 'delivered', 4)
  add('Check full history including rejection', 'GET', detailPath('normal'), 200, [
    { label: 'Order is delivered', verify: b => (b as OrderDetails).status === 'delivered' },
    { label: 'Five history entries', verify: b => (b as OrderDetails).events.length === 5 },
    { label: 'Cancellation is rejected', verify: b => (b as OrderDetails).events[3]?.outcome === 'rejected' },
  ])
  add('Reject reused event ID with changed data', 'POST', '/webhooks/orders', 409, [errorCode('EVENT_ID_CONFLICT')], JSON.stringify(event('normal', 'shipped', 1, 'normal_paid')))
  add('Receive shipped before its predecessors', 'POST', '/webhooks/orders', 202, [
    { label: 'No invented order status', verify: b => (b as WebhookResult).order.status === null },
    { label: 'Event is pending', verify: b => (b as WebhookResult).event.outcome === 'pending' },
  ], JSON.stringify(event('outoforder', 'shipped', 2)))
  // The new created event is applied, while the existing shipped event remains pending.
  add('Receive earlier created event', 'POST', '/webhooks/orders', 200, [
    { label: 'Current status is created', verify: b => (b as WebhookResult).order.status === 'created' },
    { label: 'One event still pending', verify: b => (b as WebhookResult).order.pendingEventCount === 1 },
  ], JSON.stringify(event('outoforder', 'created', 0)))
  post('Receive missing paid and reconcile shipping', 'outoforder', 'paid', 1, 'shipped')
  add('Check reconciled chronological history', 'GET', detailPath('outoforder'), 200, [
    { label: 'Created, paid, shipped in order', verify: b => (b as OrderDetails).events.map(e => e.status).join(',') === 'created,paid,shipped' },
    { label: 'All events applied', verify: b => (b as OrderDetails).events.every(e => e.outcome === 'applied') },
    { label: 'No events pending', verify: b => (b as OrderDetails).pendingEventCount === 0 },
  ])
  post('Create cancellable order', 'cancel', 'created', 0)
  post('Cancel before payment', 'cancel', 'cancelled', 1)
  add('Reject change after cancellation', 'POST', '/webhooks/orders', 409, [errorCode('INVALID_TRANSITION')], JSON.stringify(event('cancel', 'paid', 2)))
  add('Reject unknown status', 'POST', '/webhooks/orders', 400, [errorCode('INVALID_EVENT')], JSON.stringify(event('invalid', 'unknown', 0)))
  add('Reject missing fields', 'POST', '/webhooks/orders', 400, [errorCode('INVALID_EVENT')], JSON.stringify({ eventId: `${runId}_missing_fields` }))
  add('Reject invalid timestamp', 'POST', '/webhooks/orders', 400, [errorCode('INVALID_EVENT')], JSON.stringify({ ...event('invalid', 'created', 0), timestamp: 'not-a-date' }))
  add('Reject malformed JSON', 'POST', '/webhooks/orders', 400, [errorCode('INVALID_JSON')], '{"eventId":')
  add('Reject unknown status filter', 'GET', '/orders?status=unknown', 400, [errorCode('INVALID_STATUS')])
  add('Return 404 for missing order', 'GET', detailPath('does_not_exist'), 404, [errorCode('ORDER_NOT_FOUND')])
  return steps
}

export function evaluateApiCheck(step: ApiCheckStep, response: ApiInspection): ApiCheckResult {
  const assertions = [{ label: `HTTP ${step.expectedStatus}`, passed: response.status === step.expectedStatus },
    ...step.checks.map(check => {
      try { return { label: check.label, passed: check.verify(response.body) } }
      catch { return { label: check.label, passed: false } }
    })]
  return { name: step.name, path: step.path, method: step.method, expectedStatus: step.expectedStatus,
    status: response.status, body: response.body, assertions, passed: assertions.every(check => check.passed) }
}

export async function runApiChecks(runId: string, onResult: (result: ApiCheckResult) => void, signal?: AbortSignal) {
  for (const step of buildApiChecks(runId)) {
    if (signal?.aborted) return
    try {
      const response = await inspectApi(step.path, step.method, step.body, signal)
      if (signal?.aborted) return
      onResult(evaluateApiCheck(step, response))
    } catch (cause) {
      if (signal?.aborted) return
      onResult({ name: step.name, path: step.path, method: step.method, expectedStatus: step.expectedStatus,
        status: null, passed: false, assertions: [], body: cause instanceof Error ? cause.message : 'Network error' })
      // Dependent requests cannot usefully proceed after a transport failure.
      return
    }
  }
}
