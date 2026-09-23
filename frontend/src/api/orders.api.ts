import type { OrderDetails, OrderStatus, OrderSummary } from '../types/order'
const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
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
