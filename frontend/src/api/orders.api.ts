import type { OrderDetails, OrderStatus, OrderSummary, OrderEventInput, WebhookResult } from '../types/order'
const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

export interface ApiInspection { status: number; ok: boolean; body: unknown }

// Return HTTP errors as data for the event editor and expected-failure checks.
export async function inspectApi(path: string, method: 'GET' | 'POST', body?: string, signal?: AbortSignal): Promise<ApiInspection> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, 15000)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method, signal: controller.signal,
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    })
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }
    return { status: response.status, ok: response.ok, body: data }
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new Error(controller.signal.aborted
      ? 'The request timed out. Retry with the same event ID to avoid duplicates.'
      : 'Unable to reach the order service. Check your connection and try again.', { cause })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
async function request<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(`${baseUrl}${path}`, { ...init, signal }) }
  catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Unable to reach the order service. Check your connection and try again.', { cause: error })
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message || `Request failed (${response.status}). Please try again.`)
  }
  return response.json() as Promise<T>
}
export function getOrders(status?: OrderStatus, signal?: AbortSignal) {
  return request<OrderSummary[]>(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, signal)
}
export function getOrder(id: string, signal?: AbortSignal) {
  return request<OrderDetails>(`/orders/${encodeURIComponent(id)}`, signal)
}

export function createOrder(orderId: string, requestId: string, signal?: AbortSignal) {
  return request<{ duplicate: boolean; order: OrderSummary }>('/orders', signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, requestId }),
  })
}

export function sendOrderEvent(event: OrderEventInput, signal?: AbortSignal) {
  return request<WebhookResult>('/webhooks/orders', signal, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
  })
}
