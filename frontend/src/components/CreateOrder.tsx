import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createOrder } from '../api/orders.api'
import type { OrderSummary } from '../types/order'
import Icon from './Icon'
import StatusBadge from './StatusBadge'

export default function CreateOrder({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (order: OrderSummary) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [orderId, setOrderId] = useState(() => `ord_${crypto.randomUUID()}`)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (!orderId.trim()) { setError('Enter an order ID or generate one.'); return }
    submitting.current = true
    setSaving(true)
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const result = await createOrder(orderId.trim(), requestId, controller.signal)
      onCreated(result.order)
    } catch (cause) {
      setError(controller.signal.aborted
        ? 'The request timed out. Try again; your order will not be duplicated.'
        : cause instanceof Error ? cause.message : 'Could not create the order. Please try again.')
    } finally {
      window.clearTimeout(timeout)
      submitting.current = false
      setSaving(false)
    }
  }

  function updateOrderId(value: string) {
    setOrderId(value)
    setRequestId(crypto.randomUUID())
    setError(null)
  }

  return <dialog ref={dialogRef} className="create-dialog" aria-labelledby="create-order-title" aria-describedby="create-order-description"
    onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <div className="create-dialog-heading">
      <span className="create-order-symbol"><Icon name="box" /></span>
      <button className="icon-button" type="button" aria-label="Close create order" disabled={saving} onClick={onClose}><Icon name="close" /></button>
    </div>
    <h2 id="create-order-title">Create an order</h2>
    <p id="create-order-description">Start a new order and follow every update from here.</p>
    <form onSubmit={submit} aria-busy={saving}>
      <div className="create-field-heading"><label htmlFor="new-order-id">Order ID</label><button className="text-button" type="button" disabled={saving} onClick={() => updateOrderId(`ord_${crypto.randomUUID()}`)}>Generate ID</button></div>
      <input id="new-order-id" className="create-input" value={orderId} onChange={event => updateOrderId(event.target.value)} required maxLength={200} disabled={saving} aria-describedby="order-id-help" autoComplete="off" />
      <p id="order-id-help" className="field-help">Use your own reference or keep the generated ID. Each order needs a unique ID.</p>
      <div className="create-summary"><div><span>Starting status</span><StatusBadge status="created" /></div><div><span>Created time</span><strong>Set automatically</strong></div></div>
      {error && <p className="create-error" role="alert">{error}</p>}
      <div className="create-actions"><button className="button" type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary-button" type="submit" disabled={saving}>{saving && <Icon name="refresh" className="spin" />}{saving ? 'Creating order...' : 'Create order'}</button></div>
    </form>
  </dialog>
}
